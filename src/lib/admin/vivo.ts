// Lógica pura de la bandeja en vivo (testeable en vitest node).

/**
 * Igualdad barata por serialización, para que un tick del poll solo haga
 * setState cuando algo cambió de verdad (cero re-render, cero parpadeo).
 * Exacta y suficiente a los tamaños de la bandeja (≤50 filas / ≤50 mensajes,
 * ~10 KB): captura cambios que "longitud + último" no ve (pausa toggled,
 * orden de la lista, ultimo_del_cliente).
 */
export function mismoJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ---------- No-leídos estilo WhatsApp ----------
// El "visto" vive en localStorage del browser (cada admin tiene el suyo):
// cuándo abrió el chat por última vez y cuántos mensajes había.

export type Visto = { at: string; messages: number };

type ConvResumen = { phone: string; messages: number; last_at: string | null };

/** Mensajes sin leer de una conversación: 0 si el visto es posterior a la
 * última actividad; si no, la diferencia de conteos. Tiempos comparados por
 * Date.parse (el bot escribe "+00:00", el browser "Z"). */
export function noLeidos(c: ConvResumen, visto: Visto | undefined): number {
  if (!c.last_at) return 0;
  if (!visto) return c.messages;
  const ultima = Date.parse(c.last_at);
  const vistoEn = Date.parse(visto.at);
  if (!Number.isNaN(ultima) && !Number.isNaN(vistoEn) && vistoEn >= ultima) return 0;
  return Math.max(0, c.messages - visto.messages);
}

/** Primera visita (sin registro previo): todo lo existente queda como visto —
 * los contadores arrancan en silencio y solo cuenta la actividad NUEVA. */
export function sembrarVistos(convs: ConvResumen[]): Record<string, Visto> {
  const vistos: Record<string, Visto> = {};
  const ahora = new Date().toISOString();
  for (const c of convs) {
    vistos[c.phone] = { at: c.last_at ?? ahora, messages: c.messages };
  }
  return vistos;
}
