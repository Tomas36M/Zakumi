// Lectura de la agenda para el panel. La agrupación es pura y se prueba
// aparte; la consulta a Supabase va por la sesión del admin (anon + RLS,
// política solicitudes_admin_todo), NUNCA por service-role.

import type { SupabaseClient } from "@supabase/supabase-js";
import { servicioDelSlug } from "@/lib/catalogo";
import { normalizarTelefonoCO } from "@/lib/admin/telefono";
import { diaBogota } from "@/lib/solicitudes/fecha";
import type { EstadoSolicitud, OrigenSolicitud, Solicitud } from "@/lib/portal/solicitudes";

export type Cita360 = {
  id: string;
  solicitudId: string;
  inicio: string;
  fin: string;
  nombre: string | null;
  telefono: string | null;
  /** A qué número se le avisa un cambio (E.164), o null si no hay ninguno:
   * el contacto de la solicitud, o el del cliente del portal. */
  telefonoAviso: string | null;
  servicio: string | null;
  detalle: string | null;
  meetUrl: string | null;
  linkGoogle: string | null;
  /** Hay evento en Google que mover o borrar. */
  tieneEventoGoogle: boolean;
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

/**
 * A qué número avisar un cambio de reunión. Puro: el contacto de la
 * solicitud (voz/WhatsApp) normalizado, y si no lo hay, el teléfono del
 * cliente del portal. `contacto_telefono` no tiene CHECK de formato en la
 * tabla, así que se normaliza antes de dárselo al bot.
 */
export function telefonoAvisoDe(
  s: Pick<Solicitud, "contacto_telefono">,
  telefonoCliente: string | null,
): string | null {
  const contacto = s.contacto_telefono ? normalizarTelefonoCO(s.contacto_telefono).telefono : null;
  if (contacto) return contacto;
  return telefonoCliente ? normalizarTelefonoCO(telefonoCliente).telefono : null;
}

const CAMPOS =
  "id, servicio_slug, mensaje, estado, origen, user_id, contacto_nombre, contacto_telefono, " +
  "cita_inicio, cita_fin, cita_meet_url, cita_link_google, cita_evento_id";

function aCita(f: Partial<Solicitud>, telefonoCliente: string | null): Cita360 {
  return {
    id: String(f.id),
    solicitudId: String(f.id),
    // cita_inicio es garantizado por el `.filter(f => f.cita_inicio != null)`
    // de los lectores antes de llamar aCita; la aserción `!` de abajo confía
    // en ese filtro y NO es una guarda por sí sola.
    inicio: f.cita_inicio!,
    fin: f.cita_fin ?? "",
    nombre: f.contacto_nombre ?? null,
    telefono: f.contacto_telefono ?? null,
    telefonoAviso: telefonoAvisoDe({ contacto_telefono: f.contacto_telefono ?? null }, telefonoCliente),
    servicio: servicioDelSlug(f.servicio_slug ?? "")?.nombre ?? null,
    detalle: f.mensaje ?? null,
    meetUrl: f.cita_meet_url ?? null,
    linkGoogle: f.cita_link_google ?? null,
    tieneEventoGoogle: Boolean(f.cita_evento_id),
    origen: f.origen ?? "portal",
    estado: f.estado ?? "nueva",
  };
}

/**
 * Teléfonos de los clientes del portal, por usuario: `perfiles.cliente_id →
 * clientes.telefono`. `perfiles` no guarda teléfono; solo hace falta para
 * las solicitudes de la tienda (las de voz/WhatsApp traen el suyo).
 */
export async function telefonosDeClientes(
  supabase: SupabaseClient,
  userIds: readonly string[],
): Promise<Record<string, string | null>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return {};
  const perfiles = await supabase.from("perfiles").select("user_id, cliente_id").in("user_id", ids);
  if (perfiles.error) {
    console.error("[agenda] perfiles:", perfiles.error.message);
    return {};
  }
  const porUsuario = new Map<string, string>();
  for (const p of perfiles.data ?? []) {
    if (p.cliente_id) porUsuario.set(p.user_id as string, p.cliente_id as string);
  }
  if (porUsuario.size === 0) return {};
  const clientes = await supabase
    .from("clientes")
    .select("id, telefono")
    .in("id", [...new Set(porUsuario.values())]);
  if (clientes.error) {
    console.error("[agenda] clientes:", clientes.error.message);
    return {};
  }
  const telefonoDeCliente = new Map<string, string | null>();
  for (const c of clientes.data ?? []) {
    telefonoDeCliente.set(c.id as string, (c.telefono as string | null) ?? null);
  }
  const resultado: Record<string, string | null> = {};
  for (const [userId, clienteId] of porUsuario) {
    resultado[userId] = telefonoDeCliente.get(clienteId) ?? null;
  }
  return resultado;
}

export async function telefonoDelClientePorUsuario(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  return (await telefonosDeClientes(supabase, [userId]))[userId] ?? null;
}

/** Filas crudas → citas, resolviendo los teléfonos del portal en una tanda. */
async function aCitas(supabase: SupabaseClient, filas: Partial<Solicitud>[]): Promise<Cita360[]> {
  const conCita = filas.filter((f) => f.cita_inicio != null);
  const usuarios = conCita.map((f) => f.user_id).filter((u): u is string => typeof u === "string");
  const telefonos = usuarios.length > 0 ? await telefonosDeClientes(supabase, usuarios) : {};
  return conCita.map((f) => aCita(f, f.user_id ? (telefonos[f.user_id] ?? null) : null));
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
  return aCitas(supabase, (data ?? []) as Partial<Solicitud>[]);
}

/**
 * Las citas de una ventana (`desde` inclusivo, `hasta` exclusivo, ISO UTC):
 * lo que pinta la semana de la agenda, pasadas incluidas.
 */
export async function citasEntre(
  supabase: SupabaseClient,
  desde: string,
  hasta: string,
  limite = 500,
): Promise<Cita360[]> {
  const { data, error } = await supabase
    .from("solicitudes")
    .select(CAMPOS)
    .not("cita_inicio", "is", null)
    .neq("estado", "rechazada")
    .gte("cita_inicio", desde)
    .lt("cita_inicio", hasta)
    .order("cita_inicio", { ascending: true })
    .limit(limite);

  if (error) {
    console.error("[agenda] citasEntre:", error.message);
    return [];
  }
  return aCitas(supabase, (data ?? []) as Partial<Solicitud>[]);
}
