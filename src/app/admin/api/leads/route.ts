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

/** Filas por lectura de las opciones: por debajo del *Max rows* del proyecto
 * (1.000), por el mismo motivo que `TOPE_LEADS` es 900: que el límite que
 * manda sea el que está escrito aquí, y que una lectura corta signifique que
 * se acabaron las filas y no que recortó el servidor. */
const FILAS_POR_LECTURA = 900;
/** Lecturas máximas para las opciones (45.000 negocios). Pasado eso toca una
 * RPC con `distinct` (ver «Límites» en el spec); llegar al tope queda en el log. */
const MAX_LECTURAS_OPCIONES = 50;

/**
 * Una página de la lista de Leads con sus cifras, contra la base entera.
 *
 * - `conteos`: seis conteos `head` en paralelo, con todos los filtros menos el
 *   de estado (la franja de estados). Sumados dan `total`.
 * - `filas`: la página pedida o, si se pidió una más allá, la última que existe.
 * - `opciones` (solo con `opciones=1`): ciudades y categorías del territorio
 *   filtrado. Arrancan junto con los conteos; si fallan, la respuesta sale sin
 *   ellas.
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

  // Las opciones no dependen de los conteos: arrancan ya y no frenan las filas
  // más de lo que tarden ellas mismas.
  const opcionesPedidas =
    params.get("opciones") === "1"
      ? leerOpciones(supabase, filtro.territorio).catch((e: unknown) => {
          console.error("[api/leads] opciones:", e instanceof Error ? e.message : e);
          return null;
        })
      : Promise.resolve(null);

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
    opcionesPedidas,
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
 * de a 900 filas. `null` si la base falló: la lista las vuelve a pedir. */
async function leerOpciones(supabase: SupabaseClient, territorio: string): Promise<OpcionesLeads | null> {
  const filas: Pick<Negocio, "ciudad" | "categoria">[] = [];
  for (let lectura = 0; lectura < MAX_LECTURAS_OPCIONES; lectura++) {
    const [desde, hasta] = rangoDePagina(lectura + 1, FILAS_POR_LECTURA);
    // Un builder nuevo por vuelta: el de supabase-js acumula sus parámetros.
    const base = supabase.from("negocios").select("ciudad, categoria");
    const consulta = territorio === "todos" ? base : base.eq("territorio_id", territorio);
    // Por fecha de creación: lo que un barrido inserte mientras tanto cae al
    // final y no corre las filas de las lecturas que ya se hicieron.
    const { data, error } = await consulta.order("created_at").order("id").range(desde, hasta);
    if (error) {
      console.error("[api/leads] opciones:", error.message);
      return null;
    }
    const lote = (data ?? []) as Pick<Negocio, "ciudad" | "categoria">[];
    filas.push(...lote);
    if (lote.length < FILAS_POR_LECTURA) return opcionesDe(filas);
  }
  console.warn(
    `[api/leads] opciones: se llegó al tope de ${MAX_LECTURAS_OPCIONES} lecturas; ciudades y categorías pueden estar incompletas`,
  );
  return opcionesDe(filas);
}
