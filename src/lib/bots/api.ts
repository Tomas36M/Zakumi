// Cliente del API admin del bot (Flask en Railway, /admin/api/v1).
//
// SOLO SERVIDOR: se importa desde pages, server actions y route handlers —
// nunca desde un componente "use client". Usa BOT_ADMIN_URL y BOT_ADMIN_TOKEN
// (sin prefijo NEXT_PUBLIC a propósito: el token no puede pisar un browser).
//
// Contrato degradable: toda función devuelve { ok: true, data } o
// { ok: false, error } y JAMÁS lanza — el panel tiene que seguir funcionando
// con Railway caído (banner "sin conexión", no pantalla rota).

import {
  mapConversaciones,
  mapHistorial,
  mapHistorialLabs,
  mapInstancia,
  mapInstancias,
  mapJobs,
  mapLeads,
  mapPausados,
  mapPromptActivo,
  mapRespuestaLabs,
  mapStatusGlobal,
  mapStatusInstancia,
  mapVersiones,
} from "./mappers";
import type {
  Conversacion,
  Historial,
  HistorialLabs,
  Instancia,
  JobFallido,
  Lead,
  Pausado,
  PromptActivo,
  RespuestaLabs,
  StatusGlobal,
  StatusInstancia,
  VersionPrompt,
} from "./tipos";

export type ErrorBot =
  | "sin_configurar" // faltan BOT_ADMIN_URL / BOT_ADMIN_TOKEN
  | "sin_conexion" // red caída, timeout o Railway apagado
  | "no_autorizado" // 401 (token malo) o 503 (bot sin token configurado)
  | "no_existe" // 404
  | "peticion_invalida" // 400
  | "conflicto" // 409 (slug duplicado; el prompt tiene su propio manejo)
  | "bot_error"; // 5xx o cualquier otra cosa

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: ErrorBot };

/** Campos que aceptan crear/editar instancia (los valida el bot; el panel
 * además whitelistea en la server action). Nunca mandar credenciales `•••`. */
export type DatosInstancia = Partial<{
  slug: string;
  nombre: string;
  activo: boolean;
  proveedor: "green" | "cloud";
  green_api_url: string;
  green_instance_id: string;
  green_api_token: string;
  green_webhook_token: string;
  meta_phone_number_id: string;
  meta_waba_id: string;
  meta_access_token: string;
  escalation_notify_to: string;
  acuse_escalado: string;
  fallback_reply: string;
  modelo: string;
  effort: string;
  max_tokens: number;
  presupuesto_tokens_dia: number | null;
}>;

type Crudo = { status: number; json: unknown };

async function llamar(
  metodo: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  timeoutMs = 10_000,
): Promise<Resultado<Crudo>> {
  const base = process.env.BOT_ADMIN_URL;
  const token = process.env.BOT_ADMIN_TOKEN;
  if (!base || !token) {
    console.error("[bots] faltan BOT_ADMIN_URL / BOT_ADMIN_TOKEN");
    return { ok: false, error: "sin_configurar" };
  }
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/admin/api/v1${path}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    return { ok: true, data: { status: res.status, json } };
  } catch (e) {
    console.error(`[bots] ${metodo} ${path}:`, e instanceof Error ? e.message : e);
    return { ok: false, error: "sin_conexion" };
  }
}

function errorDeStatus(status: number): ErrorBot {
  if (status === 401 || status === 503) return "no_autorizado";
  if (status === 404) return "no_existe";
  if (status === 400) return "peticion_invalida";
  if (status === 409) return "conflicto";
  return "bot_error";
}

/** Llama, y si el status es 2xx mapea el JSON; si no, lo convierte en ErrorBot. */
async function pedir<T>(
  metodo: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  mapear: (json: unknown) => T,
  body?: unknown,
  timeoutMs?: number,
): Promise<Resultado<T>> {
  const r = await llamar(metodo, path, body, timeoutMs);
  if (!r.ok) return r;
  const { status, json } = r.data;
  if (status < 200 || status >= 300) {
    console.error(`[bots] ${metodo} ${path} → ${status}`);
    return { ok: false, error: errorDeStatus(status) };
  }
  return { ok: true, data: mapear(json) };
}

// ---------- Instancias ----------

export function listarInstancias(): Promise<Resultado<Instancia[]>> {
  return pedir("GET", "/instancias", mapInstancias);
}

export function obtenerInstancia(id: number): Promise<Resultado<Instancia>> {
  return pedir("GET", `/instancias/${id}`, mapInstancia);
}

export function crearInstancia(datos: DatosInstancia): Promise<Resultado<{ id: number }>> {
  return pedir("POST", "/instancias", (j) => ({
    id: Number((j as { id?: unknown })?.id ?? 0),
  }), datos);
}

export function actualizarInstancia(
  id: number,
  datos: DatosInstancia,
): Promise<Resultado<true>> {
  return pedir("PUT", `/instancias/${id}`, () => true, datos);
}

// ---------- Prompt versionado ----------

