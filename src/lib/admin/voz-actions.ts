"use server";

// Mutaciones del canal de voz. Mismo contrato que bots-actions: verifySession()
// primera línea, whitelists explícitas, retornos { … } | { error } que nunca
// lanzan, detalle técnico al log y español al usuario.
//
// Supabase (agentes_voz) es la fuente de verdad; cada sincronización manda el
// payload COMPLETO a ElevenLabs (un PATCH parcial borra tools/overrides).
// Si ElevenLabs no responde, la config queda guardada aquí y "Sincronizar"
// reintenta — nada se pierde por una caída del proveedor.

import { revalidatePath } from "next/cache";
import { verifySession } from "./dal";
import {
  agenteZakVoz,
  contarLlamadasHoy,
  extraccionDe,
  obtenerAgenteVoz,
  obtenerLlamadaVoz,
  type AgenteVozFila,
} from "./voz";
import {
  CAP_DIARIO_ZAK,
  EXTRACCION_ZAK,
  NOMBRE_AGENTE_ZAK,
  PRIMER_MENSAJE_ZAK,
  SECCIONES_ZAK,
} from "@/lib/voz/zak";
import { despacharLlamadaZak, mensajeDe, numeroSaliente } from "@/lib/voz/despacho";
import {
  normalizarTelefono,
  payloadAgente,
  payloadBatch,
  payloadLlamadaUnica,
  type VariablesLlamada,
} from "@/lib/voz/eleven";
import { seccionesDe, validarSeccionesVoz, MAX_PRIMER_MENSAJE } from "@/lib/voz/guias";
import {
  CONVERSACION_ID,
  EXTRACCION_LEAD,
  type CampoExtraccion,
  type LlamadaVoz,
  type TipoExtraccion,
} from "@/lib/voz/tipos";
import {
  actualizarAgenteEleven,
  agregarVozCompartida,
  buscarVocesCompartidas,
  crearAgenteEleven,
  enviarBatch,
  llamadaSaliente,
  obtenerConversacion,
  LOCALES_BIBLIOTECA,
  type VozCompartida,
} from "@/lib/voz/api";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLAVE_EXTRACCION = /^[a-z][a-z0-9_]{1,40}$/;
const VOICE_ID = /^[A-Za-z0-9]{8,40}$/;
const OWNER_ID = /^[a-f0-9]{16,128}$/i;
// La whitelist del filtro sale de la misma lista que pintan los chips de la UI.
const LOCALES_ES = new Set(LOCALES_BIBLIOTECA.map((l) => l.valor));
const TIPOS_VALIDOS = new Set<TipoExtraccion>(["string", "boolean", "integer", "number"]);
const MAX_CAMPOS_EXTRACCION = 15;
const MAX_TANDA = 200;

function revalidarVoz(id?: string) {
  revalidatePath("/admin/voz");
  if (id) revalidatePath(`/admin/voz/${id}`);
}

/** Entrada cruda del form → CampoExtraccion[] validado, o mensaje de error. */
function limpiarExtraccion(cruda: unknown): CampoExtraccion[] | { error: string } {
  const campos = extraccionDe(cruda);
  if (!Array.isArray(cruda) || campos.length !== (cruda as unknown[]).length) {
    return { error: "Hay campos de extracción incompletos." };
  }
  if (campos.length > MAX_CAMPOS_EXTRACCION) {
    return { error: `Máximo ${MAX_CAMPOS_EXTRACCION} campos de extracción.` };
  }
  const claves = new Set<string>();
  for (const c of campos) {
    if (!CLAVE_EXTRACCION.test(c.clave)) {
      return { error: `Clave "${c.clave}" no válida: minúsculas, números y _ (2-40).` };
    }
    if (claves.has(c.clave)) return { error: `Clave repetida: "${c.clave}".` };
    claves.add(c.clave);
    if (!c.descripcion.trim() || c.descripcion.length > 500) {
      return { error: `El campo "${c.clave}" necesita una descripción (máx. 500).` };
    }
    if (!TIPOS_VALIDOS.has(c.tipo)) return { error: `Tipo no válido en "${c.clave}".` };
  }
  return campos;
}

type DatosConfig = {
  nombre: string;
  clienteId: string | null;
  voiceId: string;
  primerMensaje: string;
  secciones: unknown;
  extraccion: unknown;
  capDiario: number;
};

