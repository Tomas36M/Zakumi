import { ClientesView } from "@/components/admin/clientes/ClientesView";
import { verifySession } from "@/lib/admin/dal";
import type { Cliente, ProductoConCliente } from "@/lib/admin/cartera";

export const metadata = { title: "Clientes" };

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { supabase } = await verifySession();
  const { cliente } = await searchParams;

  const [productosRes, clientesRes] = await Promise.all([
    supabase
      .from("productos_contratados")
      .select("*, clientes(id, nombre)")
      .order("proxima_fecha", { ascending: true }),
    supabase.from("clientes").select("*").order("created_at", { ascending: false }),
  ]);

  if (productosRes.error) {
    console.error("[clientes] productos:", productosRes.error.message);
  }
  if (clientesRes.error) {
    console.error("[clientes] clientes:", clientesRes.error.message);
  }

  return (
    <ClientesView
      productos={(productosRes.data as ProductoConCliente[]) ?? []}
      clientes={(clientesRes.data as Cliente[]) ?? []}
      abrirInicial={cliente ?? null}
    />
  );
}
