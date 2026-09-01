import { ProspeccionView } from "@/components/admin/prospeccion/ProspeccionView";
import { verifySession } from "@/lib/admin/dal";
import type { Negocio } from "@/lib/admin/negocios";
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

  const [negocios, territorios] = await Promise.all([
    supabase.from("negocios").select("*").order("created_at", { ascending: false }),
    supabase.from("territorios").select("*").order("created_at", { ascending: false }),
  ]);

  // Cada mitad degrada por su lado: sin la tabla `territorios` (migración sin
  // aplicar) la pantalla abre igual con el mapa y los leads.
  if (negocios.error) console.error("[prospección] negocios:", negocios.error.message);
  if (territorios.error) console.error("[prospección] territorios:", territorios.error.message);

  return (
    <ProspeccionView
      tab={tab ?? null}
      negocios={(negocios.data as Negocio[]) ?? []}
      territorios={(territorios.data as Territorio[]) ?? []}
    />
  );
}
