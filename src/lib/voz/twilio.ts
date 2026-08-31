// Cliente de Twilio para la telefonía del panel (/admin/voz → Telefonía).
//
// SOLO SERVIDOR: TWILIO_ACCOUNT_SID + (API key o auth token — ver
// credenciales() abajo; sin prefijo NEXT_PUBLIC a propósito, porque con esas
// credenciales se compran números y se gastan dólares). Contrato degradable:
// Resultado<T> y JAMÁS lanza.
//
// Twilio habla form-encoded en los POST (no JSON) y Basic auth con
// sid:token — no es un capricho, su API es de 2010.

export type ErrorTwilio =
  | "sin_configurar" // falta el Account SID o el par de credenciales
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

/**
 * Credenciales de Twilio. Dos formas, en orden de preferencia:
 *
 *  1. **API key** (`TWILIO_API_KEY_SID` + `TWILIO_API_KEY_SECRET`): el usuario
 *     del Basic auth es el `SK…`, pero la URL sigue llevando el Account SID.
 *     Preferida porque se revoca sola, sin tumbar el resto de la cuenta.
 *  2. **Auth token** (`TWILIO_AUTH_TOKEN`): la credencial maestra; sirve, pero
 *     revocarla obliga a re-configurar todo lo que la use.
 *
 * `cuenta` va en la ruta; `usuario`/`clave` en el Basic auth.
 */
function credenciales(): { cuenta: string; usuario: string; clave: string } | null {
  const cuenta = process.env.TWILIO_ACCOUNT_SID;
  if (!cuenta) return null;

  const keySid = process.env.TWILIO_API_KEY_SID;
  const keySecret = process.env.TWILIO_API_KEY_SECRET;
  if (keySid && keySecret) return { cuenta, usuario: keySid, clave: keySecret };

  const token = process.env.TWILIO_AUTH_TOKEN;
  if (token) return { cuenta, usuario: cuenta, clave: token };

  return null;
}

/** true si el panel puede operar telefonía (para degradar la UI). */
export function twilioConfigurado(): boolean {
  return credenciales() !== null;
}

/** Las credenciales para importar el número en ElevenLabs. SOLO servidor:
 * quien la llame no puede devolverlas al browser. */
export function credencialesTwilio(): { sid: string; token: string } | null {
  const c = credenciales();
  if (!c) return null;
  // ElevenLabs documenta el par de CUENTA (Account SID + Auth Token) y podría
  // usar el `sid` para armar la ruta /Accounts/{sid}/… — si el auth token está
  // disponible, se le manda ese par. Si solo hay API key, se le manda esa
  // (verificado el 2026-08-31: la acepta y llega a hablar con Twilio).
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (token) return { sid: c.cuenta, token };
  return { sid: c.usuario, token: c.clave };
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
    console.error("[twilio] falta TWILIO_ACCOUNT_SID o el par de credenciales");
    return { ok: false, error: "sin_configurar" };
  }
  const auth = Buffer.from(`${cred.usuario}:${cred.clave}`).toString("base64");
  try {
    const res = await fetch(`${BASE}/Accounts/${encodeURIComponent(cred.cuenta)}${path}`, {
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
      return "Falta conectar Twilio en el servidor: TWILIO_ACCOUNT_SID más la API key (TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET) o el TWILIO_AUTH_TOKEN.";
    case "sin_conexion":
      return "Twilio no respondió. Inténtalo de nuevo en un momento.";
    case "no_autorizado":
      return "Twilio rechazó las credenciales (¿la API key sigue activa?).";
    case "saldo_insuficiente":
      return (
        "Tu cuenta de Twilio está en modo trial y no permite buscar ni comprar " +
        "números. Entra a twilio.com → \"Upgrade for full access\", agrega fondos " +
        "y vuelve a intentar."
      );
    case "regulacion":
      return "Ese país exige documentación (bundle regulatorio) en Twilio antes de comprar. Prueba con un número de Estados Unidos.";
    case "no_disponible":
      return "Ese número ya no está disponible — busca otro.";
    default:
      return "Twilio devolvió un error inesperado.";
  }
}
