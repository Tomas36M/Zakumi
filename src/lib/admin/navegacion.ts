// Qué entrada del menú lateral está activa. «Negocios» no es una pantalla
// propia: es la cara Leads de Encontrar clientes. Las dos entradas comparten
// ruta y solo la pestaña (?tab=) las distingue.

import { caraDe } from "./prospeccion-caras";

const PROSPECCION = "/admin/prospeccion";

export function seccionActiva(href: string, pathname: string, tab: string | null): boolean {
  const [ruta, consulta] = href.split("?");
  if (ruta === PROSPECCION) {
    if (!pathname.startsWith(PROSPECCION)) return false;
    const caraDelEnlace = caraDe(new URLSearchParams(consulta ?? "").get("tab"));
    return caraDe(tab) === caraDelEnlace;
  }
  return pathname.startsWith(ruta);
}
