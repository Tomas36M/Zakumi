import type { SupabaseClient } from "@supabase/supabase-js";
import { cajaDe, PRECIO_POR_LLAMADA_USD, type Punto } from "./barrido";
import { esSinWeb, type Negocio } from "./negocios";

export type Territorio = {
  id: string;
  nombre: string;
  poligono: Punto[];
  bbox_sur: number;
  bbox_norte: number;
  bbox_oeste: number;
  bbox_este: number;
  verticales: string[];
  teselas_hechas: string[];
  /** Claves de trabajo cuyas teselas devolvieron el tope de 20 resultados. Es
   * lo que hace DURABLE la subdivisión: sin esto las 4 hijas de una celda
   * saturada solo viven en la cola del navegador y una recarga las pierde para
   * siempre (la madre ya está en `teselas_hechas`, así que el plan la salta). */
  teselas_saturadas: string[];
  llamadas: number;
  ultimo_barrido: string | null;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
};

export const NOMBRE_MAX = 120;

/** Grados de lado máximos de la caja. ~1.1° ≈ 120 km: más que eso no es un
 * territorio de prospección, es una factura de Google. */
export const LADO_MAX_GRADOS = 1.1;

/** Tope de vértices de un territorio. `celdaTocaPoligono` recorre la lista de
 * vértices ~10 veces POR TESELA, y un bbox del tamaño máximo son decenas de
 * miles de teselas; además `teselar` corre en el navegador para estimar el
 * costo. Un trazo de miles de puntos cuelga la pestaña antes de gastar un peso.
 * Un territorio dibujado a mano no pasa de unas decenas de vértices. */
export const VERTICES_MAX = 500;

export function poligonoValido(poligono: readonly Punto[]): boolean {
  if (poligono.length < 3) return false;
  if (poligono.length > VERTICES_MAX) return false;
  const enElPlaneta = poligono.every(
    (p) =>
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng) &&
      p.lat >= -90 &&
      p.lat <= 90 &&
      p.lng >= -180 &&
      p.lng <= 180,
  );
  if (!enElPlaneta) return false;
  const caja = cajaDe(poligono);
  return (
    caja.norte - caja.sur <= LADO_MAX_GRADOS &&
    caja.este - caja.oeste <= LADO_MAX_GRADOS
  );
}

export function filasDeTerritorio(poligono: Punto[], nombre: string) {
  const caja = cajaDe(poligono);
  return {
    nombre: nombre.trim().slice(0, NOMBRE_MAX),
    poligono,
    bbox_sur: caja.sur,
    bbox_norte: caja.norte,
    bbox_oeste: caja.oeste,
    bbox_este: caja.este,
  };
}

/** Lo que un territorio produjo: leads y cuántos de ellos no tienen web. */
export type CuentaTerritorio = {
  leads: number;
  sinWeb: number;
};

/** El territorio que todavía no produjo nada. Congelada porque la comparten
 * todos los territorios vacíos: nadie puede sumarle un lead por accidente. */
const CUENTA_VACIA: CuentaTerritorio = Object.freeze({ leads: 0, sinWeb: 0 });

/**
 * Cuántos leads produjo cada territorio, en UN solo recorrido de la lista.
 *
 * Existe porque el panel de territorios y la tarjeta del mapa enseñan los
 * MISMOS números: dos bucles sobre `negocios` son dos sitios donde el mismo
 * número puede equivocarse, y en esta pantalla ya pasó una vez con «sin web».
 * Aquí es donde puede estar mal, y es el único sitio.
 */
export function cuentasPorTerritorio(
  negocios: readonly Pick<Negocio, "territorio_id" | "sitio_web">[],
): Map<string, CuentaTerritorio> {
  const mapa = new Map<string, CuentaTerritorio>();
  for (const n of negocios) {
    // Un negocio sin territorio (importado a mano, o cuyo territorio se
    // borró) no es de NINGUNO. Repartirlo sería inventarle censo a un área
    // que nadie barrió.
    if (!n.territorio_id) continue;
    const fila = mapa.get(n.territorio_id);
    if (fila) {
      fila.leads++;
      if (esSinWeb(n)) fila.sinWeb++;
    } else {
      mapa.set(n.territorio_id, { leads: 1, sinWeb: esSinWeb(n) ? 1 : 0 });
    }
  }
  return mapa;
}

