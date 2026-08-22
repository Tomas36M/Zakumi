import { notFound } from "next/navigation";
import { verifySession } from "@/lib/admin/dal";
import { hoyBogota, type Cliente, type Pago, type ProductoContratado } from "@/lib/admin/cartera";
import { statusInstancia } from "@/lib/bots/api";
import type { StatusInstancia } from "@/lib/bots/tipos";
import { Ficha360 } from "@/components/admin/clientes/Ficha360";
import { AccesoPortal } from "@/components/admin/clientes/AccesoPortal";
import type { PerfilBuscado } from "@/lib/admin/perfiles-actions";

export const metadata = { title: "Ficha del cliente" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Cliente360Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await verifySession();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [clienteRes, productosRes] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).single(),
    supabase
      .from("productos_contratados")
      .select("*")
      .eq("cliente_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (clienteRes.error || !clienteRes.data) notFound();
  if (productosRes.error) {
    console.error("[cliente360] productos:", productosRes.error.message);
  }
  const productos = (productosRes.data as ProductoContratado[]) ?? [];

  // Estado vivo de los bots vinculados (instancia_id numérico = id en Railway).
  // Degradable: si Railway cae, la ficha carga igual con "sin conexión".
  const instanciasVinculadas = [
    ...new Set(
      productos
        .filter((p) => p.activo && p.instancia_id && /^\d+$/.test(p.instancia_id))
        .map((p) => p.instancia_id as string),
    ),
  ];

  const [pagosRes, ...statusRes] = await Promise.all([
    productos.length > 0
      ? supabase
          .from("pagos")
          .select("*")
          .in(
            "producto_id",
            productos.map((p) => p.id),
          )
          .order("fecha", { ascending: false })
      : Promise.resolve({ data: [] as Pago[], error: null }),
    ...instanciasVinculadas.map((iid) => statusInstancia(Number(iid))),
  ]);

  if (pagosRes.error) {
    console.error("[cliente360] pagos:", pagosRes.error.message);
  }

  const botStatus: Record<string, StatusInstancia | null> = {};
  instanciasVinculadas.forEach((iid, i) => {
    const r = statusRes[i];
    botStatus[iid] = r?.ok ? r.data : null;
  });

  const cliente = clienteRes.data as Cliente;

  // Acceso al portal: cuentas ya vinculadas + sugerencia por email igual.
  const aPerfil = (p: Record<string, unknown>): PerfilBuscado => ({
    userId: p.user_id as string,
    email: (p.email as string | null) ?? null,
    nombre: (p.nombre as string | null) ?? null,
    clienteId: (p.cliente_id as string | null) ?? null,
  });
  const [vinculadosRes, sugerenciaRes] = await Promise.all([
    supabase
      .from("perfiles")
      .select("user_id, email, nombre, cliente_id")
      .eq("cliente_id", id),
    cliente.email
      ? supabase
          .from("perfiles")
          .select("user_id, email, nombre, cliente_id")
          .ilike("email", cliente.email)
          .is("cliente_id", null)
          .eq("rol", "cliente")
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const vinculados = (vinculadosRes.data ?? []).map(aPerfil);
  const sugerencia = sugerenciaRes.data ? aPerfil(sugerenciaRes.data) : null;

  return (
    <>
      <Ficha360
        cliente={cliente}
        productos={productos}
        pagos={(pagosRes.data as Pago[]) ?? []}
        botStatus={botStatus}
        hoy={hoyBogota()}
      />
      <section className="px-5 pb-4">
        <AccesoPortal
          clienteId={id}
          vinculados={vinculados}
          sugerencia={sugerencia}
        />
      </section>
    </>
  );
}
