"use client";

import { cn } from "@/lib/cn";

type Pestana<T extends string> = { id: T; label: React.ReactNode };

type Props<T extends string> = {
  pestanas: readonly Pestana<T>[];
  activa: T;
  onCambiar: (id: T) => void;
};

/** Segmented control de píldoras. Genérico: T es la unión de ids de pestañas. */
export function Tabs<T extends string>({ pestanas, activa, onCambiar }: Props<T>) {
  return (
    <div
      role="tablist"
      className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-isla-alta p-1"
    >
      {pestanas.map((p) => (
        <button
          key={p.id}
          type="button"
          role="tab"
          aria-selected={p.id === activa}
          onClick={() => onCambiar(p.id)}
          className={cn(
            "h-8 shrink-0 rounded-full px-3.5 text-sm transition-colors",
            p.id === activa
              ? "bg-acento text-white"
              : "text-tinta-60 hover:bg-acento-10 hover:text-tinta",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
