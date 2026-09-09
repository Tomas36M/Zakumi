/**
 * El tope de gasto de una tanda, medido en llamadas EMITIDAS y cobrado ANTES
 * de despachar cada una.
 *
 * Antes el tope se miraba en un efecto de React, después de renderizar: los
 * cuatro workers ya habían puesto su siguiente fetch en vuelo cuando el efecto
 * llamaba a pausar, y las llamadas en vuelo se cobran igual. Con la cuota
 * gratis como techo, esas "unas pocas de más" eran justo las primeras que
 * Google cobraba — sobre un botón que decía "gratis". Acá el permiso se pide
 * en el worker, en el mismo tick síncrono en que se despacha, así que el
 * límite es exacto: se emiten `limite` llamadas y ni una más.
 */
export type Presupuesto = {
  /** Pide permiso para UNA emisión. `true` = concedida y contada. */
  emitir(): boolean;
  agotado(): boolean;
  emitidas(): number;
};

/** `undefined` = sin límite. Cero, negativo o basura = nada: cuando se trata
 * de plata, la duda frena. */
export function presupuestoDeEmisiones(limite: number | undefined): Presupuesto {
  const tope =
    limite === undefined
      ? Number.POSITIVE_INFINITY
      : Number.isFinite(limite) && limite > 0
        ? Math.floor(limite)
        : 0;
  let usadas = 0;
  return {
    emitir() {
      if (usadas >= tope) return false;
      usadas += 1;
      return true;
    },
    agotado() {
      return usadas >= tope;
    },
    emitidas() {
      return usadas;
    },
  };
}
