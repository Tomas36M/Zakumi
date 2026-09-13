// El único mecanismo de deep-link del panel (`?tab=`, `?lead=`, `?cita=`…):
// una función pura que reescribe UN parámetro y deja los demás como estaban.
// La escribe `useParametroUrl` con `history.replaceState` — sin volver al
// servidor y sin ensuciar el historial con cada pestaña que se toca.

/**
 * `search` es lo que trae `window.location.search` (con o sin `?`). `null`
 * o cadena vacía quitan la clave. Devuelve "" o "?a=b&c=d", listo para pegar
 * detrás del pathname.
 */
export function conParametro(search: string, clave: string, valor: string | null): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (valor === null || valor === "") params.delete(clave);
  else params.set(clave, valor);
  const s = params.toString();
  return s === "" ? "" : `?${s}`;
}
