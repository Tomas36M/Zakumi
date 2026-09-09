import { NextResponse } from "next/server";
import { getSesionAdmin } from "@/lib/admin/dal";
import { claveTesela, claveTrabajo, esSaturada, type Punto } from "@/lib/admin/barrido";
import {
  circuloDentroDelTerritorio,
  esErrorDeMigracion,
  filaDeConsultaSinAnotar,
  recortarAlArea,
  type ResumenTesela,
} from "@/lib/admin/barrido-servidor";
import {
  filaDeNegocio,
  placeANegocio,
  soloConTelefono,
  type PlaceApi,
} from "@/lib/admin/places";
import type { Territorio } from "@/lib/admin/territorios";
import { tiposDeVertical } from "@/lib/admin/verticales-places";

// El turno son tres viajes en serie: Google (hasta 8 s), el upsert de hasta 20
// negocios y el RPC de contabilidad. Sin maxDuration, la plataforma corta la
// función y devuelve un 504 que el cliente cuenta como `fallida` con
// `cobrada: false` — una llamada YA facturada anotada como gratis, que es la
// mentira que esta pantalla no puede permitirse.
export const maxDuration = 30;

// Mismo FieldMask que la búsqueda de texto: define el SKU que factura Google
// (Enterprise, US$35/1.000). addressComponents es Pro y viaja gratis.
// No añadir campos sin mirar el precio.
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.rating",
  "places.websiteUri",
  "places.types",
  "places.businessStatus",
].join(",");

type Payload = { centro?: unknown; radio?: unknown; vertical?: unknown };

/** Lo que este handler necesita de un territorio, y nada más: la caja para la
 * guarda de gasto y el polígono para recortar los resultados. */
type TerritorioBarrido = Pick<
  Territorio,
  "id" | "poligono" | "bbox_sur" | "bbox_norte" | "bbox_oeste" | "bbox_este"
>;

