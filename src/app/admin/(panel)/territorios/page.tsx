import { redirect } from "next/navigation";
import { paginaDesdeParam, rangoDePagina, TERRITORIOS_POR_PAGINA } from "@/lib/admin/paginacion";
import { TerritoriosView } from "@/components/admin/territorios/TerritoriosView";
import { verifySession } from "@/lib/admin/dal";
import { cuentasTerritoriosServidor, type Territorio } from "@/lib/admin/territorios";

export const metadata = { title: "Territorios" };

export default async function TerritoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  // Next 16: los layouts NO se re-renderizan — el check va en CADA page.
  const { supabase } = await verifySession();

  const { pagina: paginaParam } = await searchParams;
  const pagina = paginaDesdeParam(paginaParam);
  const [desde, hasta] = rangoDePagina(pagina, TERRITORIOS_POR_PAGINA);

  const [territoriosRes, totalLeadsRes] = await Promise.all([
    supabase
      .from("territorios")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(desde, hasta),
    // Total de leads en TODOS los territorios, independiente de la página:
    // la cifra del header no puede ser "los leads de esta página" sin
    // decirlo — sería una cuenta que parece el total y no lo es.
    supabase
      .from("negocios")
      .select("*", { count: "exact", head: true })
      .not("territorio_id", "is", null),
  ]);
  if (territoriosRes.error) console.error("[territorios] lista:", territoriosRes.error.message);
  if (totalLeadsRes.error) {
    console.error("[territorios] total de leads:", totalLeadsRes.error.message);
  }

  const filas = (territoriosRes.data as Territorio[]) ?? [];
  const totalTerritorios = territoriosRes.count ?? 0;
  const totalPaginasReal = Math.ceil(totalTerritorios / TERRITORIOS_POR_PAGINA);

  // ?pagina= más allá de lo que existe: no es "no hay territorios", es un
  // link viejo o una página escrita a mano — a la última página válida, no
  // a una pantalla vacía que miente.
  if (territoriosRes.error === null && totalTerritorios > 0 && pagina > totalPaginasReal) {
    redirect(`/admin/territorios?pagina=${totalPaginasReal}`);
  }

  // Cuentas exactas por territorio (count en el servidor): solo de esta
  // página — el grid es una lista de cifras y no puede heredar el tope de
  // 900 de la pantalla del mapa.
  const cuentas = territoriosRes.error ? null : await cuentasTerritoriosServidor(supabase, filas);

  return (
    <TerritoriosView
      territorios={filas}
      cuentas={cuentas}
      fallaTerritorios={territoriosRes.error !== null}
      pagina={pagina}
      totalPaginas={Math.max(1, totalPaginasReal)}
      totalTerritorios={totalTerritorios}
      totalLeadsGlobal={totalLeadsRes.error ? null : (totalLeadsRes.count ?? 0)}
    />
  );
}