/** Valida la config completa del form. Devuelve la fila lista para Supabase. */
function validarConfig(datos: DatosConfig):
  | { fila: Record<string, unknown> }
  | { error: string } {
  const nombre = typeof datos?.nombre === "string" ? datos.nombre.trim() : "";
  if (!nombre) return { error: "El agente necesita un nombre." };

  const clienteId = datos.clienteId;
  if (clienteId !== null && !UUID.test(clienteId ?? "")) {
    return { error: "Cliente no válido." };
  }

  const voiceId = typeof datos.voiceId === "string" ? datos.voiceId.trim() : "";
  if (!VOICE_ID.test(voiceId)) return { error: "Elige una voz." };

  const primerMensaje =
    typeof datos.primerMensaje === "string" ? datos.primerMensaje.trim() : "";
  if (!primerMensaje) {
    return { error: "El primer mensaje es obligatorio (es lo primero que se oye)." };
  }
  if (primerMensaje.length > MAX_PRIMER_MENSAJE) {
    return { error: `El primer mensaje supera los ${MAX_PRIMER_MENSAJE} caracteres.` };
  }

  const secciones = seccionesDe(datos.secciones);
  const errorSecciones = validarSeccionesVoz(secciones);
  if (errorSecciones) return { error: errorSecciones };

  const extraccion = limpiarExtraccion(datos.extraccion);
  if ("error" in extraccion) return extraccion;

  const capDiario = Number(datos.capDiario);
  if (!Number.isInteger(capDiario) || capDiario < 0 || capDiario > 500) {
    return { error: "El cap diario debe estar entre 0 y 500." };
  }

  return {
    fila: {
      nombre: nombre.slice(0, 200),
      cliente_id: clienteId,
      voice_id: voiceId,
      primer_mensaje: primerMensaje,
      secciones,
      extraccion: extraccion.length > 0 ? extraccion : EXTRACCION_LEAD,
      cap_diario: capDiario,
    },
  };
}

/** Reconstruye el payload completo desde la fila y lo empuja a ElevenLabs. */
async function sincronizar(agente: AgenteVozFila): Promise<{ error: string | null }> {
  if (!agente.voice_id || !agente.primer_mensaje) {
    return { error: "Al agente le falta voz o primer mensaje." };
  }
  const payload = payloadAgente({
    nombre: agente.nombre,
    voiceId: agente.voice_id,
    primerMensaje: agente.primer_mensaje,
    secciones: seccionesDe(agente.secciones),
    extraccion: agente.extraccion.length > 0 ? agente.extraccion : [...EXTRACCION_LEAD],
  });
  if (agente.agent_id_eleven) {
    const r = await actualizarAgenteEleven(agente.agent_id_eleven, payload);
    return { error: r.ok ? null : mensajeDe(r.error) };
  }
  return { error: "El agente no está creado en ElevenLabs todavía." };
}

export async function crearAgenteVoz(
  datos: DatosConfig,
): Promise<{ id: string; aviso: string | null } | { error: string }> {
  const { supabase } = await verifySession();

  const v = validarConfig(datos);
  if ("error" in v) return v;

  const { data, error } = await supabase
    .from("agentes_voz")
    .insert(v.fila)
    .select("id")
    .single();
  if (error || !data) {
    console.error("[crearAgenteVoz]", error?.message);
    return { error: "No se pudo guardar el agente." };
  }
  const id = String(data.id);

  // Crear en ElevenLabs. Si falla, el agente queda "sin sincronizar" y el
  // botón Sincronizar de la ficha reintenta — no se rompe el flujo.
  let aviso: string | null = null;
  const creado = await crearAgenteEleven(
    payloadAgente({
      nombre: v.fila.nombre as string,
      voiceId: v.fila.voice_id as string,
      primerMensaje: v.fila.primer_mensaje as string,
      secciones: seccionesDe(v.fila.secciones),
      extraccion: v.fila.extraccion as CampoExtraccion[],
    }),
  );
  if (creado.ok && creado.data.agent_id) {
    const upd = await supabase
      .from("agentes_voz")
      .update({ agent_id_eleven: creado.data.agent_id })
      .eq("id", id);
    if (upd.error) {
      console.error("[crearAgenteVoz] agente creado en ElevenLabs pero no se guardó el id:", upd.error.message);
      aviso = "Creado en ElevenLabs pero el id no se guardó — usa Sincronizar.";
    }
  } else {
    aviso = `Guardado aquí, pero ElevenLabs no respondió: ${creado.ok ? "sin agent_id" : mensajeDe(creado.error)}`;
  }

  revalidarVoz(id);
  return { id, aviso };
}

