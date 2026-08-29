"use client";

import { useEffect, useRef } from "react";

type Opciones = {
  intervaloMs: number;
  /** false = el poll se congela (mutación en vuelo, sin chat elegido…). */
  habilitado?: boolean;
};

/**
 * Poll fino para la bandeja en vivo: dispara `tick` cada `intervaloMs`,
 * se pausa cuando la pestaña está oculta (y hace un tick de alcance al
 * volver), y jamás solapa dos ticks. Los errores los maneja el `tick` del
 * consumidor (patrón del panel: degradar, no romper). El hook no tiene
 * ningún estado propio — todo setState del consumidor ocurre dentro del
 * callback asíncrono, nunca en el cuerpo de un effect.
 */
export function usePollingVivo(
  tick: () => Promise<void>,
  { intervaloMs, habilitado = true }: Opciones,
): void {
  const tickRef = useRef(tick);
  const enVueloRef = useRef(false);

  useEffect(() => {
    tickRef.current = tick;
  });

  useEffect(() => {
    if (!habilitado) return;

    const disparar = () => {
      if (document.visibilityState !== "visible" || enVueloRef.current) return;
      enVueloRef.current = true;
      void tickRef.current().finally(() => {
        enVueloRef.current = false;
      });
    };

    const alVolver = () => {
      if (document.visibilityState === "visible") disparar();
    };

    const id = setInterval(disparar, intervaloMs);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [intervaloMs, habilitado]);
}
