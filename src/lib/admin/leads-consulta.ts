// La lista de Leads pagina contra la base: el navegador pide cada página a
// GET /admin/api/leads con los filtros en el querystring. Aquí vive lo que
// comparten la ruta y la lista —el contrato de la respuesta y la traducción
// filtro ↔ querystring— para que los dos lados no puedan decir cosas distintas.

import { FILTRO_VACIO, type FiltroLeads } from "./filtros-leads";
import { ESTADOS, type EstadoNegocio, type Negocio } from "./negocios";
import { paginaDesdeParam } from "./paginacion";

/** Los valores que existen en la base para los selects de ciudad y categoría. */
export type OpcionesLeads = { ciudades: string[]; categorias: string[] };

/** Lo que responde GET /admin/api/leads. */
export type RespuestaLeads = {
  /** La página respondida, de la más reciente a la más antigua. */
  filas: Negocio[];
  /** Cuántos negocios de la base cumplen TODOS los filtros. */
  total: number;
  /** La página que de verdad se respondió (la última, si se pidió una más allá). */
  pagina: number;
  /** Cuántos hay en cada estado con todos los filtros MENOS el de estado. */
  conteos: Record<EstadoNegocio, number>;
  /** Solo cuando se pidió con `opciones=1` y la lectura no falló. */
  opciones?: OpcionesLeads;
};

const LARGO_MAX_TEXTO = 80;
const ESTADOS_VALIDOS = new Set<string>(ESTADOS.map((e) => e.valor));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * El filtro y la página desde el querystring. Todo lo que llega del navegador
 * se sanea: lo que no es un valor válido cae al valor por defecto, nunca a un
 * error de la base.
 */
export function filtroDesdeParams(params: URLSearchParams): { filtro: FiltroLeads; pagina: number } {
  const estado = params.get("estado");
  const telefono = params.get("telefono");
  const web = params.get("web");
  const territorio = params.get("territorio");
  return {
    filtro: {
      q: (params.get("q") ?? "").trim().slice(0, LARGO_MAX_TEXTO).trim(),
      ciudad: params.get("ciudad") || FILTRO_VACIO.ciudad,
      estados: estado !== null && ESTADOS_VALIDOS.has(estado) ? [estado as EstadoNegocio] : [],
      categoria: params.get("categoria") || FILTRO_VACIO.categoria,
      telefono: telefono === "con" || telefono === "sin" ? telefono : "todos",
      web: web === "con" || web === "sin" ? web : "todos",
      territorio: territorio !== null && UUID.test(territorio) ? territorio : FILTRO_VACIO.territorio,
    },
    pagina: paginaDesdeParam(params.get("pagina") ?? undefined),
  };
}

/**
 * El querystring de un filtro: solo las claves que se apartan del valor por
 * defecto, en un orden fijo (la lista usa el texto como clave de su consulta).
 * La lista filtra por UN estado: de `estados` viaja el primero.
 */
export function paramsDeFiltro(filtro: FiltroLeads, pagina: number): URLSearchParams {
  const params = new URLSearchParams();
  const q = filtro.q.trim();
  const estado = filtro.estados[0];
  if (q) params.set("q", q);
  if (estado) params.set("estado", estado);
  if (filtro.ciudad !== FILTRO_VACIO.ciudad) params.set("ciudad", filtro.ciudad);
  if (filtro.categoria !== FILTRO_VACIO.categoria) params.set("categoria", filtro.categoria);
  if (filtro.telefono !== "todos") params.set("telefono", filtro.telefono);
  if (filtro.web !== "todos") params.set("web", filtro.web);
  if (filtro.territorio !== FILTRO_VACIO.territorio) params.set("territorio", filtro.territorio);
  if (pagina > 1) params.set("pagina", String(pagina));
  return params;
}
