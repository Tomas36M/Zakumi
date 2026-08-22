import type { Metadata } from "next";
import { verifySession } from "@/lib/admin/dal";
import type { Solicitud } from "@/lib/portal/solicitudes";
import {
  BandejaSolicitudes,
  type PerfilResumen,
} from "@/components/admin/solicitudes/BandejaSolicitudes";

export const metadata: Metadata = { title: "Solicitudes" };

export default async function SolicitudesAdminPage() {
  const { supabase } = await verifySession();

  const { data } = await supabase
    .from("solicitudes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  const solicitudes = (data ?? []) as Solicitud[];

  // perfiles y solicitudes no tienen FK directa entre sí (ambas cuelgan de
  // auth.users), así que PostgREST no puede embeber: dos queries y un mapa.
  const userIds = [...new Set(solicitudes.map((s) => s.user_id))];
  const perfiles: Record<string, PerfilResumen> = {};
  if (userIds.length > 0) {
    const { data: filas } = await supabase
      .from("perfiles")
      .select("user_id, email, nombre, cliente_id")
      .in("user_id", userIds);
    for (const p of filas ?? []) {
      perfiles[p.user_id as string] = {
        email: (p.email as string | null) ?? null,
        nombre: (p.nombre as string | null) ?? null,
        clienteId: (p.cliente_id as string | null) ?? null,
      };
    }
  }

  return (
    <section className="adm-seccion">
      <h1 className="adm-titulo">Solicitudes del portal</h1>
      <p className="adm-lead">
        Lo que los clientes piden en la tienda: cotiza, manda el link de pago y
        activa. Cada activación crea el cliente y su producto en la cartera.
      </p>
      <BandejaSolicitudes solicitudes={solicitudes} perfiles={perfiles} />
    </section>
  );
}
