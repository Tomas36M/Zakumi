// Agendar, mover y cancelar la cita de una solicitud. SOLO SERVIDOR.
//
// Orden de operaciones, siempre el mismo: Supabase primero (es la fuente de
// verdad de la agenda), Google después (si hay evento), el aviso al lead de
// último. Cada paso que falle deja el anterior en pie y se DICE en el
// resultado: la pantalla pinta lo que pasó en vez de prometer lo que no.
// Mismo contrato que `solicitudes/entrada.ts`: nunca lanza.

import type { SupabaseClient } from "@supabase/supabase-js";
import { servicioDelSlug } from "@/lib/catalogo";
import { avisarLead as avisarLeadReal, type PlantillaAviso } from "@/lib/portal/avisos";
import type { Solicitud } from "@/lib/portal/solicitudes";
import { telefonoAvisoDe } from "./consultas";
import { calendarioGoogle } from "./google";
import {
  PLANTILLA_AVISO_REUNION,
  textoReunion,
  variablesReunion,
  type DatosReunion,
} from "./mensaje-lead";
import { validarCita } from "./semana";
import type { Calendario } from "./tipos";

export type Cita = { inicio: string; fin: string };

export type FilaCita = Pick<
  Solicitud,
  | "id"
  | "estado"
  | "origen"
  | "user_id"
  | "contacto_nombre"
  | "contacto_telefono"
  | "mensaje"
  | "servicio_slug"
  | "cita_inicio"
  | "cita_fin"
  | "cita_evento_id"
  | "cita_meet_url"
  | "cita_link_google"
>;

const CAMPOS_FILA =
  "id, estado, origen, user_id, contacto_nombre, contacto_telefono, mensaje, servicio_slug, " +
  "cita_inicio, cita_fin, cita_evento_id, cita_meet_url, cita_link_google";

/** Qué pasó con Google: `sin_evento` = no había (o no se pudo crear) evento
 * que mover; `fallo` = había y no se pudo tocar (queda anotado para
 * limpiarlo a mano); `no_configurado` = sin credenciales. */
export type EstadoGoogle = "ok" | "sin_evento" | "fallo" | "no_configurado";
export type EstadoAviso = "enviado" | "fallo" | "sin_telefono" | "omitido";

export type ResultadoCita =
  | { error: string }
  | { ok: true; google: EstadoGoogle; aviso: EstadoAviso; choque: boolean };

export type AvisarLead = (
  telefono: string,
  texto: string,
  plantilla?: PlantillaAviso,
) => Promise<"enviado" | "fallo">;

export type DepsCitas = {
  /** undefined = el de Google real; null = sin calendario (tests, fase 1). */
  calendario?: Calendario | null;
  avisarLead?: AvisarLead;
  ahora?: Date;
  /** Teléfono del cliente del portal por usuario (las de voz/WhatsApp traen el suyo). */
  telefonoDelCliente?: (userId: string) => Promise<string | null>;
};

/** El enlace del panel que viaja en la descripción del evento y en los
 * avisos: con id, abre directo la solicitud. */
export function urlPanelSolicitudes(solicitudId?: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://zakumistudio.com").replace(/\/$/, "");
  return `${base}/admin/solicitudes${solicitudId ? `?solicitud=${encodeURIComponent(solicitudId)}` : ""}`;
}

/** Título y descripción del evento de Google a partir de la solicitud. Puro;
 * lo usan la entrada (voz/WhatsApp) y las acciones del panel. */
export function eventoDeSolicitud(
  s: Pick<FilaCita, "contacto_nombre" | "contacto_telefono" | "mensaje" | "servicio_slug" | "origen">,
  cita: Cita,
  urlPanel: string,
): { titulo: string; descripcion: string; inicio: string; fin: string } {
  return {
    titulo: `Zakumi · ${s.contacto_nombre ?? s.contacto_telefono ?? "solicitud"}`,
    descripcion: [
      s.mensaje ? `Lo que pidió: ${s.mensaje}` : null,
      `Servicio: ${servicioDelSlug(s.servicio_slug)?.nombre ?? "por definir"}`,
      s.contacto_telefono ? `Contacto: ${s.contacto_telefono}` : null,
      `Origen: ${s.origen}`,
      urlPanel,
    ]
      .filter((l) => l)
      .join("\n"),
    inicio: cita.inicio,
    fin: cita.fin,
  };
}

