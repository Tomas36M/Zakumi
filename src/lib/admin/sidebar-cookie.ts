// La preferencia "sidebar colapsado" viaja en una cookie y no en localStorage:
// el layout del panel la lee en el servidor y pinta el estado real desde el
// primer byte. Con localStorage el sidebar arrancaba SIEMPRE expandido y
// saltaba a colapsado al hidratar — el "no colapsa" que se veía al recargar.
//
// Puro (sin `document`) para poder probarlo; el store del cliente lo envuelve.

export const COOKIE_SIDEBAR = "zk-sidebar";
/** Un año: es una preferencia de UI, no una sesión. */
export const COOKIE_SIDEBAR_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * El valor de `nombre` dentro de un `document.cookie` (pares `a=b` separados
 * por `;`). Compara el nombre exacto: `zk-sidebar-otra` NO es `zk-sidebar`.
 */
export function valorDeCookie(cookies: string, nombre: string): string | undefined {
  for (const par of cookies.split(";")) {
    const i = par.indexOf("=");
    if (i === -1) continue;
    if (par.slice(0, i).trim() !== nombre) continue;
    try {
      return decodeURIComponent(par.slice(i + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Solo "1" colapsa; cualquier otra cosa (ausente, "0", basura) = expandido. */
export function colapsadoDeCookie(valor: string | undefined): boolean {
  return valor === "1";
}

/** La cadena que se asigna a `document.cookie` al alternar. */
export function cookieSidebar(colapsado: boolean): string {
  return `${COOKIE_SIDEBAR}=${colapsado ? "1" : "0"}; path=/; max-age=${COOKIE_SIDEBAR_MAX_AGE}; SameSite=Lax`;
}
