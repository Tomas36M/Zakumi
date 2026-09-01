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