async function leerFila(supabase: SupabaseClient, id: string): Promise<FilaCita | null> {
  const { data, error } = await supabase
    .from("solicitudes")
    .select(CAMPOS_FILA)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[citas] leer solicitud:", error.message);
    return null;
  }
  return (data as FilaCita | null) ?? null;
}

async function actualizar(
  supabase: SupabaseClient,
  id: string,
  campos: Record<string, unknown>,
): Promise<boolean> {
  const { error } = await supabase.from("solicitudes").update(campos).eq("id", id);
  if (error) console.error("[citas] update:", error.message);
  return !error;
}

function resolverCalendario(deps: DepsCitas): Calendario | null {
  return deps.calendario === undefined ? calendarioGoogle() : deps.calendario;
}

/** El aviso es lo último y lo menos crítico: nunca puede deshacer lo ya guardado. */
async function avisar(
  fila: FilaCita,
  datos: Omit<DatosReunion, "nombre">,
  avisarFlag: boolean,
  deps: DepsCitas,
): Promise<EstadoAviso> {
  if (!avisarFlag) return "omitido";
  try {
    const telefonoCliente =
      fila.user_id && deps.telefonoDelCliente ? await deps.telefonoDelCliente(fila.user_id) : null;
    const telefono = telefonoAvisoDe(fila, telefonoCliente);
    if (!telefono) return "sin_telefono";
    const d: DatosReunion = { ...datos, nombre: fila.contacto_nombre };
    return await (deps.avisarLead ?? avisarLeadReal)(telefono, textoReunion(d), {
      nombre: PLANTILLA_AVISO_REUNION,
      variables: variablesReunion(d),
    });
  } catch (e) {
    console.error("[citas] aviso al lead:", e);
    return "fallo";
  }
}

/** Crear el evento y guardar sus ids. `null` = no se pudo. */
async function crearYGuardar(
  supabase: SupabaseClient,
  calendario: Calendario,
  fila: FilaCita,
  cita: Cita,
): Promise<{ meetUrl: string | null } | null> {
  const evento = await calendario.crearEvento(
    eventoDeSolicitud(fila, cita, urlPanelSolicitudes(fila.id)),
  );
  if (!evento) return null;
  await actualizar(supabase, fila.id, {
    cita_meet_url: evento.meetUrl,
    cita_evento_id: evento.eventoId,
    cita_link_google: evento.linkGoogle,
  });
  return { meetUrl: evento.meetUrl };
}

/** Una solicitud sin cita recibe una. */
export async function agendarCitaCore(
  supabase: SupabaseClient,
  solicitudId: string,
  cita: Cita,
  avisarFlag: boolean,
  deps: DepsCitas = {},
): Promise<ResultadoCita> {
  const fila = await leerFila(supabase, solicitudId);
  if (!fila) return { error: "No se encontró la solicitud." };
  if (fila.estado === "rechazada") return { error: "Una solicitud rechazada no se agenda." };
  const invalida = validarCita(cita, deps.ahora ?? new Date());
  if (invalida) return { error: invalida };

  if (
    !(await actualizar(supabase, fila.id, {
      cita_inicio: cita.inicio,
      cita_fin: cita.fin,
      cita_texto_crudo: null,
    }))
  ) {
    return { error: "No se pudo guardar la cita." };
  }

  let google: EstadoGoogle = "no_configurado";
  let choque = false;
  let meetUrl: string | null = null;
  const calendario = resolverCalendario(deps);
  if (calendario) {
    try {
      choque = await calendario.hayChoque(cita.inicio, cita.fin);
      const creado = await crearYGuardar(supabase, calendario, fila, cita);
      google = creado ? "ok" : "sin_evento";
      meetUrl = creado?.meetUrl ?? null;
    } catch (e) {
      console.error("[citas] agendar en Google:", e);
      google = "fallo";
    }
  }

  const aviso = await avisar(fila, { accion: "agendada", inicio: cita.inicio, meetUrl }, avisarFlag, deps);
  return { ok: true, google, aviso, choque };
}

