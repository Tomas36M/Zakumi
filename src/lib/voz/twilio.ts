// Cliente de Twilio para la telefonía del panel (/admin/voz → Telefonía).
//
// SOLO SERVIDOR: usa TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN (sin prefijo
// NEXT_PUBLIC a propósito — con esas credenciales se compran números y se
// gastan dólares). Mismo contrato degradable que el resto de lib/voz:
// Resultado<T> y JAMÁS lanza.
//
// Twilio habla form-encoded en los POST (no JSON) y Basic auth con
// sid:token — no es un capricho, su API es de 2010.

export type ErrorTwilio =
  | "sin_configurar" // faltan TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN
  | "sin_conexion"
  | "no_autorizado" // credenciales malas
  | "saldo_insuficiente" // 21606 y familia: la cuenta no puede comprar
  | "regulacion" // el país exige documentación (típico en CO)
  | "no_disponible" // el número se lo llevaron entre la búsqueda y la compra
  | "twilio_error";

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: ErrorTwilio };

export type NumeroDisponible = {
  numero: string; // E.164
  amigable: string;
  localidad: string | null;
  region: string | null;
  voz: boolean;
};

export type NumeroComprado = {
  sid: string;
  numero: string;
};

const BASE = "https://api.twilio.com/2010-04-01";

function credenciales(): { sid: string; token: string } | null {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return { sid, token };
}

/** true si el panel puede operar telefonía (para degradar la UI). */
export function twilioConfigurado(): boolean {
  return credenciales() !== null;
}

/** Las credenciales para importar el número en ElevenLabs. SOLO servidor:
 * quien la llame no puede devolverlas al browser. */
export function credencialesTwilio(): { sid: string; token: string } | null {
  return credenciales();
}

function errorDe(status: number, json: unknown): ErrorTwilio {
  if (status === 401) return "no_autorizado";
  const code = Number((json as { code?: unknown })?.code ?? 0);
  // Códigos de Twilio: 21404 número ya no disponible, 21606 no comprable con
  // el saldo/tipo de cuenta, 21649/21631 exigen bundle regulatorio del país.
  if (code === 21404) return "no_disponible";
  if (code === 21606 || code === 20003) return "saldo_insuficiente";
  if (code === 21649 || code === 21631 || code === 21622) return "regulacion";
  return "twilio_error";
}

async function llamar(
  metodo: "GET" | "POST",
  path: string,
  form?: Record<string, string>,
): Promise<Resultado<unknown>> {
  const cred = credenciales();
  if (!cred) {
    console.error("[twilio] faltan TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN");
    return { ok: false, error: "sin_configurar" };
  }
  const auth = Buffer.from(`${cred.sid}:${cred.token}`).toString("base64");
  try {
    const res = await fetch(`${BASE}/Accounts/${encodeURIComponent(cred.sid)}${path}`, {
      method: metodo,
      headers: {
        Authorization: `Basic ${auth}`,
        ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body: form ? new URLSearchParams(form).toString() : undefined,
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      console.error(`[twilio] ${metodo} ${path} → ${res.status}:`, JSON.stringify(json)?.slice(0, 300));
      return { ok: false, error: errorDe(res.status, json) };
    }
    return { ok: true, data: json };
  } catch (e) {
    console.error(`[twilio] ${metodo} ${path}:`, e instanceof Error ? e.message : e);
    return { ok: false, error: "sin_conexion" };
  }
}

/** Parser PURO del listado de números disponibles (testeable sin red). */
export function parseNumerosDisponibles(json: unknown): NumeroDisponible[] {
  const filas = (json as { available_phone_numbers?: unknown })?.available_phone_numbers;
  if (!Array.isArray(filas)) return [];
  return filas
    .map((f) => {
      const n = (f ?? {}) as Record<string, unknown>;
      const caps = (n.capabilities ?? {}) as Record<string, unknown>;
      return {
        numero: String(n.phone_number ?? ""),
        amigable: String(n.friendly_name ?? n.phone_number ?? ""),
        localidad: typeof n.locality === "string" ? n.locality : null,
        region: typeof n.region === "string" ? n.region : null,
        voz: caps.voice === true,
      };
    })
    .filter((n) => n.numero !== "");
}

/**
 * Números comprables en un país. Solo con voz: un número sin voz no sirve
 * para un agente telefónico por barato que sea.
 */
export async function buscarNumeros(
  pais: string,
  prefijo?: string,
): Promise<Resultado<NumeroDisponible[]>> {
  const params = new URLSearchParams({ VoiceEnabled: "true", PageSize: "20" });
  if (prefijo) params.set("AreaCode", prefijo);
  const r = await llamar(
    "GET",
    `/AvailablePhoneNumbers/${encodeURIComponent(pais)}/Local.json?${params.toString()}`,
  );
  if (!r.ok) return r;
  return { ok: true, data: parseNumerosDisponibles(r.data) };
}

/** COMPRA el número: cuesta dinero real (~US$1.15/mes). La UI confirma antes. */
export async function comprarNumero(numero: string): Promise<Resultado<NumeroComprado>> {
  const r = await llamar("POST", "/IncomingPhoneNumbers.json", { PhoneNumber: numero });
  if (!r.ok) return r;
  const n = (r.data ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    data: { sid: String(n.sid ?? ""), numero: String(n.phone_number ?? numero) },
  };
}

export function mensajeTwilio(error: ErrorTwilio): string {
  switch (error) {
    case "sin_configurar":
      return "Falta conectar Twilio: TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN en el servidor.";
    case "sin_conexion":
      return "Twilio no respondió. Inténtalo de nuevo en un momento.";
    case "no_autorizado":
      return "Twilio rechazó las credenciales (¿SID y token correctos?).";
    case "saldo_insuficiente":
      return "La cuenta de Twilio no puede comprar: revisa el saldo o sal del trial.";
    case "regulacion":
      return "Ese país exige documentación (bundle regulatorio) en Twilio antes de comprar. Prueba con un número de Estados Unidos.";
    case "no_disponible":
      return "Ese número ya no está disponible — busca otro.";
    default:
      return "Twilio devolvió un error inesperado.";
  }
}
