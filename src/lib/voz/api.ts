// Cliente HTTP hacia ElevenLabs (api.elevenlabs.io).
//
// SOLO SERVIDOR: se importa desde server actions y route handlers — nunca
// desde un componente "use client". Usa ELEVENLABS_API_KEY (sin prefijo
// NEXT_PUBLIC a propósito: la key del workspace no puede pisar un browser).
//
// Mismo contrato degradable que lib/bots/api.ts: toda función devuelve
// { ok: true, data } o { ok: false, error } y JAMÁS lanza. Solo se opera
// sobre los agent_id guardados en agentes_voz: una key del workspace puede
// listar y PATCHear TODOS los agentes (incluidos los de Luci) — jamás
// listar-y-editar agentes del workspace.

export type ErrorVoz =
  | "sin_configurar" // falta ELEVENLABS_API_KEY
  | "sin_conexion" // red caída o timeout
  | "no_autorizado" // 401 (key mala o sin scope)
  | "no_existe" // 404 (agente/conversación borrados)
  | "peticion_invalida" // 400/422 (payload rechazado)
  | "eleven_error"; // 5xx o cualquier otra cosa

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: ErrorVoz };

export type VozEleven = {
  voice_id: string;
  nombre: string;
  preview_url: string | null;
  etiquetas: string;
};

const BASE = "https://api.elevenlabs.io";

type Crudo = { status: number; json: unknown };

async function llamar(
  metodo: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
  timeoutMs = 15_000,
): Promise<Resultado<Crudo>> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    console.error("[voz] falta ELEVENLABS_API_KEY");
    return { ok: false, error: "sin_configurar" };
  }
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: metodo,
      headers: {
        "xi-api-key": key,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    return { ok: true, data: { status: res.status, json } };
  } catch (e) {
    console.error(`[voz] ${metodo} ${path}:`, e instanceof Error ? e.message : e);
    return { ok: false, error: "sin_conexion" };
  }
}

function errorDeStatus(status: number): ErrorVoz {
  if (status === 401 || status === 403) return "no_autorizado";
  if (status === 404) return "no_existe";
  if (status === 400 || status === 422) return "peticion_invalida";
  return "eleven_error";
}

async function pedir<T>(
  metodo: "GET" | "POST" | "PATCH",
  path: string,
  mapear: (json: unknown) => T,
  body?: unknown,
  timeoutMs?: number,
): Promise<Resultado<T>> {
  const r = await llamar(metodo, path, body, timeoutMs);
  if (!r.ok) return r;
  const { status, json } = r.data;
  if (status < 200 || status >= 300) {
    console.error(`[voz] ${metodo} ${path} → ${status}:`, JSON.stringify(json)?.slice(0, 500));
    return { ok: false, error: errorDeStatus(status) };
  }
  return { ok: true, data: mapear(json) };
}

// ---------- Agentes ----------

export function crearAgenteEleven(
  payload: Record<string, unknown>,
): Promise<Resultado<{ agent_id: string }>> {
  return pedir("POST", "/v1/convai/agents/create", (j) => ({
    agent_id: String((j as { agent_id?: unknown })?.agent_id ?? ""),
  }), payload);
}

export function actualizarAgenteEleven(
  agentId: string,
  payload: Record<string, unknown>,
): Promise<Resultado<true>> {
  return pedir("PATCH", `/v1/convai/agents/${encodeURIComponent(agentId)}`, () => true, payload);
}

// ---------- Voces del workspace (incluye las de Luci: se muestran, no pasa nada) ----------

export function listarVoces(): Promise<Resultado<VozEleven[]>> {
  return pedir("GET", "/v2/voices?page_size=100", (j) => {
    const voces = (j as { voices?: unknown })?.voices;
    if (!Array.isArray(voces)) return [];
    return voces.map((v) => {
      const voz = (v ?? {}) as Record<string, unknown>;
      const labels = (voz.labels ?? {}) as Record<string, unknown>;
      const etiquetas = ["accent", "gender", "age", "description"]
        .map((k) => labels[k])
        .filter((x): x is string => typeof x === "string" && x !== "")
        .join(" · ");
      return {
        voice_id: String(voz.voice_id ?? ""),
        nombre: String(voz.name ?? "(sin nombre)"),
        preview_url: typeof voz.preview_url === "string" ? voz.preview_url : null,
        etiquetas,
      };
    }).filter((v) => v.voice_id !== "");
  });
}

// ---------- Llamadas salientes ----------

export function llamadaSaliente(
  payload: Record<string, unknown>,
): Promise<Resultado<{ conversation_id: string | null }>> {
  return pedir("POST", "/v1/convai/twilio/outbound-call", (j) => {
    const c = (j ?? {}) as Record<string, unknown>;
    const id = c.conversation_id ?? c.callSid ?? null;
    return { conversation_id: typeof id === "string" ? id : null };
  }, payload, 30_000);
}

export function enviarBatch(
  payload: Record<string, unknown>,
): Promise<Resultado<{ batch_id: string }>> {
  return pedir("POST", "/v1/convai/batch-calling/submit", (j) => ({
    batch_id: String((j as { id?: unknown })?.id ?? ""),
  }), payload, 30_000);
}

// ---------- Audio de una conversación (streaming, para el proxy admin) ----------

export async function audioConversacion(
  conversationId: string,
): Promise<Resultado<Response>> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return { ok: false, error: "sin_configurar" };
  try {
    const res = await fetch(
      `${BASE}/v1/convai/conversations/${encodeURIComponent(conversationId)}/audio`,
      {
        headers: { "xi-api-key": key },
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      },
    );
    if (!res.ok) {
      console.error(`[voz] GET audio ${conversationId} → ${res.status}`);
      return { ok: false, error: errorDeStatus(res.status) };
    }
    return { ok: true, data: res };
  } catch (e) {
    console.error("[voz] GET audio:", e instanceof Error ? e.message : e);
    return { ok: false, error: "sin_conexion" };
  }
}
