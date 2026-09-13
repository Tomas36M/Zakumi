"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ESTADOS } from "@/lib/admin/negocios";
import { cn } from "@/lib/cn";
import { COLOR_PIN, PIN_BASE, PIN_RESULTADO, PIN_SIN_WEB } from "./pines";

/** El rombo de la leyenda: el mismo pin, quieto y sin sombra. */
function Rombo({ className }: { className?: string }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center">
      <span className={cn(PIN_BASE, "h-3 w-3 shadow-none", className)} />
    </span>
  );
}

/**
 * Qué significa cada pin. Los colores salen de las MISMAS constantes que
 * pintan el mapa (`pines.tsx`), así que la leyenda no puede desactualizarse.
 * Plegable: en un mapa chico estorba más de lo que ayuda.
 */
export function Leyenda() {
  const [abierta, setAbierta] = useState(true);

  return (
    <div className="absolute bottom-10 left-3 z-10 max-w-[min(92%,16rem)] rounded-fila border border-hairline bg-isla/90 text-xs backdrop-blur-sm">
      <button
        type="button"
        aria-expanded={abierta}
        onClick={() => setAbierta((a) => !a)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 font-medium text-tinta-85"
      >
        Leyenda
        {abierta ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
      </button>
      {abierta && (
        <ul className="flex flex-col gap-0.5 px-2 pb-2">
          {ESTADOS.map((e) => (
            <li key={e.valor} className="flex items-center gap-1.5 text-tinta-60">
              <Rombo className={COLOR_PIN[e.valor]} />
              {e.label}
            </li>
          ))}
          <li className="mt-1 flex items-center gap-1.5 border-t border-hairline pt-1.5 text-tinta-60">
            <Rombo className={cn("bg-tinta-40/60", PIN_SIN_WEB)} />
            Sin sitio web
          </li>
          <li className="flex items-center gap-1.5 text-tinta-60">
            <Rombo className={PIN_RESULTADO} />
            Resultado sin importar
          </li>
          <li className="flex items-center gap-1.5 text-tinta-60">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center">
              <span className="h-3.5 w-3.5 rounded-sm border border-acento bg-acento/15" />
            </span>
            Territorio
          </li>
        </ul>
      )}
    </div>
  );
}