export async function guardarConfigVoz(
  id: string,
  datos: DatosConfig,
): Promise<{ error: string | null; aviso: string | null }> {
  const { supabase } = await verifySession();
  if (!UUID.test(id)) return { error: "Agente no válido.", aviso: null };

  const v = validarConfig(datos);
  if ("error" in v) return { error: v.error, aviso: null };

  const { error } = await supabase.from("agentes_voz").update(v.fila).eq("id", id);
  if (error) {
    console.error("[guardarConfigVoz]", error.message);
    return { error: "No se pudo guardar la configuración.", aviso: null };
  }

  // Releer y empujar el payload completo (nunca confiar en lo que vino del form).
  const agente = await obtenerAgenteVoz(supabase, id);
  let aviso: string | null = null;
  if (agente?.agent_id_eleven) {
    const sync = await sincronizar(agente);
    if (sync.error) aviso = `Guardado aquí, pero sin sincronizar: ${sync.error}`;
  } else {
    aviso = "Guardado aquí. El agente aún no existe en ElevenLabs — usa Sincronizar.";
  }

  revalidarVoz(id);
  return { error: null, aviso };
}

export async function sincronizarAgenteVoz(id: string): Promise<{ error: string | null }> {
  const { supabase } = await verifySession();
  if (!UUID.test(id)) return { error: "Agente no válido." };

  const agente = await obtenerAgenteVoz(supabase, id);
  if (!agente) return { error: "El agente no existe." };

  if (!agente.agent_id_eleven) {
    if (!agente.voice_id || !agente.primer_mensaje) {
      return { error: "Al agente le falta voz o primer mensaje." };
    }
    const creado = await crearAgenteEleven(
      payloadAgente({
        nombre: agente.nombre,
        voiceId: agente.voice_id,
        primerMensaje: agente.primer_mensaje,
        secciones: seccionesDe(agente.secciones),
        extraccion: agente.extraccion.length > 0 ? agente.extraccion : [...EXTRACCION_LEAD],
      }),
    );
    if (!creado.ok) return { error: mensajeDe(creado.error) };
    const upd = await supabase
      .from("agentes_voz")
      .update({ agent_id_eleven: creado.data.agent_id })
      .eq("id", id);
    if (upd.error) {
      console.error("[sincronizarAgenteVoz]", upd.error.message);
      return { error: "Creado en ElevenLabs pero el id no se guardó — reintenta." };
    }
    revalidarVoz(id);
    return { error: null };
  }

  const r = await sincronizar(agente);
  if (!r.error) revalidarVoz(id);
  return r;
}

export async function activarAgenteVoz(
  id: string,
  activo: boolean,
): Promise<{ error: string | null }> {
  const { supabase } = await verifySession();
  if (!UUID.test(id)) return { error: "Agente no válido." };

  const { error } = await supabase
    .from("agentes_voz")
    .update({ activo: Boolean(activo) })
    .eq("id", id);
  if (error) {
    console.error("[activarAgenteVoz]", error.message);
    return { error: "No se pudo cambiar el estado." };
  }
  revalidarVoz(id);
  return { error: null };
}

/** Cap diario: llamadas ya aterrizadas hoy (Bogotá) + las que se van a lanzar. */
async function validarCap(
  supabase: Awaited<ReturnType<typeof verifySession>>["supabase"],
  agente: AgenteVozFila,
  aLanzar: number,
): Promise<string | null> {
  const hoy = await contarLlamadasHoy(supabase, agente.id);
  if (hoy === null) return "No se pudo verificar el cap diario.";
  const disponibles = agente.cap_diario - hoy;
  if (aLanzar > disponibles) {
    return disponibles <= 0
      ? `El agente ya alcanzó su cap de ${agente.cap_diario} llamadas hoy.`
      : `Solo caben ${disponibles} llamadas más hoy (cap ${agente.cap_diario}).`;
  }
  return null;
}

