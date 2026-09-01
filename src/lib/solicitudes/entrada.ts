// El ÚNICO camino por el que entra una solicitud que no viene del portal.
// Lo llaman las dos puntas: el webhook post-call de ElevenLabs y el endpoint
// /api/zak/solicitud del bot de WhatsApp. Escribir esto una sola vez es la
// razón de que exista el módulo.
//
// SOLO SERVIDOR. Contrato degradable, como todo el repo: NUNCA lanza, y cada
// paso que falle deja el anterior en pie — si Google se cae, la solicitud
// igual queda en la bandeja; si el bot de avisos se cae, la cita igual queda
// en el calendario.

import type { SupabaseClient } from "@supabase/supabase-js";
import { servicioDelSlug, slugDeInteres } from "@/lib/catalogo";
import { avisarAdmin } from "@/lib/portal/avisos";
import type { Calendario } from "@/lib/agenda/tipos";
import { parsearCita, type Cita } from "./fecha";
import { construirAviso } from "./mensaje";

export type EntradaSolicitud = {
  origen: "voz" | "whatsapp";
  /** Clave de idempotencia: 'voz:<conversation_id>' | 'wa:<ref del bot>'. */
  claveOrigen: string;
  contacto: { nombre?: string | null; telefono?: string | null; email?: string | null };
  /** Texto libre de lo que dijo que le interesaba. */
  servicioInteres?: string | null;
  detalle?: string | null;
  mejorHorario?: string | null;
  /** Lo que el agente extrajo como fecha; puede ser texto libre o basura. */
  citaCruda?: unknown;
  llamadaId?: string | null;
  conversacion?: string | null;
};

export type ResultadoEntrada =
  | { estado: "creada"; solicitudId: string; agendada: boolean }
  | { estado: "duplicada" }
  | { estado: "error"; motivo: string };

export type DepsEntrada = {
  /** null = sin Google configurado. La fase 1 corre así a propósito. */
  calendario?: Calendario | null;
  avisar?: (texto: string) => Promise<void>;
  ahora?: Date;
};

function urlPanel(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zakumistudio.com";
  return `${base.replace(/\/$/, "")}/admin/solicitudes`;
}

function limpio(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export async function registrarSolicitudEntrante(
  supabase: SupabaseClient,
  entrada: EntradaSolicitud,
  deps: DepsEntrada = {},
): Promise<ResultadoEntrada> {
  const avisar = deps.avisar ?? avisarAdmin;
  const calendario = deps.calendario ?? null;

  const telefono = limpio(entrada.contacto.telefono);
  const nombre = limpio(entrada.contacto.nombre);
  const email = limpio(entrada.contacto.email);
  // El check solicitudes_identifica_chk lo exige; comprobarlo aquí evita
  // gastar un round-trip para recibir un 23514 ilegible.
  if (!telefono) {
    console.error("[solicitud entrante] sin teléfono de contacto:", entrada.claveOrigen);
    return { estado: "error", motivo: "sin_contacto" };
  }

  const slug = slugDeInteres(entrada.servicioInteres);
  const detalle = limpio(entrada.detalle);
  const citaCrudaTexto = limpio(entrada.citaCruda);
  const duracionMin = Number(process.env.AGENDA_DURACION_MIN ?? "");
  const cita: Cita | null = parsearCita(entrada.citaCruda, {
    ahora: deps.ahora,
    duracionMin: Number.isInteger(duracionMin) && duracionMin > 0 ? duracionMin : undefined,
  });

  const fila = {
    user_id: null,
    origen: entrada.origen,
    estado: "nueva",
    servicio_slug: slug,
    mensaje: detalle,
    contacto_nombre: nombre,
    contacto_telefono: telefono,
    contacto_email: email,
    llamada_id: entrada.llamadaId ?? null,
    conversacion: entrada.conversacion ?? null,
    clave_origen: entrada.claveOrigen,
    cita_inicio: cita?.inicio ?? null,
    cita_fin: cita?.fin ?? null,
    // Solo se guarda el crudo cuando NO se pudo parsear: si hay cita, el crudo
    // sobra y ensucia la bandeja.
    cita_texto_crudo: cita ? null : citaCrudaTexto,
  };

  const { data, error } = await supabase
    .from("solicitudes")
    .insert(fila)
    .select("id")
    .single();

  if (error) {
    // 23505 = unique_violation sobre solicitudes_clave_origen_uq: es un
    // reintento del webhook, no un fallo. Cortar sin volver a avisar.
    if (error.code === "23505") return { estado: "duplicada" };
    console.error("[solicitud entrante] insert:", error.message);
    return { estado: "error", motivo: "db" };
  }
  const solicitudId = String((data as { id: string }).id);

  let meetUrl: string | null = null;
  let choque = false;
  let agendada = false;
  if (cita && calendario) {
    // `Calendario` es inyectable (hoy el falso de los tests, mañana
    // google.ts) y nada en el tipo obliga a que resuelva en vez de lanzar —
    // un choque de red acá no puede tirar una solicitud que ya quedó
    // guardada, así que el bloque entero cae en pie si algo revienta.
    try {
      // El choque solo informa: se agenda igual (perder una cita conseguida
      // es peor que solapar dos eventos en el calendario).
      choque = await calendario.hayChoque(cita.inicio, cita.fin);
      const titulo = `Zakumi · ${nombre ?? telefono}`;
      const evento = await calendario.crearEvento({
        titulo,
        descripcion: [
          detalle ? `Lo que pidió: ${detalle}` : null,
          `Servicio: ${servicioDelSlug(slug)?.nombre ?? "por definir"}`,
          `Contacto: ${telefono}`,
          `Origen: ${entrada.origen}`,
          urlPanel(),
        ]
          .filter((l) => l)
          .join("\n"),
        inicio: cita.inicio,
        fin: cita.fin,
      });
      if (evento) {
        // Agendada = se creó el evento, no que además haya llegado el link de
        // Meet: un evento sin sala igual ocupó el horario en el calendario.
        agendada = true;
        meetUrl = evento.meetUrl;
        const { error: errUpd } = await supabase
          .from("solicitudes")
          .update({
            cita_meet_url: evento.meetUrl,
            cita_evento_id: evento.eventoId,
            cita_link_google: evento.linkGoogle,
          })
          .eq("id", solicitudId);
        if (errUpd) console.error("[solicitud entrante] update cita:", errUpd.message);
      }
    } catch (e) {
      console.error("[solicitud entrante] calendario:", e);
    }
  }

  try {
    // El aviso es lo último y lo menos crítico de los tres pasos: que
    // `avisar` (inyectable — el `avisarAdmin` real ya es fire-and-forget,
    // pero nada lo garantiza aquí) reviente no puede borrar que la solicitud
    // (y su cita, si la hubo) ya quedaron en pie.
    await avisar(
      construirAviso({
        origen: entrada.origen,
        nombre,
        telefono,
        servicio: servicioDelSlug(slug)?.nombre ?? null,
        detalle,
        mejorHorario: limpio(entrada.mejorHorario),
        cita,
        citaTextoCrudo: cita ? null : citaCrudaTexto,
        meetUrl,
        choque,
        urlPanel: urlPanel(),
      }),
    );
  } catch (e) {
    console.error("[solicitud entrante] aviso:", e);
  }

  return { estado: "creada", solicitudId, agendada };
}
