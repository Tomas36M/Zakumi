// Lectura de la agenda para el panel. La agrupación es pura y se prueba
// aparte; la consulta a Supabase va por la sesión del admin (anon + RLS,
// política solicitudes_admin_todo), NUNCA por service-role.

import type { SupabaseClient } from "@supabase/supabase-js";
import { servicioDelSlug } from "@/lib/catalogo";
import { diaBogota } from "@/lib/solicitudes/fecha";
import type { EstadoSolicitud, OrigenSolicitud, Solicitud } from "@/lib/portal/solicitudes";

export type Cita360 = {
  id: string;
  solicitudId: string;
  inicio: string;
  fin: string;
  nombre: string | null;
  telefono: string | null;
  servicio: string | null;
  detalle: string | null;
  meetUrl: string | null;
  linkGoogle: string | null;
  origen: OrigenSolicitud;
  estado: EstadoSolicitud;
};

export type GrupoAgenda = { titulo: string; citas: Cita360[] };

function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * 86_400_000);
}

export function agruparPorDia(citas: Cita360[], ahora: Date = new Date()): GrupoAgenda[] {
  const hoy = diaBogota(ahora);
  const manana = diaBogota(sumarDias(ahora, 1));
  const finDeSemana = diaBogota(sumarDias(ahora, 7));

  const grupos: GrupoAgenda[] = [
    { titulo: "Hoy", citas: [] },
    { titulo: "Mañana", citas: [] },
    { titulo: "Esta semana", citas: [] },
    { titulo: "Después", citas: [] },
  ];

  for (const c of [...citas].sort((a, b) => a.inicio.localeCompare(b.inicio))) {
    const dia = diaBogota(new Date(c.inicio));
    if (dia === hoy) grupos[0].citas.push(c);
    else if (dia === manana) grupos[1].citas.push(c);
    else if (dia < finDeSemana) grupos[2].citas.push(c);
    else grupos[3].citas.push(c);
  }

  return grupos.filter((g) => g.citas.length > 0);
}

const CAMPOS =
  "id, servicio_slug, mensaje, estado, origen, contacto_nombre, contacto_telefono, " +
  "cita_inicio, cita_fin, cita_meet_url, cita_link_google";

function aCita(f: Partial<Solicitud>): Cita360 {
  return {
    id: String(f.id),
    solicitudId: String(f.id),
    inicio: f.cita_inicio ?? "",
    fin: f.cita_fin ?? "",
    nombre: f.contacto_nombre ?? null,
    telefono: f.contacto_telefono ?? null,
    servicio: servicioDelSlug(f.servicio_slug ?? "")?.nombre ?? null,
    detalle: f.mensaje ?? null,
    meetUrl: f.cita_meet_url ?? null,
    linkGoogle: f.cita_link_google ?? null,
    origen: f.origen ?? "portal",
    estado: f.estado ?? "nueva",
  };
}

/**
 * Las citas de hoy en adelante. Se corta en el inicio del día de Bogotá para
 * que una reunión de esta mañana siga visible hasta que termine la jornada.
 */
export async function proximasCitas(
  supabase: SupabaseClient,
  limite = 100,
): Promise<Cita360[]> {
  const desde = new Date();
  desde.setUTCHours(desde.getUTCHours() - 24);

  const { data, error } = await supabase
    .from("solicitudes")
    .select(CAMPOS)
    .not("cita_inicio", "is", null)
    .neq("estado", "rechazada")
    .gte("cita_inicio", desde.toISOString())
    .order("cita_inicio", { ascending: true })
    .limit(limite);

  if (error) {
    console.error("[agenda] proximasCitas:", error.message);
    return [];
  }
  return (data ?? []).map((f) => aCita(f as Partial<Solicitud>));
}
