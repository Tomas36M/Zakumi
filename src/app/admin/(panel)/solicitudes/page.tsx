import type { Metadata } from "next";
import { Cockpit, CockpitBody } from "@/components/admin/ui/Cockpit";
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
  const userIds = [
    ...new Set(solicitudes.map((s) => s.user_id).filter((id): id is string => id !== null)),
  ];
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
    <Cockpit>
      <header className="border-b border-hairline px-5 py-4">
        <h1 className="text-lg font-semibold text-tinta">Solicitudes</h1>
        <p className="text-xs text-tinta-60">
          Todo el que quiere contratarnos: lo que piden en la tienda y lo que
          Zak consigue por llamada o por WhatsApp. Cotiza, manda el link de pago
          y activa.
        </p>
      </header>
      <CockpitBody>
        <BandejaSolicitudes solicitudes={solicitudes} perfiles={perfiles} />
      </CockpitBody>
    </Cockpit>
  );
}
