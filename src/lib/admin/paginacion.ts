// Paginación de listas que viven en Supabase: sanear el ?pagina= de la URL
// y calcular el rango de PostgREST (.range(), inclusive en ambos extremos).
// Lógica pura y genérica a propósito — la primera lista de este panel que
// pagina de verdad (a diferencia del tope+conteo de negocios en
// Prospección), para que la próxima que lo necesite no reinvente esto.

export const TERRITORIOS_POR_PAGINA = 25;

/** La lista de Leads pagina de a 50: una página es exactamente una tanda de Zak
 * (`TANDA_MAX_BOT`), así «seleccionar la página» cabe en un envío. */
export const LEADS_POR_PAGINA = 50;

/**
 * Sanea el ?pagina= de la URL: cualquier cosa que no sea un entero ≥ 1 cae
 * a la página 1 — un link viejo o un valor escrito a mano nunca revienta la
 * pantalla, solo la manda al principio.
 */
export function paginaDesdeParam(valor: string | undefined): number {
  if (valor === undefined) return 1;
  const n = Number(valor);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** El rango [desde, hasta] para `.range()` de Supabase/PostgREST. */
export function rangoDePagina(pagina: number, porPagina: number): [number, number] {
  const desde = (pagina - 1) * porPagina;
  return [desde, desde + porPagina - 1];
}
