"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Pantalla completa por CSS (`fixed inset-0`), no por la Fullscreen API:
 * así los modales de Radix siguen montándose encima y Escape sale sin más.
 * Patrón del mapa de LUCI.
 */
export function usePantallaCompleta(): [activa: boolean, alternar: () => void] {
  const [activa, setActiva] = useState(false);

  useEffect(() => {
    if (!activa) return;
    function alTeclear(e: KeyboardEvent) {
      if (e.key === "Escape") setActiva(false);
    }
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [activa]);

  const alternar = useCallback(() => setActiva((a) => !a), []);
  return [activa, alternar];
}
