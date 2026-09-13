"use client";

import {
  CICLOS,
  TIPOS_PRODUCTO,
  descripcionVencimiento,
  formatearCOP,
  semaforoCobro,
  type ProductoConCliente,
} from "@/lib/admin/cartera";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { ListRow } from "@/components/admin/ui/ListRow";
import { COLOR_SEMAFORO } from "./semaforo";

const LABEL_TIPO = new Map(TIPOS_PRODUCTO.map((t) => [t.valor, t.label]));
const LABEL_CICLO = new Map(CICLOS.map((c) => [c.valor, c.label]));

const GRID_COBRO =
  "grid grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3";

type Props = {
  /** Ya ordenados por urgencia y solo activos. */
  cobros: ProductoConCliente[];
  hoy: string;
  clienteAbierto: string | null;
  onAbrir: (clienteId: string) => void;
};

/** Los próximos cobros, del más urgente al más lejano. Cada fila abre la
 * ficha de su cliente. */
export function ListaCobros({ cobros, hoy, clienteAbierto, onAbrir }: Props) {
  if (cobros.length === 0) {
    return (
      <EmptyState
        titulo="Todavía no hay cobros programados."
        detalle="Crea un cliente y agrégale su primer producto — el bot, su página web, lo que le vendas."
      />
    );
  }

  return (
    <div className="barra-fina overflow-x-auto">
      <div className="flex min-w-[560px] flex-col gap-1">
        <div className={`${GRID_COBRO} px-3 py-1.5 text-xs font-medium text-tinta-40`}>
          <span className="w-2" aria-label="Estado" />
          <span>Cliente</span>
          <span>Producto</span>
          <span>Tarifa</span>
          <span>Próximo cobro</span>
        </div>
        {cobros.map((p) => {
          const estado = semaforoCobro(p.proxima_fecha, hoy);
          return (
            <ListRow
              key={p.id}
              activa={p.cliente_id === clienteAbierto}
              className={GRID_COBRO}
              onClick={() => onAbrir(p.cliente_id)}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${COLOR_SEMAFORO[estado]}`}
                title={estado.replaceAll("_", " ")}
              />
              <span className="truncate text-sm font-medium text-tinta">
                {p.clientes?.nombre ?? "—"}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-tinta">{p.nombre}</span>
                <span className="block truncate text-xs text-tinta-40">
                  {LABEL_TIPO.get(p.tipo)}
                  {p.dominio ? ` · ${p.dominio}` : ""}
                </span>
              </span>
              <span className="text-sm text-tinta-60">
                {formatearCOP(p.tarifa)}
                <span className="text-xs text-tinta-40"> {LABEL_CICLO.get(p.ciclo)}</span>
              </span>
              <span
                className={
                  estado === "vencido" ? "text-sm font-medium text-peligro" : "text-sm text-tinta-60"
                }
              >
                {descripcionVencimiento(p.proxima_fecha, hoy)}
              </span>
            </ListRow>
          );
        })}
      </div>
    </div>
  );
}
