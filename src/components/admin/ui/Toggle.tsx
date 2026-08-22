"use client";

import { cn } from "@/lib/cn";

type Props = {
  activo: boolean;
  onCambiar: (valor: boolean) => void;
  etiqueta?: string;
  disabled?: boolean;
};

export function Toggle({ activo, onCambiar, etiqueta, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={disabled}
      onClick={() => onCambiar(!activo)}
      className="inline-flex items-center gap-2 disabled:pointer-events-none disabled:opacity-50"
    >
      <span
        className={cn(
          "flex h-4 w-7 items-center rounded-full p-0.5 transition-colors",
          activo ? "justify-end bg-acento" : "justify-start bg-tinta-40/40",
        )}
      >
        <span className="h-3 w-3 rounded-full bg-white transition-transform" />
      </span>
      {etiqueta && <span className="text-sm text-tinta-85">{etiqueta}</span>}
    </button>
  );
}
