import { TerritoriosView } from "@/components/admin/territorios/TerritoriosView";
import { verifySession } from "@/lib/admin/dal";
import { cuentasTerritoriosServidor, type Territorio } from "@/lib/admin/territorios";

export const metadata = { title: "Territorios" };

export default async function TerritoriosPage() {
  // Next 16: los layouts NO se re-renderizan — el check va en CADA page.
  const { supabase } = await verifySession();

  const territorios = await supabase
    .from("territorios")
    .select("*")
    .order("created_at", { ascending: false });
  if (territorios.error) console.error("[territorios] lista:", territorios.error.message);
  const filas = (territorios.data as Territorio[]) ?? [];

  // Cuentas exactas por territorio (count en el servidor): el grid es una
  // lista de cifras y no puede heredar el tope de 900 de la pantalla del mapa.
  const cuentas = territorios.error ? null : await cuentasTerritoriosServidor(supabase, filas);

  return (
    <TerritoriosView
      territorios={filas}
      cuentas={cuentas}
      fallaTerritorios={territorios.error !== null}
    />
  );
}