/** Todo lo que se sabe de un territorio ya barrido, listo para pintar. */
export type ResumenTerritorio = CuentaTerritorio & {
  llamadas: number;
  /** Lo que se le pagó a Google por este territorio, en dólares. */
  costoUsd: number;
  /** `false` = nunca se barrió. No hay números que enseñar: hay una acción
   * que ofrecer, y la tarjeta del mapa cambia entera por esto. */
  barrido: boolean;
};

/** Los números de UN territorio, sacados de `cuentasPorTerritorio`. */
export function resumenDeTerritorio(
  territorio: Pick<Territorio, "id" | "llamadas" | "ultimo_barrido">,
  cuentas: ReadonlyMap<string, CuentaTerritorio>,
): ResumenTerritorio {
  const cuenta = cuentas.get(territorio.id) ?? CUENTA_VACIA;
  // Un territorio recién creado trae `llamadas` en 0, pero una fila vieja o
  // una lectura degradada puede traerlo nulo: multiplicar null por el precio
  // pinta "US$ 0,00" y multiplicar undefined pinta "US$ NaN".
  const llamadas = territorio.llamadas ?? 0;
  return {
    leads: cuenta.leads,
    sinWeb: cuenta.sinWeb,
    llamadas,
    costoUsd: llamadas * PRECIO_POR_LLAMADA_USD,
    barrido: Boolean(territorio.ultimo_barrido),
  };
}

/** Consultas de BARRIDO facturadas en el mes calendario en curso, según la hora
 * de Bogotá (UTC-5 fijo, sin horario de verano). Es el número que se compara
 * contra `CUOTA_GRATIS_MENSUAL`.
 *
 * Solo `origen = 'barrido'` a propósito: el barrido llama a
 * `places:searchNearby` y la búsqueda de texto suelta a `places:searchText`, y
 * cada uno es un SKU distinto CON SU PROPIA cuota gratis de 1.000 al mes (los
 * Free Usage Cap de Google se listan por fila de SKU, no agrupados). Contarlos
 * juntos haría que 1.000 búsquedas de texto anunciaran "ya se agotaron" y
 * exigieran escribir un monto por un barrido que Google no cobraría: decir "de
 * pago" cuando es gratis miente igual que decir "gratis" cuando se paga. Las
 * filas de `busqueda` se quedan en la tabla — están para la trazabilidad del
 * gasto, y si algún día Google agrupa los cupos se recuentan sin migrar nada.
 *
 * OJO con lo que este número NO es:
 * - Cuenta lo que ESTE panel registró desde que existe la tabla. No ve consumo
 *   anterior a la migración, ni el de nada más que use la misma key de Google,
 *   ni las llamadas que Google cobró pero cuya fila no se llegó a escribir
 *   (cuerpo ilegible, fallo del upsert, fallo de `anotar_tesela`, timeout de
 *   plataforma). O sea: es un PISO del consumo real, no la verdad. La pantalla
 *   debe decir de dónde sale y dejar a mano las métricas de Google.
 * - El mes de Bogotá no es el mes de Google: la fecha de reset de la cuota
 *   gratis de Google está en UTC sin cambios estacionales, así que pasa a horas
 *   distintas según la zona. El recuento es una aproximación, especialmente en
 *   los bordes del mes. */
export async function consultasDelMes(
  supabase: SupabaseClient,
): Promise<number | null> {
  const ahora = new Date();
  const bogota = new Date(ahora.getTime() - 5 * 3_600_000);
  const desde = new Date(Date.UTC(
    bogota.getUTCFullYear(), bogota.getUTCMonth(), 1, 5, 0, 0,
  ));

  const { count, error } = await supabase
    .from("consultas_places")
    .select("*", { count: "exact", head: true })
    .eq("origen", "barrido")
    .gte("creado_en", desde.toISOString());

  if (error) {
    console.error("[territorios] error contando consultas del mes:", error.message);
    return null; // null = "no sé", que la vista debe distinguir de 0
  }
  return count ?? 0;
}