export function obtenerPrompt(
  id: number,
  version?: number,
): Promise<Resultado<PromptActivo>> {
  const query = version !== undefined ? `?version=${version}` : "";
  return pedir("GET", `/instancias/${id}/prompt${query}`, mapPromptActivo);
}

export function listarVersiones(id: number): Promise<Resultado<VersionPrompt[]>> {
  return pedir("GET", `/instancias/${id}/prompt/versiones`, mapVersiones);
}

export type ResultadoGuardarPrompt =
  | { ok: true; version: number }
  | { ok: false; error: "version_desactualizada"; activa: number }
  | { ok: false; error: ErrorBot };

/** Crea la versión N+1 y la activa. `base_version` debe ser la activa al
 * cargar el editor — si alguien guardó en medio, el bot responde 409 y aquí
 * sale `version_desactualizada` con la versión que hay que revisar. */
export async function guardarPrompt(
  id: number,
  datos: { system_prompt: string; knowledge: string; notas?: string; base_version: number },
): Promise<ResultadoGuardarPrompt> {
  const r = await llamar("PUT", `/instancias/${id}/prompt`, datos);
  if (!r.ok) return r;
  const { status, json } = r.data;
  const cuerpo = (json ?? {}) as { version?: unknown; activa?: unknown };
  if (status === 409) {
    return { ok: false, error: "version_desactualizada", activa: Number(cuerpo.activa ?? 0) };
  }
  if (status < 200 || status >= 300) {
    console.error(`[bots] PUT /instancias/${id}/prompt → ${status}`);
    return { ok: false, error: errorDeStatus(status) };
  }
  return { ok: true, version: Number(cuerpo.version ?? 0) };
}

/** Rollback: vuelve a activar una versión existente sin crear una nueva. */
export function activarVersion(id: number, version: number): Promise<Resultado<true>> {
  return pedir("POST", `/instancias/${id}/prompt/activar`, () => true, { version });
}

// ---------- Conversaciones, pausas y leads ----------

export function listarConversaciones(
  id: number,
  opts: { limit?: number; offset?: number } = {},
): Promise<Resultado<Conversacion[]>> {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  return pedir(
    "GET",
    `/instancias/${id}/conversations?limit=${limit}&offset=${offset}`,
    mapConversaciones,
  );
}

export function historial(id: number, telefono: string): Promise<Resultado<Historial>> {
  return pedir(
    "GET",
    `/instancias/${id}/history?telefono=${encodeURIComponent(telefono)}`,
    mapHistorial,
  );
}

export function pausados(id: number): Promise<Resultado<Pausado[]>> {
  return pedir("GET", `/instancias/${id}/paused`, mapPausados);
}

export function pausar(
  id: number,
  telefono: string,
  motivo?: string,
): Promise<Resultado<true>> {
  return pedir("POST", `/instancias/${id}/paused`, () => true, { telefono, motivo });
}

export function reanudar(id: number, telefono: string): Promise<Resultado<true>> {
  return pedir(
    "DELETE",
    `/instancias/${id}/paused/${encodeURIComponent(telefono)}`,
    () => true,
  );
}

export function listarLeads(id: number, limit = 100): Promise<Resultado<Lead[]>> {
  return pedir("GET", `/instancias/${id}/leads?limit=${limit}`, mapLeads);
}

// ---------- Estado y jobs ----------

export function statusGlobal(): Promise<Resultado<StatusGlobal>> {
  return pedir("GET", "/status", mapStatusGlobal);
}

export function statusInstancia(id: number): Promise<Resultado<StatusInstancia>> {
  return pedir("GET", `/instancias/${id}/status`, mapStatusInstancia);
}

export function jobsFallidos(id: number, limit = 50): Promise<Resultado<JobFallido[]>> {
  return pedir("GET", `/instancias/${id}/jobs?limit=${limit}`, mapJobs);
}

export function reintentarJob(jobId: number): Promise<Resultado<true>> {
  return pedir("POST", `/jobs/${jobId}/retry`, () => true);
}

export function enviarManual(
  id: number,
  number: string,
  text: string,
): Promise<Resultado<true>> {
  return pedir("POST", `/instancias/${id}/send`, () => true, { number, text });
}

// ---------- Labs (chat de prueba sin WhatsApp) ----------

// El turno corre síncrono dentro del bot (3-10 s de Claude + tools), así que
// aquí el timeout es de 60 s, no los 10 s del resto.
export function labsChat(
  id: number,
  session: string,
  mensaje: string,
): Promise<Resultado<RespuestaLabs>> {
  return pedir("POST", `/instancias/${id}/labs`, mapRespuestaLabs, { session, mensaje }, 60_000);
}

export function labsHistorial(
  id: number,
  session: string,
): Promise<Resultado<HistorialLabs>> {
  return pedir(
    "GET",
    `/instancias/${id}/labs/${encodeURIComponent(session)}`,
    mapHistorialLabs,
  );
}

export function labsReset(id: number, session: string): Promise<Resultado<true>> {
  return pedir(
    "DELETE",
    `/instancias/${id}/labs/${encodeURIComponent(session)}`,
    () => true,
  );
}
