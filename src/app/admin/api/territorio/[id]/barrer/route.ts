import { NextResponse } from "next/server";
import { getSesionAdmin } from "@/lib/admin/dal";
import { claveTesela, claveTrabajo, esSaturada, type Punto } from "@/lib/admin/barrido";
import {
  circuloDentroDelTerritorio,
  recortarAlArea,
  type ResumenTesela,
} from "@/lib/admin/barrido-servidor";
import {
  placeANegocio,
  soloConTelefono,
  urlHttpONull,
  type PlaceApi,
} from "@/lib/admin/places";
import type { Territorio } from "@/lib/admin/territorios";
import { tiposDeVertical } from "@/lib/admin/verticales-places";

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

  const { data: fila, error: errorTerritorio } = await sesion.supabase
    .from("territorios")
    .select("*")
    .eq("id", id)
    .single();

  if (errorTerritorio || !fila) {
    return NextResponse.json({ error: "territorio_no_encontrado" }, { status: 404 });
  }
  const territorio = fila as Territorio;

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
      signal: AbortSignal.timeout(10_000),
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
    console.error("[barrido] fallo de red hacia Google:", error);
    return NextResponse.json({ error: "places_error" }, { status: 502 });
  }

  if (!respuesta.ok) {
    // El detalle va al log del servidor; el body de Google nunca al browser.
    console.error(
      `[barrido] Google respondió ${respuesta.status}:`,
      await respuesta.text().catch(() => "(sin body)"),
    );
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
    console.error("[barrido] respuesta de Google ilegible:", error);
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
        // Mismo saneo que importarNegocios, y por la misma razón elevada al
        // cuadrado: este es hoy el escritor PRINCIPAL de `negocios`.
        //   · `nombre` tiene check (length between 1 and 300) en la base: UN
        //     nombre largo de Google tumbaba el upsert ENTERO — tesela cobrada
        //     y los otros 19 negocios perdidos.
        //   · `sitio_web` se pinta tal cual en un <a href> de NegociosView y
        //     FichaNegocio: pasa por urlHttpONull o no pasa.
        contactables.map((r) => ({
          nombre: r.nombre.trim().slice(0, 300) || "(sin nombre)",
          direccion: r.direccion,
          ciudad: r.ciudad,
          lat: r.lat,
          lng: r.lng,
          categoria: r.categoria,
          rating: r.rating,
          sitio_web: urlHttpONull(r.sitioWeb),
          telefono: r.telefono,
          tipo_telefono: r.tipoTelefono,
          google_place_id: r.placeId,
          fuente: "places" as const,
          territorio_id: territorio.id,
        })),
        { onConflict: "google_place_id", ignoreDuplicates: true },
      )
      .select("id");

    if (error) {
      // 502 a propósito (no un 200 con contabilizada:false): los negocios NO
      // se guardaron, así que la tesela tiene que poder reintentarse. Pero la
      // llamada a Google YA se cobró y anotar_tesela nunca corrió: `cobrada`
      // se lo dice al cliente, que lo suma al mismo contador de "cobrado y no
      // contabilizado". Un gasto invisible es la única cosa peor que un error.
      console.error("[barrido] error insertando negocios:", error.message);
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
  const clave = claveTrabajo({ centro, radio, clave: claveTesela(centro, radio) }, vertical);
  const { error: errorAnotar } = await sesion.supabase.rpc("anotar_tesela", {
    p_territorio: territorio.id,
    p_clave: clave,
    p_vertical: vertical,
    p_saturada: saturada,
  });

  if (errorAnotar) {
    // La llamada ya se cobró y los negocios ya se guardaron: no hay reintento
    // seguro (reintentar la duplicaría en la factura de Google). Se avisa vía
    // `contabilizada: false` — el cliente lo suma y avisa, ver Task 10 — en
    // vez de convertir esto en una respuesta de error.
    console.error("[barrido] error anotando tesela:", errorAnotar.message);
  }

  const resumen: ResumenTesela = {
    encontrados: crudos.length,
    fueraDelArea: crudos.length - enElArea.length,
    sinTelefono: enElArea.length - contactables.length,
    insertados,
    saturada,
    contabilizada: !errorAnotar,
  };
  return NextResponse.json(resumen);
}
