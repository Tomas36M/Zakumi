"use client";

import { dominioDe } from "@/lib/admin/filtros-leads";
import { labelEstado, type Negocio } from "@/lib/admin/negocios";
import { ListRow } from "@/components/admin/ui/ListRow";
import { COLOR_ESTADO } from "./colores";

export const GRID_LEAD_COMPACTA =
  "grid grid-cols-[auto_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-3";

type Props = {
  negocio: Negocio;
  activa?: boolean;
  onAbrir: (id: string) => void;
};

/** Una fila de lead sin controles: punto de estado, nombre, teléfono y la
 * señal de «sin web». Toda la fila abre la ficha. */
export function FilaLeadCompacta({ negocio: n, activa = false, onAbrir }: Props) {
  return (
    <ListRow
      role="button"
      tabIndex={0}
      activa={activa}
      className={GRID_LEAD_COMPACTA}
      onClick={() => onAbrir(n.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAbrir(n.id);
        }
      }}
    >
      <span
        title={labelEstado(n.estado)}
        className={`h-2 w-2 shrink-0 rounded-full ${COLOR_ESTADO[n.estado]}`}
      />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-tinta">{n.nombre}</span>
        {n.categoria && (
          <span className="block truncate text-xs text-tinta-40">
            {n.categoria.replaceAll("_", " ")}
          </span>
        )}
      </span>
      <span className="truncate text-sm tabular-nums text-tinta-60">
        {n.telefono ?? <span className="text-tinta-40">—</span>}
        {n.tipo_telefono === "fijo" && <span className="text-xs text-tinta-40"> fijo</span>}
      </span>
      <span className="min-w-0 truncate text-sm">
        {n.sitio_web ? (
          <span className="text-tinta-60">{dominioDe(n.sitio_web)}</span>
        ) : (
          <span className="font-medium text-acento">Sin web</span>
        )}
      </span>
    </ListRow>
  );
}