export async function llamadaPruebaVoz(
  id: string,
  telefonoCrudo: string,
): Promise<{ conversationId: string | null } | { error: string }> {
  const { supabase } = await verifySession();
  if (!UUID.test(id)) return { error: "Agente no válido." };

  const agente = await obtenerAgenteVoz(supabase, id);
  if (!agente) return { error: "El agente no existe." };
  if (!agente.agent_id_eleven) return { error: "Sincroniza el agente antes de llamar." };
  if (!agente.activo) return { error: "El agente está apagado." };

  const phoneNumberId = numeroSaliente(agente);
  if (!phoneNumberId) {
    return { error: "Sin número saliente: falta ELEVENLABS_PHONE_NUMBER_ID (interruptor del piloto)." };
  }

  const telefono = normalizarTelefono(typeof telefonoCrudo === "string" ? telefonoCrudo : "");
  if (!telefono) return { error: "Teléfono no válido (formato +57…)." };

  const errorCap = await validarCap(supabase, agente, 1);
  if (errorCap) return { error: errorCap };

  const variables: VariablesLlamada = {
    agente_id: agente.id,
    origen: "zakumi_prueba",
    telefono,
  };
  const r = await llamadaSaliente(
    payloadLlamadaUnica({
      agentIdEleven: agente.agent_id_eleven,
      phoneNumberId,
      telefono,
      variables,
    }),
  );
  if (!r.ok) return { error: mensajeDe(r.error) };
  // El conversation_id permite al lab narrar la llamada en vivo; si ElevenLabs
  // solo devolvió el callSid de Twilio, el resultado aterriza igual por webhook.
  return { conversationId: r.data.conversation_id };
}

/**
 * Zak llama a un prospecto: despacha una saliente con el agente es_zak.
 * Si viene negocioId, la llamada queda correlacionada (dynamic_variables) y
 * el negocio pasa de 'nuevo' a 'contactado' — forward-only, como la tanda
 * de WhatsApp; jamás degrada un respondido/interesado.
 */
export async function llamarConZak(datos: {
  telefono: string;
  nombreContacto?: string;
  negocioId?: string;
}): Promise<{ conversationId: string | null } | { error: string }> {
  const { supabase } = await verifySession();
  const r = await despacharLlamadaZak(supabase, datos);
  if (!("error" in r)) revalidarVoz();
  return r;
}

/** Crea el agente de voz de Zak (es_zak) con su prompt semilla completo. */
export async function crearAgenteZakVoz(
  voiceId: string,
): Promise<{ id: string; aviso: string | null } | { error: string }> {
  const { supabase } = await verifySession();
  if (typeof voiceId !== "string" || !VOICE_ID.test(voiceId)) {
    return { error: "Elige una voz (en español) para Zak." };
  }

  const existente = await agenteZakVoz(supabase);
  if (existente) return { error: "Zak ya tiene voz — edítala en su ficha." };

  const creado = await crearAgenteVoz({
    nombre: NOMBRE_AGENTE_ZAK,
    clienteId: null,
    voiceId,
    primerMensaje: PRIMER_MENSAJE_ZAK,
    secciones: SECCIONES_ZAK,
    extraccion: [...EXTRACCION_ZAK],
    capDiario: CAP_DIARIO_ZAK,
  });
  if ("error" in creado) return creado;

  // El índice único parcial (es_zak) corta la carrera de dos admins creándolo.
  const upd = await supabase
    .from("agentes_voz")
    .update({ es_zak: true })
    .eq("id", creado.id);
  if (upd.error) {
    console.error("[crearAgenteZakVoz] es_zak:", upd.error.message);
    return {
      id: creado.id,
      aviso: "El agente quedó creado pero no marcado como Zak — ¿ya existía otro?",
    };
  }

  revalidarVoz(creado.id);
  return creado;
}

export async function buscarVocesEspanol(
  locale: string,
  busqueda: string,
): Promise<{ voces: VozCompartida[] } | { error: string }> {
  await verifySession();
  if (typeof locale !== "string" || !LOCALES_ES.has(locale)) {
    return { error: "Filtro de acento no válido." };
  }
  const b = typeof busqueda === "string" ? busqueda.trim().slice(0, 80) : "";
  const r = await buscarVocesCompartidas({
    locale: locale || undefined,
    busqueda: b || undefined,
  });
  if (!r.ok) return { error: mensajeDe(r.error) };
  return { voces: r.data };
}

export async function agregarVozEspanol(
  publicOwnerId: string,
  voiceId: string,
  nombre: string,
): Promise<{ error: string | null }> {
  await verifySession();
  if (!OWNER_ID.test(publicOwnerId) || !VOICE_ID.test(voiceId)) {
    return { error: "Voz no válida." };
  }
  const n = typeof nombre === "string" ? nombre.trim().slice(0, 80) : "";
  if (!n) return { error: "La voz necesita un nombre." };
  const r = await agregarVozCompartida(publicOwnerId, voiceId, n);
  if (!r.ok) return { error: mensajeDe(r.error) };
  revalidarVoz();
  return { error: null };
}

