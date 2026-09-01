import { ProspeccionView } from "@/components/admin/prospeccion/ProspeccionView";
import { verifySession } from "@/lib/admin/dal";
import { TOPE_LEADS, type Negocio } from "@/lib/admin/negocios";
import type { Territorio } from "@/lib/admin/territorios";

export const metadata = { title: "Encontrar clientes" };

export default async function ProspeccionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  // Next 16: los layouts NO se re-renderizan — el check va en CADA page.
  const { supabase } = await verifySession();
  const { tab } = await searchParams;

  const [negocios, cuenta, territorios] = await Promise.all([
    supabase
      .from("negocios")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(TOPE_LEADS),
    supabase.from("negocios").select("*", { count: "exact", head: true }),
    supabase.from("territorios").select("*").order("created_at", { ascending: false }),
  ]);

  // El detalle del error va al log del servidor; a la vista solo baja el hecho
  // de que falló. Y BAJA: una consulta caída que se degrada a [] en silencio
  // pinta "ningún territorio todavía" sobre territorios que existen y ya están
  // pagados, y quien los redibuje le paga a Google otra vez lo mismo.
  if (negocios.error) console.error("[prospección] negocios:", negocios.error.message);
  if (cuenta.error) console.error("[prospección] cuenta de negocios:", cuenta.error.message);
  if (territorios.error) console.error("[prospección] territorios:", territorios.error.message);

  const filas = (negocios.data as Negocio[]) ?? [];

  return (
    <ProspeccionView
      tab={tab ?? null}
      negocios={filas}
      territorios={(territorios.data as Territorio[]) ?? []}
      // null cuando la cuenta falló: la vista no puede afirmar un total que no
      // sabe, y tampoco puede inventar `filas.length` como si fuera el total.
      negociosTotal={cuenta.error ? null : (cuenta.count ?? null)}
      fallaNegocios={negocios.error !== null}
      fallaTerritorios={territorios.error !== null}
    />
  );
}
