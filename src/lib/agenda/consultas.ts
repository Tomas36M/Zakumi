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

    // Descarta citas de días anteriores a hoy (defensa contra bugs en la consulta)
    if (dia < hoy) continue;

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
    // cita_inicio es garantizado por el `.filter(f => f.cita_inicio != null)`
    // de proximasCitas antes de llamar aCita; la aserción `!` de abajo confía
    // en ese filtro y NO es una guarda por sí sola — si algún día se llama a
    // aCita() sin pasar por ese filtro, esto puede reventar en runtime.
    inicio: f.cita_inicio!,
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
 * Las citas a partir del inicio del día de Bogotá (00:00 zona Bogotá).
 * Una reunión de hoy temprano sigue visible toda la jornada.
 */
export async function proximasCitas(
  supabase: SupabaseClient,
  limite = 100,
): Promise<Cita360[]> {
  const ahora = new Date();
  const diaEnBogota = diaBogota(ahora);
  // Inicio del día en Bogotá (00:00 en zona -05:00) convertido a ISO UTC
  const inicioDelDia = new Date(`${diaEnBogota}T00:00:00-05:00`);

  const { data, error } = await supabase
    .from("solicitudes")
    .select(CAMPOS)
    .not("cita_inicio", "is", null)
    .neq("estado", "rechazada")
    .gte("cita_inicio", inicioDelDia.toISOString())
    .order("cita_inicio", { ascending: true })
    .limit(limite);

  if (error) {
    console.error("[agenda] proximasCitas:", error.message);
    return [];
  }
  // Filtra filas sin cita_inicio como defensa contra cambios futuros en la consulta
  const filas = (data ?? []) as Partial<Solicitud>[];
  return filas
    .filter((f) => f.cita_inicio != null)
    .map((f) => aCita(f));
}