/** Fase de una llamada de prueba, para el polling del lab. */
export type FaseLlamadaLab =
  | { fase: "buscando" } // ElevenLabs aún no registra la conversación
  | { fase: "sonando" } // initiated
  | { fase: "hablando" } // in-progress
  | { fase: "procesando" } // colgada; el webhook post-call viene en camino
  | { fase: "fallida" } // failed en ElevenLabs (el fallo_inicio aterriza por webhook)
  | { fase: "aterrizada"; llamada: LlamadaVoz } // terminal: fila en llamadas_voz
  | { fase: "error"; error: string };

export async function estadoLlamadaVoz(
  agenteId: string,
  conversationId: string,
): Promise<FaseLlamadaLab> {
  const { supabase } = await verifySession();
  if (!UUID.test(agenteId) || !CONVERSACION_ID.test(conversationId)) {
    return { fase: "error", error: "Llamada no válida." };
  }

  // Terminal primero: la fila del webhook es la verdad completa (transcript,
  // datos, audio) — en cuanto existe, se deja de preguntar a ElevenLabs.
  const llamada = await obtenerLlamadaVoz(supabase, agenteId, conversationId);
  if (llamada) return { fase: "aterrizada", llamada };

  const r = await obtenerConversacion(conversationId);
  if (!r.ok) {
    // Justo tras marcar, ElevenLabs puede responder 404 unos segundos.
    if (r.error === "no_existe") return { fase: "buscando" };
    return { fase: "error", error: mensajeDe(r.error) };
  }
  switch (r.data.status) {
    case "initiated":
      return { fase: "sonando" };
    case "in-progress":
      return { fase: "hablando" };
    case "failed":
      return { fase: "fallida" };
    default:
      // processing | done | desconocido: colgada, esperando el post-call.
      return { fase: "procesando" };
  }
}

export async function lanzarTandaVoz(
  id: string,
  telefonosCrudo: string,
  nombresPorTelefono?: Record<string, string>,
): Promise<{ enviadas: number; invalidos: string[] } | { error: string }> {
  const { supabase } = await verifySession();
  if (!UUID.test(id)) return { error: "Agente no válido." };

  const agente = await obtenerAgenteVoz(supabase, id);
  if (!agente) return { error: "El agente no existe." };
  if (!agente.agent_id_eleven) return { error: "Sincroniza el agente antes de llamar." };
  if (!agente.activo) return { error: "El agente está apagado." };

  const phoneNumberId = numeroSaliente(agente);
  if (!phoneNumberId) {
    return { error: "Sin número saliente: falta ELEVENLABS_PHONE_NUMBER_ID (interruptor del piloto)." };
  }

  const crudos = (typeof telefonosCrudo === "string" ? telefonosCrudo : "")
    .split(/[\n,;]+/)
    .map((t) => t.trim())
    .filter((t) => t !== "");
  if (crudos.length === 0) return { error: "No hay teléfonos para llamar." };

  const validos: string[] = [];
  const invalidos: string[] = [];
  const vistos = new Set<string>();
  for (const crudo of crudos) {
    const tel = normalizarTelefono(crudo);
    if (!tel) {
      invalidos.push(crudo);
    } else if (!vistos.has(tel)) {
      vistos.add(tel);
      validos.push(tel);
    }
  }
  if (validos.length === 0) return { error: "Ningún teléfono es válido (formato +57…)." };
  if (validos.length > MAX_TANDA) {
    return { error: `Máximo ${MAX_TANDA} teléfonos por tanda.` };
  }

  const errorCap = await validarCap(supabase, agente, validos.length);
  if (errorCap) return { error: errorCap };

  const r = await enviarBatch(
    payloadBatch({
      agentIdEleven: agente.agent_id_eleven,
      phoneNumberId,
      nombreBatch: `zakumi-${agente.id.slice(0, 8)}-${Date.now()}`,
      destinos: validos.map((telefono) => {
        const variables: VariablesLlamada = {
          agente_id: agente.id,
          origen: "zakumi_salida",
          telefono,
        };
        const nombre = nombresPorTelefono?.[telefono]?.trim();
        if (nombre) variables.nombre_contacto = nombre.slice(0, 120);
        return { telefono, variables };
      }),
    }),
  );
  if (!r.ok) return { error: mensajeDe(r.error) };

  revalidarVoz(id);
  return { enviadas: validos.length, invalidos };
}
