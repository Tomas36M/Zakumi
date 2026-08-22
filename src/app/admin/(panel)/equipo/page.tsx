import type { Metadata } from "next";
import { verifySession } from "@/lib/admin/dal";
import type { PerfilBuscado } from "@/lib/admin/perfiles-actions";
import { EquipoView } from "@/components/admin/equipo/EquipoView";

export const metadata: Metadata = { title: "Equipo" };

export default async function EquipoPage() {
  const sesion = await verifySession();

  const { data } = await sesion.supabase
    .from("perfiles")
    .select("user_id, email, nombre, cliente_id")
    .eq("rol", "admin")
    .order("email", { ascending: true });

  const admins: PerfilBuscado[] = (data ?? []).map((p) => ({
    userId: p.user_id as string,
    email: (p.email as string | null) ?? null,
    nombre: (p.nombre as string | null) ?? null,
    clienteId: (p.cliente_id as string | null) ?? null,
  }));

  return (
    <section>
      <header className="border-b border-hairline px-5 py-4">
        <h1 className="text-lg font-semibold text-tinta">Equipo</h1>
        <p className="text-xs text-tinta-60">
          Quién administra Zakumi. Un admin ve TODO: CRM, clientes, pagos y todos
          los bots — promueve solo a gente de la casa. Las cuentas de clientes
          del portal no se tocan desde aquí (eso vive en la ficha de cada cliente).
        </p>
      </header>
      <div className="px-5 py-4">
        <EquipoView admins={admins} miUserId={sesion.userId} />
      </div>
    </section>
  );
}
