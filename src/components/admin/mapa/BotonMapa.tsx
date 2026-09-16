"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  Icono: LucideIcon;
  /** Lo que hace, en una o dos palabras: se lee al pasar el ratón y es el aria-label. */
  etiqueta: string;
  /** La frase larga, para el tooltip del navegador. Por defecto, la etiqueta. */
  titulo?: string;
  activa?: boolean;
  disabled?: boolean;
  /** La etiqueta crece hacia la izquierda (columna derecha) o hacia la derecha. */
  hacia?: "izquierda" | "derecha";
  onClick: () => void;
};

/**
 * El botón redondo del mapa: un icono que al pasar el ratón despliega su
 * etiqueta. Es el lenguaje de los controles del mapa (zoom, satélite, pantalla
 * completa) y ahora también el de las acciones (dibujar, buscar, añadir), para
 * que todo lo que flota sobre el lienzo se vea igual.
 */
export function BotonMapa({
  Icono,
  etiqueta,
  titulo,
  activa = false,
  disabled = false,
  hacia = "izquierda",
  onClick,
}: Props) {
  const texto = (
    <span
      className={cn(
        "max-w-0 overflow-hidden text-xs font-medium whitespace-nowrap opacity-0 transition-all duration-300 group-hover:max-w-40 group-hover:opacity-100",
        hacia === "izquierda" ? "group-hover:pl-3" : "group-hover:pr-3",
      )}
    >
      {etiqueta}
    </span>
  );

  return (
    <button
      type="button"
      aria-label={etiqueta}
      aria-pressed={activa}
      title={titulo ?? etiqueta}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group flex h-9 items-center overflow-hidden rounded-full border bg-isla/90 backdrop-blur-sm transition-colors",
        hacia === "izquierda" ? "self-end" : "self-start",
        disabled
          ? "cursor-not-allowed border-hairline text-tinta-40 opacity-60"
          : "hover:border-acento/40 hover:text-tinta",
        activa ? "border-acento text-acento" : "border-hairline text-tinta-60",
      )}
    >
      {hacia === "izquierda" && texto}
      <span className="flex h-9 w-9 shrink-0 items-center justify-center">
        <Icono className="h-4 w-4" />
      </span>
      {hacia === "derecha" && texto}
    </button>
  );
}
