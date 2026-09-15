import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSesionAdmin } from "@/lib/admin/dal";
import {
  aplicarFiltros,
  consultaNegocios,
  filtroDesdeParams,
  opcionesDe,
  totalDeConteos,
  type OpcionesLeads,
  type RespuestaLeads,
} from "@/lib/admin/leads-consulta";
import { ESTADOS, type EstadoNegocio, type Negocio } from "@/lib/admin/negocios";
import { acotarPagina, LEADS_POR_PAGINA, rangoDePagina } from "@/lib/admin/paginacion";

/** El techo de filas por consulta de PostgREST (*Max rows* del proyecto). */
const FILAS_POR_LECTURA = 1000;
/** Lecturas máximas para las opciones: 50.000 negocios. Pasado eso toca una
 * RPC con `distinct` (ver «Límites» en el spec). */
const MAX_LECTURAS_OPCIONES = 50;

/**
 * Una página de la lista de Leads con sus cifras, contra la base entera.
 *
 * - `conteos`: seis conteos `head` en paralelo, con todos los filtros menos el
 *   de estado (la franja de estados). Sumados dan `total`.
 * - `filas`: la página pedida o, si se pidió una más allá, la última que existe.
 * - `opciones` (solo con `opciones=1`): ciudades y categorías del territorio
 *   filtrado. Si esa lectura falla, la respuesta sale sin ellas.
 *
 * Lectura = route handler: una server action se encolaría detrás de las
 * mutaciones en cada cambio de filtro.
 */
export async function GET(request: Request) {
  const sesion = await getSesionAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const { filtro, pagina } = filtroDesdeParams(params);
  const { supabase } = sesion;

  const cuentas = await Promise.all(
    ESTADOS.map((e) =>
      aplicarFiltros(consultaNegocios(supabase, true), filtro, { sinEstado: true }).eq("estado", e.valor),
    ),
  );
  const fallida = cuentas.find((c) => c.error);
  if (fallida?.error) {
    console.error("[api/leads] conteos:", fallida.error.message);
    return NextResponse.json({ error: "crm" }, { status: 502 });
  }
  const conteos = Object.fromEntries(
    ESTADOS.map((e, i) => [e.valor, cuentas[i]?.count ?? 0]),
  ) as Record<EstadoNegocio, number>;
  const total = totalDeConteos(conteos, filtro.estados);
  const paginaReal = acotarPagina(pagina, total, LEADS_POR_PAGINA);
  const [desde, hasta] = rangoDePagina(paginaReal, LEADS_POR_PAGINA);

  const [filas, opciones] = await Promise.all([
    // Desempate por id: un barrido inserta muchas filas con la misma fecha, y
    // sin él las páginas repetirían o saltarían filas.
    aplicarFiltros(consultaNegocios(supabase, false), filtro)
      .order("created_at", { ascending: false })
      .order("id")
      .range(desde, hasta),
    params.get("opciones") === "1" ? leerOpciones(supabase, filtro.territorio) : Promise.resolve(null),
  ]);
  if (filas.error) {
    console.error("[api/leads] filas:", filas.error.message);
    return NextResponse.json({ error: "crm" }, { status: 502 });
  }

  const cuerpo: RespuestaLeads = {
    filas: (filas.data ?? []) as Negocio[],
    total,
    pagina: paginaReal,
    conteos,
    ...(opciones ? { opciones } : {}),
  };
  return NextResponse.json(cuerpo);
}

/** Ciudades y categorías distintas del territorio (o de toda la base), leídas
 * de a 1000 filas. `null` si la base falló: la lista las vuelve a pedir. */
async function leerOpciones(supabase: SupabaseClient, territorio: string): Promise<OpcionesLeads | null> {
  const filas: Pick<Negocio, "ciudad" | "categoria">[] = [];
  for (let lectura = 0; lectura < MAX_LECTURAS_OPCIONES; lectura++) {
    const [desde, hasta] = rangoDePagina(lectura + 1, FILAS_POR_LECTURA);
    // Un builder nuevo por vuelta: el de supabase-js acumula sus parámetros.
    const base = supabase.from("negocios").select("ciudad, categoria");
    const consulta = territorio === "todos" ? base : base.eq("territorio_id", territorio);
    const { data, error } = await consulta.order("id").range(desde, hasta);
    if (error) {
      console.error("[api/leads] opciones:", error.message);
      return null;
    }
    const lote = (data ?? []) as Pick<Negocio, "ciudad" | "categoria">[];
    filas.push(...lote);
    if (lote.length < FILAS_POR_LECTURA) break;
  }
  return opcionesDe(filas);
}
