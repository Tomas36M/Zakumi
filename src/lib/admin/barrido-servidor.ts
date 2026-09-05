import { METROS_POR_GRADO_LAT, puntoEnPoligono, type Punto } from "./barrido";
import type { ResultadoPlace } from "./places";
import type { Territorio } from "./territorios";

export type ResumenTesela = {
  encontrados: number;
  fueraDelArea: number;
  sinTelefono: number;
  insertados: number;
  saturada: boolean;
  /** false si la llamada se hizo y los negocios se guardaron pero la anotación
   * en el territorio falló: se cobró y no quedó contabilizada. El cliente lo
   * suma y avisa — callar un cobro no contabilizado es mentirle al usuario
   * sobre lo que gastó. */
  contabilizada: boolean;
};

export const RADIO_MIN = 50;
export const RADIO_MAX = 1_000;

/** Lo único que mira la guarda de gasto: las cuatro columnas de la caja.
 *
 * Se pide así de estrecho para que el handler pueda seleccionar SOLO las
 * columnas que usa. `territorios` lleva `teselas_hechas` y `teselas_saturadas`,
 * dos arrays que CRECEN mientras el barrido avanza; traerse la fila entera en
 * cada una de las miles de llamadas hace que el tráfico crezca con el cuadrado
 * de la longitud del barrido. Un `Territorio` completo sigue encajando. */
export type CajaTerritorio = Pick<
  Territorio,
  "bbox_sur" | "bbox_norte" | "bbox_oeste" | "bbox_este"
>;

/** El endpoint recibe el círculo del cliente, así que hay que atarlo al
 * territorio guardado: si no, es un proxy con el que barrer Colombia entera a
 * nombre de Zakumi. Se admite desbordarse del borde (las teselas se desbordan
 * por diseño) pero no salirse de la caja más de un radio. */
export function circuloDentroDelTerritorio(
  centro: Punto,
  radio: number,
  t: CajaTerritorio,
): boolean {
  if (!Number.isFinite(radio) || radio < RADIO_MIN || radio > RADIO_MAX) return false;
  if (!Number.isFinite(centro.lat) || !Number.isFinite(centro.lng)) return false;

  const margenLat = radio / METROS_POR_GRADO_LAT;
  const margenLng =
    radio / (METROS_POR_GRADO_LAT * Math.cos((centro.lat * Math.PI) / 180));

  return (
    centro.lat >= t.bbox_sur - margenLat &&
    centro.lat <= t.bbox_norte + margenLat &&
    centro.lng >= t.bbox_oeste - margenLng &&
    centro.lng <= t.bbox_este + margenLng
  );
}

/** Los círculos se desbordan del área dibujada; lo de afuera no se guarda. */
export function recortarAlArea(
  resultados: ResultadoPlace[],
  poligono: readonly Punto[],
): ResultadoPlace[] {
  return resultados.filter((r) => puntoEnPoligono({ lat: r.lat, lng: r.lng }, poligono));
}

/** PostgREST devuelve `PGRST202` cuando no existe un RPC con esa firma. Para
 * este handler significa una sola cosa: el código llama a `anotar_tesela` con
 * seis argumentos y la base sigue con la de cuatro — o sea que
 * `supabase/prospeccion-parches.sql` no se corrió ANTES del deploy. No es el
 * fallo de una tesela: fallarían las 310 igual, cada una cobrada por Google y
 * ninguna anotada, y al reanudar se volverían a pagar. Se trata como un error
 * de configuración, igual que la API key ausente: se dice una vez y se frena. */
export function esErrorDeMigracion(
  error: { code?: string; message?: string } | null,
): boolean {
  return error?.code === "PGRST202";
}

/** Una fila de `consultas_places` para una llamada que Google COBRÓ pero que
 * no pasó por `anotar_tesela` — cuerpo ilegible, upsert reventado, RPC caído.
 * La tesela NO se marca como hecha (tiene que poder reintentarse: los negocios
 * no se guardaron), pero el cobro sí queda en el registro del mes. Sin esto,
 * el contador de la cuota se quedaba corto justo en los caminos de fallo, que
 * es donde nadie está mirando. `resultados` es null cuando ni siquiera se pudo
 * leer la respuesta. */
export function filaDeConsultaSinAnotar(
  territorioId: string,
  clave: string,
  vertical: string,
  resultados: number | null,
) {
  return {
    territorio_id: territorioId,
    clave,
    vertical,
    resultados,
    insertados: null,
    origen: "barrido" as const,
  };
}
