"use client";

import { ESTADOS, type EstadoNegocio } from "@/lib/admin/negocios";
import { cn } from "@/lib/cn";
import { COLOR_ESTADO } from "@/components/admin/leads/colores";

type Props = {
  /** Cuántos hay en cada estado, con los demás filtros ya aplicados. */
  conteos: Record<EstadoNegocio, number>;
  /** El estado filtrado, o null para todos. */
  activo: EstadoNegocio | null;
  onElegir: (estado: EstadoNegocio | null) => void;
};

/** Cuántos negocios hay en cada paso del pipeline, y el filtro por estado en
 * un toque: tocar un estado lo filtra; tocarlo otra vez lo suelta. */
export function FranjaEstados({ conteos, activo, onElegir }: Props) {
  const total = ESTADOS.reduce((s, e) => s + conteos[e.valor], 0);

  return (
    <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-1.5">
      <Chip activa={activo === null} onClick={() => onElegir(null)}>
        Todos <Cuenta>{total}</Cuenta>
      </Chip>
      {ESTADOS.map((e) => (
        <Chip
          key={e.valor}
          activa={activo === e.valor}
          onClick={() => onElegir(activo === e.valor ? null : e.valor)}
        >
          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${COLOR_ESTADO[e.valor]}`} />
          {e.label} <Cuenta>{conteos[e.valor]}</Cuenta>
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
        activa
          ? "border-acento bg-acento-10 text-tinta"
          : "border-hairline text-tinta-60 hover:border-acento/40 hover:text-tinta",
      )}
    >
      {children}
    </button>
  );
}

function Cuenta({ children }: { children: React.ReactNode }) {
  return <span className="tabular-nums text-tinta-40">{children}</span>;
}
