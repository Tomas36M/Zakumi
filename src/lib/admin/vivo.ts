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
