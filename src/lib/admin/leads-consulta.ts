// La lista de Leads pagina contra la base: el navegador pide cada página a
// GET /admin/api/leads con los filtros en el querystring. Aquí vive lo que
// comparten la ruta y la lista —el contrato de la respuesta y la traducción
// filtro ↔ querystring— para que los dos lados no puedan decir cosas distintas.

import type { SupabaseClient } from "@supabase/supabase-js";
import { categoriasDe, FILTRO_VACIO, type FiltroLeads } from "./filtros-leads";
import { ciudadesDe, ESTADOS, type EstadoNegocio, type Negocio } from "./negocios";
import { paginaDesdeParam } from "./paginacion";
import { patronBusqueda } from "./zak";

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

/**
 * La consulta de negocios sobre la que se aplican los filtros: con filas, o
 * solo el conteo (`head: true` no trae filas y no le afecta el tope de 1.000).
 *
 * Existe para darle NOMBRE al tipo del query builder: una interfaz genérica
 * sobre el builder de supabase-js no compila (TS2589, instanciación demasiado
 * profunda); con este tipo concreto sí.
 */
export function consultaNegocios(supabase: SupabaseClient, soloConteo: boolean) {
  return soloConteo
    ? supabase.from("negocios").select("*", { count: "exact", head: true })
    : supabase.from("negocios").select("*");
}

export type ConsultaNegocios = ReturnType<typeof consultaNegocios>;

/**
 * Los mismos recortes que `filtrarLeads` hace en memoria, hechos por la base.
 * `sinEstado` deja fuera el de estado: la franja cuenta cada estado con todos
 * los demás filtros aplicados.
 */
export function aplicarFiltros(
  query: ConsultaNegocios,
  filtro: FiltroLeads,
  { sinEstado = false }: { sinEstado?: boolean } = {},
): ConsultaNegocios {
  let q = query;
  if (filtro.ciudad !== FILTRO_VACIO.ciudad) q = q.eq("ciudad", filtro.ciudad);
  if (filtro.categoria !== FILTRO_VACIO.categoria) q = q.eq("categoria", filtro.categoria);
  if (filtro.territorio !== FILTRO_VACIO.territorio) q = q.eq("territorio_id", filtro.territorio);
  if (!sinEstado && filtro.estados.length > 0) q = q.in("estado", [...filtro.estados]);
  if (filtro.telefono === "con") q = q.not("telefono", "is", null);
  if (filtro.telefono === "sin") q = q.is("telefono", null);
  // «Sin web» es `sitio_web is null`: los dos escritores de la columna la
  // normalizan con `urlHttpONull` (URL válida o null), así que coincide con
  // `esSinWeb` y con la RPC `cuentas_por_territorio`.
  if (filtro.web === "sin") q = q.is("sitio_web", null);
  if (filtro.web === "con") q = q.not("sitio_web", "is", null);
  const texto = filtro.q.trim();
  if (texto) q = q.ilike("nombre", patronBusqueda(texto));
  return q;
}

/** El total filtrado sale de sumar los conteos por estado: los del estado
 * elegido o, sin estado, los seis. Así la ruta no gasta un conteo más. */
export function totalDeConteos(
  conteos: Record<EstadoNegocio, number>,
  estados: readonly EstadoNegocio[],
): number {
  const cuales: readonly EstadoNegocio[] = estados.length > 0 ? estados : ESTADOS.map((e) => e.valor);
  return cuales.reduce((suma, e) => suma + conteos[e], 0);
}

/** Las opciones de los selects desde las filas leídas (solo ciudad y categoría). */
export function opcionesDe(filas: readonly Pick<Negocio, "ciudad" | "categoria">[]): OpcionesLeads {
  return { ciudades: ciudadesDe(filas), categorias: categoriasDe(filas) };
}

/** Qué tramo del total está en pantalla («del 51 al 100»); null sin filas. */
export function rangoEnPantalla(
  pagina: number,
  filas: number,
  porPagina: number,
): { desde: number; hasta: number } | null {
  if (filas === 0) return null;
  const desde = (pagina - 1) * porPagina + 1;
  return { desde, hasta: desde + filas - 1 };
}
