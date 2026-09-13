import { ClientesView, type VistaClientes } from "@/components/admin/clientes/ClientesView";
import { verifySession } from "@/lib/admin/dal";
import type { Cliente, ProductoConCliente } from "@/lib/admin/cartera";
import { hoyBogota } from "@/lib/admin/formato";

export const metadata = { title: "Clientes" };

/** `?tab=` desconocido cae a cobros: es lo que Tomás mira a diario. */
function vistaDe(tab: string | undefined): VistaClientes {
  return tab === "clientes" ? "clientes" : "cobros";
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { supabase } = await verifySession();
  // `?cliente=` lo lee la vista desde la URL (useParametroUrl): abre la ficha.
  const { tab } = await searchParams;

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
      vistaInicial={vistaDe(tab)}
      // "Hoy" se decide en el servidor: en el cliente sería `new Date()` en
      // render, que el React Compiler marca y que además cambia entre
      // servidor y navegador a medianoche.
      hoy={hoyBogota()}
    />
  );
}
