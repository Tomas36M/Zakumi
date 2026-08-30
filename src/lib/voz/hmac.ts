// Firma de los webhooks de ElevenLabs: header `ElevenLabs-Signature` con
// formato `t=<unix_seconds>,v0=<hex>` donde v0 = HMAC-SHA256(secret, `t.rawBody`).
// Portado de la verificación probada en producción por Luci
// (supabase/functions/_shared/elevenlabs-hmac.ts): tolerancia 30 min hacia
// atrás (igual que el SDK oficial) + 5 min de margen hacia el futuro (relojes
// desincronizados), comparación timing-safe y SIEMPRE sobre el raw body exacto
// — re-serializar el JSON cambia los bytes y rompe la firma.

import { createHmac, timingSafeEqual } from "node:crypto";

export const TOLERANCIA_ATRAS_S = 30 * 60;
export const TOLERANCIA_FUTURO_S = 5 * 60;

export type ResultadoFirma =
  | { ok: true }
  | { ok: false; motivo: "sin_header" | "malformada" | "expirada" | "no_coincide" };

export function firmar(rawBody: string, secret: string, timestampS: number): string {
  const v0 = createHmac("sha256", secret).update(`${timestampS}.${rawBody}`).digest("hex");
  return `t=${timestampS},v0=${v0}`;
}

export function verificarFirma(
  rawBody: string,
  header: string | null,
  secret: string,
  ahoraS: number = Math.floor(Date.now() / 1000),
): ResultadoFirma {
  if (!header) return { ok: false, motivo: "sin_header" };

  let t: number | null = null;
  let v0: string | null = null;
  for (const parte of header.split(",")) {
    const [clave, valor] = parte.split("=", 2);
    if (clave?.trim() === "t" && /^[0-9]{1,12}$/.test(valor ?? "")) t = Number(valor);
    if (clave?.trim() === "v0" && /^[0-9a-f]{64}$/i.test(valor ?? "")) v0 = valor;
  }
  if (t === null || v0 === null) return { ok: false, motivo: "malformada" };

  if (t < ahoraS - TOLERANCIA_ATRAS_S || t > ahoraS + TOLERANCIA_FUTURO_S) {
    return { ok: false, motivo: "expirada" };
  }

  const esperado = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest();
  const recibido = Buffer.from(v0, "hex");
  if (esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) {
    return { ok: false, motivo: "no_coincide" };
  }
  return { ok: true };
}
