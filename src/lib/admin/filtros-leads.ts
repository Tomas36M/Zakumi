// Los filtros de la lista de leads y del mapa, en un solo sitio: la cara
// Leads los pinta como selects y el mapa como chips, pero el recorte de la
// lista tiene que ser el MISMO (ya pasó una vez que «sin web» no decía lo
// mismo en dos pantallas).

import { esSinWeb, type EstadoNegocio, type Negocio } from "./negocios";

export type FiltroTelefono = "todos" | "con" | "sin";
export type FiltroWeb = "todos" | "sin" | "con";

export type FiltroLeads = {
  /** Texto libre sobre el nombre; se compara sin mayúsculas. */
  q: string;
  ciudad: string | "todas";
  /** Vacío = todos los estados. Lista y no único: el mapa filtra por varios. */
  estados: readonly EstadoNegocio[];
  categoria: string | "todas";
  telefono: FiltroTelefono;
  web: FiltroWeb;
  territorio: string | "todos";
};

export const FILTRO_VACIO: FiltroLeads = Object.freeze({
  q: "",
  ciudad: "todas",
  estados: [],
  categoria: "todas",
  telefono: "todos",
  web: "todos",
  territorio: "todos",
});

export function filtrarLeads(negocios: readonly Negocio[], f: FiltroLeads): Negocio[] {
  const texto = f.q.trim().toLowerCase();
  return negocios.filter((n) => {
    if (f.ciudad !== "todas" && n.ciudad !== f.ciudad) return false;
    if (f.estados.length > 0 && !f.estados.includes(n.estado)) return false;
    if (f.categoria !== "todas" && n.categoria !== f.categoria) return false;
    if (f.telefono === "con" && n.telefono === null) return false;
    if (f.telefono === "sin" && n.telefono !== null) return false;
    if (f.web === "sin" && !esSinWeb(n)) return false;
    if (f.web === "con" && esSinWeb(n)) return false;
    if (f.territorio !== "todos" && n.territorio_id !== f.territorio) return false;
    if (texto && !n.nombre.toLowerCase().includes(texto)) return false;
    return true;
  });
}

/** ¿Hay algo filtrado? Para el botón «Limpiar» y el contador honesto. */
export function hayFiltro(f: FiltroLeads): boolean {
  return (
    f.q.trim() !== "" ||
    f.ciudad !== "todas" ||
    f.estados.length > 0 ||
    f.categoria !== "todas" ||
    f.telefono !== "todos" ||
    f.web !== "todos" ||
    f.territorio !== "todos"
  );
}

/** Las categorías que existen en los datos, ordenadas y sin repetir. */
export function categoriasDe(negocios: readonly Negocio[]): string[] {
  const set = new Set<string>();
  for (const n of negocios) if (n.categoria) set.add(n.categoria);
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

/** El dominio del sitio (sin protocolo ni "www."): una fila necesita algo
 * corto que no rompa el grid, no la URL completa. */
export function dominioDe(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
