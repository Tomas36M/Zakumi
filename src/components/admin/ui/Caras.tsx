"use client";

import type { LucideIcon } from "lucide-react";
import type { CaraDef } from "@/lib/admin/caras";
import { cn } from "@/lib/cn";

type Props<T extends string> = {
  caras: readonly CaraDef<T>[];
  iconos: Record<T, LucideIcon>;
  activa: T;
  onCambiar: (id: T) => void;
  /** Nombre accesible del grupo («Las dos caras de Zak»). */
  etiqueta: string;
};

/**
 * Las caras de una pantalla, en su cabecera. Deliberadamente NO son <Tabs>:
 * viven un nivel POR ENCIMA de las pestañas (cada cara tiene las suyas), y si
 * se vieran iguales los dos niveles se leerían como uno. Por eso son
 * tarjetas con icono y no píldoras.
 *
 * Compactas a propósito: van en la fila del título. El detalle vivo solo se
 * muestra cuando hay ancho de sobra.
 */
export function Caras<T extends string>({ caras, iconos, activa, onCambiar, etiqueta }: Props<T>) {
  return (
    <div role="tablist" aria-label={etiqueta} className="flex flex-wrap gap-1.5">
      {caras.map((c) => {
        // Anotado: el índice genérico `Record<T, …>[T]` no le vale a JSX.
        const Icono: LucideIcon = iconos[c.id];
        const esActiva = c.id === activa;
        return (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={esActiva}
            onClick={() => onCambiar(c.id)}
            className={cn(
              "flex items-center gap-2.5 rounded-fila border px-3 py-1.5 text-left transition-colors",
              esActiva
                ? "border-acento bg-acento-10"
                : "border-hairline hover:border-acento/40 hover:bg-acento-10/40",
            )}
          >
            <Icono className={cn("h-4 w-4 shrink-0", esActiva ? "text-acento" : "text-tinta-40")} />
            <span className="flex flex-col leading-tight">
              <span
                className={cn(
                  "flex items-center gap-1.5 text-sm font-semibold",
                  esActiva ? "text-tinta" : "text-tinta-60",
                )}
              >
                {c.label}
                {c.punto && (
                  <span
                    // Sin rol, un <span> es genérico y la tecnología asistiva
                    // le descarta el aria-label.
                    role="img"
                    aria-label={c.punto.titulo}
                    title={c.punto.titulo}
                    className={cn(
                      "h-1.5 w-1.5 rounded-full bg-acento",
                      c.punto.pulsa && "animate-pulse",
                    )}
                  />
                )}
              </span>
              {c.detalle && (
                <span className="hidden text-xs text-tinta-40 min-[1100px]:inline">
                  {c.detalle}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
