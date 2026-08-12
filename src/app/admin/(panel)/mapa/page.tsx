import { MapaView } from "@/components/admin/mapa/MapaView";
import { verifySession } from "@/lib/admin/dal";
import type { Negocio } from "@/lib/admin/negocios";

export const metadata = { title: "Mapa" };

export default async function MapaPage() {
  const { supabase } = await verifySession();

  const { data, error } = await supabase
    .from("negocios")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[mapa] error cargando negocios:", error.message);
  }

  return <MapaView negocios={(data as Negocio[]) ?? []} />;
}