function centroValido(valor: unknown): valor is Punto {
  if (typeof valor !== "object" || valor === null) return false;
  const { lat, lng } = valor as { lat?: unknown; lng?: unknown };
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/**
 * Una tesela × una vertical = una llamada a Google. Es el único lugar que
 * toca la API key y el único que escribe negocios de un barrido — Task 10
 * lo llama en un loop de cientos de veces desde el navegador, así que cada
 * guardarraíl de acá vale por cientos de llamadas evitadas.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // La key de Places vive solo en el servidor; la sesión evita que este
  // endpoint sea un proxy abierto que queme la cuota a nombre de Zakumi.
  const sesion = await getSesionAdmin();
  if (!sesion) return NextResponse.json({ error: "no_autorizado" }, { status: 401 });

  // Sin key, Google devuelve 403 en CADA tesela: 310 respuestas 502 que —antes
  // de que el resumen contara las fallidas— se leían como "aquí no hay nadie".
  // Un error de configuración se dice una vez y con nombre propio.
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error("[barrido] falta GOOGLE_PLACES_API_KEY");
    return NextResponse.json({ error: "sin_api_key" }, { status: 500 });
  }

  const { id } = await params; // Next 16: params es una Promise.

  let payload: Payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "peticion_invalida" }, { status: 400 });
  }

  const { centro, radio, vertical } = payload;
  if (
    !centroValido(centro) ||
    typeof radio !== "number" ||
    typeof vertical !== "string"
  ) {
    return NextResponse.json({ error: "peticion_invalida" }, { status: 400 });
  }
  const tipos = tiposDeVertical(vertical);
  if (tipos.length === 0) {
    return NextResponse.json({ error: "peticion_invalida" }, { status: 400 });
  }

  const tesela = { centro, radio, clave: claveTesela(centro, radio) };
  const clave = claveTrabajo(tesela, vertical);
  // El contexto de TODO log de este handler. Un barrido son miles de peticiones
  // idénticas en forma: sin territorio, tesela y vertical en cada línea, treinta
  // fallos son treinta líneas anónimas que no se pueden correlacionar con nada
  // ni contar por zona.
  const ctx = { territorio: id, clave, vertical };

  // SOLO las columnas que se usan. `select("*")` traía además `teselas_hechas` y
  // `teselas_saturadas`, que crecen con el barrido: el costo de transferencia
  // salía cuadrático en la longitud del barrido, en la única ruta que se llama
  // miles de veces seguidas.
  const { data: fila, error: errorTerritorio } = await sesion.supabase
    .from("territorios")
    .select("id, poligono, bbox_sur, bbox_norte, bbox_oeste, bbox_este")
    .eq("id", id)
    .single();

  if (errorTerritorio || !fila) {
    return NextResponse.json({ error: "territorio_no_encontrado" }, { status: 404 });
  }
  const territorio = fila as TerritorioBarrido;

  /** Registra en `consultas_places` una llamada que Google COBRÓ y que no va a
   * pasar por `anotar_tesela` — la tesela tiene que poder reintentarse, así
   * que no se marca como hecha, pero el cobro sí queda en el conteo del mes.
   * Best effort: si falla se loguea y la respuesta al cliente no cambia. Sin
   * este intento, el contador de la cuota se quedaba corto justo en los caminos
   * de fallo, que es donde nadie está mirando. */
  const registrarCobroSinAnotar = async (resultados: number | null) => {
    const { error } = await sesion.supabase
      .from("consultas_places")
      .insert(filaDeConsultaSinAnotar(territorio.id, clave, vertical, resultados));
    if (error) {
      console.error("[barrido] cobro sin anotar NO quedó registrado", {
        ...ctx,
        error: error.message,
      });
    }
  };

  // El guardarraíl que evita barrer Colombia entera con un círculo cualquiera
  // a nombre del territorio de otro — sus pruebas viven en
  // barrido-servidor.test.ts y no se tocan.
  if (!circuloDentroDelTerritorio(centro, radio, territorio)) {
    return NextResponse.json({ error: "circulo_fuera_del_territorio" }, { status: 400 });
  }

  let respuesta: Response;
  try {
    respuesta = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      // 8 s, por debajo de `maxDuration`: el reloj que tiene que saltar
      // primero es el NUESTRO. Si corta la plataforma, el 504 llega sin
      // cuerpo y el cliente lo cuenta como fallo gratis sobre una llamada que
      // Google ya facturó; cortando nosotros, devolvemos un 502 propio y el
      // resto del turno (upsert + RPC) todavía cabe.
      signal: AbortSignal.timeout(8_000),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        includedTypes: tipos,
        maxResultCount: 20,
        languageCode: "es",
        regionCode: "CO",
        locationRestriction: {
          circle: { center: { latitude: centro.lat, longitude: centro.lng }, radius: radio },
        },
      }),
    });
  } catch (error) {
    console.error("[barrido] fallo de red hacia Google", { ...ctx, error });
    return NextResponse.json({ error: "places_error" }, { status: 502 });
  }

  if (!respuesta.ok) {
    // El detalle va al log del servidor; el body de Google nunca al browser.
    console.error("[barrido] Google respondió con error", {
      ...ctx,
      estado: respuesta.status,
      cuerpo: await respuesta.text().catch(() => "(sin body)"),
    });
    const esCuota = respuesta.status === 429;
    return NextResponse.json(
      { error: esCuota ? "cuota" : "places_error" },
      { status: esCuota ? 503 : 502 },
    );
  }

  // Un 200 con body malformado no puede reventar el handler: Next devolvería
  // un 500 sobre una tesela que Google YA facturó, y el cliente lo vería como
  // un fallo sin explicación. Se trata como lo que es: fallo de Google.
  let data: { places?: PlaceApi[] };
  try {
    data = (await respuesta.json()) as { places?: PlaceApi[] };
  } catch (error) {
    console.error("[barrido] respuesta de Google ilegible", { ...ctx, error });
    await registrarCobroSinAnotar(null);
    return NextResponse.json({ error: "places_error", cobrada: true }, { status: 502 });
  }

  const crudos = (data.places ?? []).map((p) => placeANegocio(p));
  const enElArea = recortarAlArea(crudos, territorio.poligono);
  const contactables = soloConTelefono(enElArea);

  let insertados = 0;
  if (contactables.length > 0) {
    // onConflict + ignoreDuplicates: re-barrer un territorio NUNCA pisa el
    // estado del pipeline ni las notas de un lead que alguien ya trabajó.
    const { data: filas, error } = await sesion.supabase
      .from("negocios")
      .upsert(
        // El MISMO armado de fila que importarNegocios (filaDeNegocio, en
        // places.ts), y por una razón elevada al cuadrado: este es hoy el
        // escritor PRINCIPAL de `negocios`. Tenerlo duplicado ya había hecho
        // divergir la ciudad — allá saneada, acá cruda — y dos grafías de un
        // municipio son dos entradas en el filtro de la lista de leads.
        contactables.map((r) => filaDeNegocio(r, territorio.id)),
        { onConflict: "google_place_id", ignoreDuplicates: true },
      )
      .select("id");

    if (error) {
      // 502 a propósito (no un 200 con contabilizada:false): los negocios NO
      // se guardaron, así que la tesela tiene que poder reintentarse. Pero la
      // llamada a Google YA se cobró y anotar_tesela nunca corrió: `cobrada`
      // se lo dice al cliente, que lo suma al mismo contador de "cobrado y no
      // contabilizado". Un gasto invisible es la única cosa peor que un error.
      console.error("[barrido] error insertando negocios", { ...ctx, error: error.message });
      await registrarCobroSinAnotar(crudos.length);
      return NextResponse.json({ error: "db_error", cobrada: true }, { status: 502 });
    }
    insertados = filas?.length ?? 0;
  }

  // La tesela se anota SOLO después de que Google respondió y el insert de
  // negocios quedó bien: si el insert falla, ya se devolvió 502 antes de
  // llegar aquí y el barrido reintentará esta tesela — se paga dos veces esa
  // llamada, pero nunca se pierde un negocio. Es el lado correcto del canje.
  //
  // anotar_tesela (supabase/prospeccion.sql) hace el llamadas+1 / append a
  // teselas_hechas / append a verticales en UN solo UPDATE atómico en
  // Postgres. Task 10 corre este handler de a CONCURRENCIA=4 en paralelo
  // contra la misma fila de territorios: un read-modify-write hecho acá (leer
  // territorio.llamadas/teselas_hechas y escribir de vuelta) perdía
  // anotaciones bajo esa carrera — y con ellas, plata: al reanudar el barrido
  // se le volvía a pagar a Google por teselas que ya se habían barrido.
  //
  // `p_saturada` hace DURABLE la subdivisión. Sin él, las 4 hijas de una celda
  // saturada solo existen en la cola del navegador: una recarga, un clic en el
  // sidebar o un crash las borra, y como la MADRE sí queda en teselas_hechas,
  // ningún barrido futuro las regenera — las manzanas más densas del
  // territorio se pierden en silencio y la pantalla dice 100%.
  const saturada = esSaturada(crudos.length);
  const { error: errorAnotar } = await sesion.supabase.rpc("anotar_tesela", {
    p_territorio: territorio.id,
    p_clave: clave,
    p_vertical: vertical,
    p_resultados: crudos.length,
    p_insertados: insertados,
    p_saturada: saturada,
  });

  if (errorAnotar) {
    // La llamada ya se cobró y los negocios ya se guardaron: no hay reintento
    // seguro (reintentar la duplicaría en la factura de Google). Se avisa vía
    // `contabilizada: false` — el cliente lo suma y avisa, ver Task 10 — en
    // vez de convertir esto en una respuesta de error.
    console.error("[barrido] error anotando tesela", {
      ...ctx,
      error: errorAnotar.message,
    });
    // El RPC no corrió, así que su insert en consultas_places tampoco: el
    // cobro se registra aparte para que el conteo del mes no se quede corto.
    await registrarCobroSinAnotar(crudos.length);
    if (esErrorDeMigracion(errorAnotar)) {
      // No es esta tesela: es la base sin el parche 3 del SQL. Google ya
      // cobró esta llamada y los negocios sí se guardaron, pero nada quedó
      // anotado y las 309 siguientes correrían igual — cada una cobrada, y
      // todas por volver a pagar al reanudar. Se frena al cliente con nombre
      // propio (ver MORTALES en useBarrido), a la primera y no a la 310.
      return NextResponse.json({ error: "sin_migracion", cobrada: true }, { status: 500 });
    }
  }

  const resumen: ResumenTesela = {
    encontrados: crudos.length,
    fueraDelArea: crudos.length - enElArea.length,
    sinTelefono: enElArea.length - contactables.length,
    insertados,
    saturada,
    contabilizada: !errorAnotar,
  };

  // EL LIBRO DE CUENTAS DEL BARRIDO. NO BORRAR: esto no es ruido de depuración.
  //
  // Una línea por llamada facturada, en JSON de una sola línea para que el
  // drenaje de logs de Vercel la pueda consultar como datos. Es lo ÚNICO que
  // puede responder "¿por qué me cobró Google US$40 el martes pasado?" — qué
  // territorio, qué tesela, qué vertical, y si lo comprado llegó a la base —
  // sin añadir una tabla nueva ni tocar el esquema. Los fallos van por
  // console.error con este mismo `ctx`, así que las dos mitades del libro se
  // cruzan por `clave`.
  //
  // (Si algún día se barre una ciudad entera, la respuesta correcta es una
  // tabla hija `teselas_barridas` en Postgres; hasta entonces, esto.)
  console.log(JSON.stringify({ evt: "tesela", ...ctx, ...resumen }));

  return NextResponse.json(resumen);
}
