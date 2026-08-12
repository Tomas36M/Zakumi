import { NegociosView } from "@/components/admin/negocios/NegociosView";
import { verifySession } from "@/lib/admin/dal";
import type { Negocio } from "@/lib/admin/negocios";

export const metadata = { title: "Negocios" };

export default async function NegociosPage() {
  const { supabase } = await verifySession();

  const { data, error } = await supabase
    .from("negocios")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[negocios] error cargando negocios:", error.message);
  }

  return <NegociosView negocios={(data as Negocio[]) ?? []} />;
}
