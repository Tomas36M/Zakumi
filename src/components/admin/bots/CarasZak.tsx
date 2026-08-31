"use client";

import { AudioLines, MessageCircle } from "lucide-react";
import type { CaraZak } from "@/lib/admin/zak-caras";
import { cn } from "@/lib/cn";

type Props = {
  activa: CaraZak;
  onCambiar: (cara: CaraZak) => void;
  /** Marca la cara de voz con un punto cuando aún no está operativa. */
  vozPendiente?: boolean;
};

const CARAS = [
  {
    id: "chat" as const,
    Icono: MessageCircle,
    label: "Chat",
    detalle: "WhatsApp · bandeja y prospección",
  },
  {
    id: "voz" as const,
    Icono: AudioLines,
    label: "Voz",
    detalle: "llamadas con IA",
  },
];

/**
 * Las dos caras del mismo empleado. Deliberadamente NO son <Tabs>: viven un
 * nivel por encima (cada cara tiene sus propias pestañas), así que se leen
 * como tarjetas y no como píldoras, o el usuario no distingue los dos niveles.
 */
export function CarasZak({ activa, onCambiar, vozPendiente = false }: Props) {
  return (
    <div role="tablist" aria-label="Las dos caras de Zak" className="flex flex-wrap gap-2">
      {CARAS.map(({ id, Icono, label, detalle }) => {
        const esActiva = id === activa;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={esActiva}
            onClick={() => onCambiar(id)}
            className={cn(
              "flex items-center gap-3 rounded-fila border px-4 py-2.5 text-left transition-colors",
              esActiva
                ? "border-acento bg-acento-10"
                : "border-hairline hover:border-acento/40 hover:bg-acento-10/40",
            )}
          >
            <Icono
              className={cn("h-5 w-5 shrink-0", esActiva ? "text-acento" : "text-tinta-40")}
            />
            <span className="flex flex-col">
              <span
                className={cn(
                  "flex items-center gap-1.5 text-sm font-semibold",
                  esActiva ? "text-tinta" : "text-tinta-60",
                )}
              >
                {label}
                {id === "voz" && vozPendiente && (
                  <span
                    aria-label="sin configurar"
                    title="Zak todavía no tiene voz"
                    className="h-1.5 w-1.5 rounded-full bg-acento"
                  />
                )}
              </span>
              <span className="text-xs text-tinta-40">{detalle}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
