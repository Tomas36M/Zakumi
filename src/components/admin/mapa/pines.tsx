import { COLOR_ESTADO } from "@/components/admin/leads/colores";

// Los pines del mapa hablan tres idiomas a la vez y cada uno va por un canal
// distinto, para que se puedan leer los tres de un vistazo:
//   - relleno = estado del pipeline (COLOR_PIN),
//   - anillo naranja = sin sitio web (el lead que queremos),
//   - contorno naranja hueco = resultado de búsqueda sin importar.
// Clases literales: Tailwind no ve plantillas. La leyenda importa estas mismas
// constantes, así que lo que explica es exactamente lo que se pinta.

/** Rombos por estado — mismo lenguaje que chips y badges. */
export const COLOR_PIN = COLOR_ESTADO;

export const PIN_BASE =
  "h-4 w-4 rotate-45 border-[1.5px] border-black/80 shadow-[0_1px_4px_rgba(0,0,0,0.5)] transition-transform duration-150";
export const PIN_ACTIVO = "scale-[1.45] border-white";
export const PIN_SIN_WEB = "ring-2 ring-offset-1 ring-acento ring-offset-transparent";
export const PIN_RESULTADO = "border-2 border-acento bg-transparent";
export const PIN_NUEVO = "border-acento bg-white";

/** Padding de 9px = target táctil ~34px sobre el pin de 16px. */
export function PinHit({ children }: { children: React.ReactNode }) {
  return <div className="cursor-pointer p-[9px]">{children}</div>;
}
