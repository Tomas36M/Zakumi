"use client";

import { useEffect, useState } from "react";

/**
 * «Ahora», empezando por lo que dijo el servidor y avanzando cada minuto.
 * Nada de `new Date()` en render (el React Compiler lo marca y además
 * cambia entre servidor y navegador): el primer valor viene por props y los
 * siguientes salen de un intervalo.
 */
export function useAhora(inicialIso: string, cadaMs = 60_000): string {
  const [ahora, setAhora] = useState(inicialIso);
  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date().toISOString()), cadaMs);
    return () => clearInterval(timer);
  }, [cadaMs]);
  return ahora;
}
