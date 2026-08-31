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
  | "plan_insuficiente" // la voz de la biblioteca exige un plan pago mayor
  | "eleven_error"; // 5xx o cualquier otra cosa

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: ErrorVoz };

export type VozEleven = {
  voice_id: string;
  nombre: string;
  preview_url: string | null;
  etiquetas: string;
  /** labels.language de ElevenLabs ("es", "en", …) — null si no viene. */
  idioma: string | null;
};

/** Una voz de la biblioteca compartida de ElevenLabs (aún no en el workspace). */
export type VozCompartida = {
  public_owner_id: string;
  voice_id: string;
  nombre: string;
  idioma: string | null;
  locale: string | null;
  etiquetas: string;
  preview_url: string | null;
};

const BASE = "https://api.elevenlabs.io";

type Crudo = { status: number; json: unknown };

async function llamar(
  metodo: "GET" | "POST" | "PATCH" | "DELETE",
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
  metodo: "GET" | "POST" | "PATCH" | "DELETE",
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

/** Borra el agente en ElevenLabs. SOLO con agent_id guardados en agentes_voz
 * (workspace compartido: jamás borrar agentes de Luci). */
export function eliminarAgenteEleven(agentId: string): Promise<Resultado<true>> {
  return pedir("DELETE", `/v1/convai/agents/${encodeURIComponent(agentId)}`, () => true);
}

// ---------- Voces del workspace (incluye las de Luci: se muestran, no pasa nada) ----------

function etiquetasDe(labels: Record<string, unknown>, claves: readonly string[]): string {
  return claves
    .map((k) => labels[k])
    .filter((x): x is string => typeof x === "string" && x !== "")
    .join(" · ");
}

/** Parser PURO del GET /v2/voices (testeable sin red). */
export function parseVocesWorkspace(json: unknown): VozEleven[] {
  const voces = (json as { voices?: unknown })?.voices;
  if (!Array.isArray(voces)) return [];
  return voces
    .map((v) => {
      const voz = (v ?? {}) as Record<string, unknown>;
      const labels = (voz.labels ?? {}) as Record<string, unknown>;
      return {
        voice_id: String(voz.voice_id ?? ""),
        nombre: String(voz.name ?? "(sin nombre)"),
        preview_url: typeof voz.preview_url === "string" ? voz.preview_url : null,
        etiquetas: etiquetasDe(labels, ["accent", "gender", "age", "description"]),
        idioma: typeof labels.language === "string" ? labels.language : null,
      };
    })
    .filter((v) => v.voice_id !== "");
}

export function listarVoces(): Promise<Resultado<VozEleven[]>> {
  return pedir("GET", "/v2/voices?page_size=100", parseVocesWorkspace);
}

// ---------- Biblioteca compartida: voces en español para el workspace ----------

/** Parser PURO del GET /v1/shared-voices (testeable sin red). */
export function parseVocesCompartidas(json: unknown): VozCompartida[] {
  const voces = (json as { voices?: unknown })?.voices;
  if (!Array.isArray(voces)) return [];
  return voces
    .map((v) => {
      const voz = (v ?? {}) as Record<string, unknown>;
      return {
        public_owner_id: String(voz.public_owner_id ?? ""),
        voice_id: String(voz.voice_id ?? ""),
        nombre: String(voz.name ?? "(sin nombre)"),
        idioma: typeof voz.language === "string" ? voz.language : null,
        locale: typeof voz.locale === "string" ? voz.locale : null,
        etiquetas: etiquetasDe(voz, ["accent", "gender", "age", "use_case"]),
        preview_url: typeof voz.preview_url === "string" ? voz.preview_url : null,
      };
    })
    .filter((v) => v.voice_id !== "" && v.public_owner_id !== "");
}

/** Acentos que ofrece la biblioteca ("" = todo español). Única fuente:
 * los chips de la UI y la whitelist del server action salen de aquí. */
export const LOCALES_BIBLIOTECA: readonly { valor: string; label: string }[] = [
  { valor: "es-CO", label: "Colombia" },
  { valor: "es-MX", label: "México" },
  { valor: "es-AR", label: "Argentina" },
  { valor: "es-ES", label: "España" },
  { valor: "", label: "Todo español" },
] as const;

/**
 * Busca voces en la biblioteca pública de ElevenLabs. El workspace nace con
 * puras voces en inglés; el español (el idioma principal del negocio) se trae
 * de aquí — hay cientos con locale es-CO / es-MX / es-ES.
 */
export function buscarVocesCompartidas(opts: {
  locale?: string;
  busqueda?: string;
}): Promise<Resultado<VozCompartida[]>> {
  const params = new URLSearchParams({ page_size: "24", language: "es" });
  if (opts.locale) params.set("locale", opts.locale);
  if (opts.busqueda) params.set("search", opts.busqueda);
  return pedir("GET", `/v1/shared-voices?${params.toString()}`, parseVocesCompartidas);
}

/** Agrega una voz de la biblioteca al workspace (aparece en el selector). */
export async function agregarVozCompartida(
  publicOwnerId: string,
  voiceId: string,
  nuevoNombre: string,
): Promise<Resultado<{ voice_id: string }>> {
  const path = `/v1/voices/add/${encodeURIComponent(publicOwnerId)}/${encodeURIComponent(voiceId)}`;
  const r = await llamar("POST", path, { new_name: nuevoNombre });
  if (!r.ok) return r;
  const { status, json } = r.data;
  if (status >= 200 && status < 300) {
    return {
      ok: true,
      data: { voice_id: String((json as { voice_id?: unknown })?.voice_id ?? voiceId) },
    };
  }
  // Verificado contra la API (2026-08-30): algunas voces de la biblioteca
  // responden 400 {detail:{code:'paid_plan_required'}} — merece su propio
  // mensaje, no el genérico de payload rechazado.
  const code = ((json as { detail?: { code?: unknown } })?.detail?.code ?? "") as string;
  if (code === "paid_plan_required") return { ok: false, error: "plan_insuficiente" };
  console.error(`[voz] POST ${path} → ${status}:`, JSON.stringify(json)?.slice(0, 300));
  return { ok: false, error: errorDeStatus(status) };
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

// ---------- Estado de una conversación (polling del lab) ----------

export type EstadoConversacionEleven =
  | "initiated"
  | "in-progress"
  | "processing"
  | "done"
  | "failed"
  | "desconocido";

export type ConversacionEleven = {
  conversation_id: string;
  status: EstadoConversacionEleven;
};

const ESTADOS_CONVERSACION: readonly string[] = [
  "initiated",
  "in-progress",
  "processing",
  "done",
  "failed",
];

/**
 * Parser PURO del GET /v1/convai/conversations/{id} (testeable sin red).
 * Un status que no conocemos no revienta el polling: cae a "desconocido",
 * mismo criterio defensivo que el parseo del webhook.
 */
export function parseConversacionEleven(json: unknown): ConversacionEleven {
  const c = (json ?? {}) as Record<string, unknown>;
  return {
    conversation_id: typeof c.conversation_id === "string" ? c.conversation_id : "",
    status:
      typeof c.status === "string" && ESTADOS_CONVERSACION.includes(c.status)
        ? (c.status as EstadoConversacionEleven)
        : "desconocido",
  };
}

export function obtenerConversacion(
  conversationId: string,
): Promise<Resultado<ConversacionEleven>> {
  return pedir(
    "GET",
    `/v1/convai/conversations/${encodeURIComponent(conversationId)}`,
    parseConversacionEleven,
  );
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