/** Mover una cita que ya existe. Si el evento de Google desapareció, se
 * recrea; si Google falla, el id viejo se CONSERVA (es la única pista para
 * moverlo a mano). */
export async function reprogramarCitaCore(
  supabase: SupabaseClient,
  solicitudId: string,
  cita: Cita,
  avisarFlag: boolean,
  deps: DepsCitas = {},
): Promise<ResultadoCita> {
  const fila = await leerFila(supabase, solicitudId);
  if (!fila) return { error: "No se encontró la solicitud." };
  if (!fila.cita_inicio) return { error: "Esta solicitud no tiene cita que mover." };
  const invalida = validarCita(cita, deps.ahora ?? new Date());
  if (invalida) return { error: invalida };

  if (!(await actualizar(supabase, fila.id, { cita_inicio: cita.inicio, cita_fin: cita.fin }))) {
    return { error: "No se pudo guardar la cita." };
  }

  let google: EstadoGoogle = "no_configurado";
  let choque = false;
  let meetUrl: string | null = fila.cita_meet_url;
  const calendario = resolverCalendario(deps);
  if (calendario) {
    try {
      choque = await calendario.hayChoque(cita.inicio, cita.fin);
      const movido = fila.cita_evento_id
        ? await calendario.actualizarEvento(fila.cita_evento_id, cita)
        : "no_existe";
      if (movido === "ok") {
        google = "ok";
      } else if (movido === "no_existe") {
        const creado = await crearYGuardar(supabase, calendario, fila, cita);
        google = creado ? "ok" : "sin_evento";
        meetUrl = creado?.meetUrl ?? null;
      } else {
        google = "fallo";
      }
    } catch (e) {
      console.error("[citas] mover en Google:", e);
      google = "fallo";
    }
  }

  const aviso = await avisar(
    fila,
    { accion: "reprogramada", inicio: cita.inicio, meetUrl },
    avisarFlag,
    deps,
  );
  return { ok: true, google, aviso, choque };
}

/** Quitar la cita (la solicitud sigue viva). El id del evento solo se borra
 * cuando Google confirmó que ya no está: si falla, queda la pista. */
export async function cancelarCitaCore(
  supabase: SupabaseClient,
  solicitudId: string,
  avisarFlag: boolean,
  deps: DepsCitas = {},
): Promise<ResultadoCita> {
  const fila = await leerFila(supabase, solicitudId);
  if (!fila) return { error: "No se encontró la solicitud." };
  if (!fila.cita_inicio) return { error: "Esta solicitud no tiene cita que cancelar." };

  if (
    !(await actualizar(supabase, fila.id, {
      cita_inicio: null,
      cita_fin: null,
      cita_meet_url: null,
    }))
  ) {
    return { error: "No se pudo cancelar la cita." };
  }

  let google: EstadoGoogle = "sin_evento";
  if (fila.cita_evento_id) {
    const calendario = resolverCalendario(deps);
    if (!calendario) {
      google = "no_configurado";
    } else {
      try {
        const borrado = await calendario.borrarEvento(fila.cita_evento_id);
        if (borrado === "error") {
          google = "fallo";
        } else {
          await actualizar(supabase, fila.id, { cita_evento_id: null, cita_link_google: null });
          google = "ok";
        }
      } catch (e) {
        console.error("[citas] borrar en Google:", e);
        google = "fallo";
      }
    }
  }

  const aviso = await avisar(fila, { accion: "cancelada", inicio: null, meetUrl: null }, avisarFlag, deps);
  return { ok: true, google, aviso, choque: false };
}
