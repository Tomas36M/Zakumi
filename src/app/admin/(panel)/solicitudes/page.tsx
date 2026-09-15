import type { Metadata } from "next";
import { Cockpit, CockpitBody } from "@/components/admin/ui/Cockpit";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { verifySession } from "@/lib/admin/dal";
import { telefonoAvisoDe, telefonosDeClientes } from "@/lib/agenda/consultas";
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

  // A quién se le avisa un cambio de cita: el contacto de la solicitud o,
  // para las de la tienda, el teléfono del cliente del portal.
  const telefonosClientes = await telefonosDeClientes(supabase, userIds);
  const telefonosAviso: Record<string, string | null> = {};
  for (const s of solicitudes) {
    telefonosAviso[s.id] = telefonoAvisoDe(s, s.user_id ? (telefonosClientes[s.user_id] ?? null) : null);
  }

  return (
    <Cockpit>
      <PageHeader
        titulo="Solicitudes"
        coletilla="lo que quieren contratar"
        migas={["Solicitudes"]}
        subtitulo="Lo que piden en la tienda y lo que Zak consigue por llamada o por WhatsApp. Cotiza, manda el link de pago y activa."
        contador={
          <>
            <strong className="text-tinta-85">{solicitudes.length}</strong> en la bandeja
          </>
        }
      />
      <CockpitBody>
        <BandejaSolicitudes
          solicitudes={solicitudes}
          perfiles={perfiles}
          telefonosAviso={telefonosAviso}
        />
      </CockpitBody>
    </Cockpit>
  );
}
