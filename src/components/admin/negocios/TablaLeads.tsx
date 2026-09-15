"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { dominioDe } from "@/lib/admin/filtros-leads";
import { ESTADOS, type EstadoNegocio, type Negocio } from "@/lib/admin/negocios";
import { linkChatZak } from "@/lib/admin/zak";
import { Select } from "@/components/admin/ui/Field";
import { ListRow } from "@/components/admin/ui/ListRow";
import { COLOR_ESTADO } from "@/components/admin/leads/colores";

const GRID_FILA =
  "grid grid-cols-[auto_minmax(0,3fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_auto_2.5rem] items-center gap-3";

type Props = {
  /** La página visible de la lista (hasta 50, ya filtrados por la base). */
  negocios: Negocio[];
  seleccionados: ReadonlySet<string>;
  guardando: boolean;
  onAlternar: (id: string) => void;
  onAlternarTodos: () => void;
  onEstado: (id: string, estado: EstadoNegocio) => void;
  /** La fila entera abre la ficha del lead. */
  onAbrir: (id: string) => void;
};

/** La "tabla" de leads: un grid de ListRow con checkbox, estado editable en
 * línea y el atajo al chat de Zak. */
export function TablaLeads({
  negocios,
  seleccionados,
  guardando,
  onAlternar,
  onAlternarTodos,
  onEstado,
  onAbrir,
}: Props) {
  const todos = negocios.length > 0 && negocios.every((n) => seleccionados.has(n.id));

  return (
    <div className="barra-fina overflow-x-auto">
      <div className="flex min-w-[780px] flex-col gap-1">
        <div
          className={`${GRID_FILA} px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-tinta-40`}
        >
          <input
            type="checkbox"
            className="accent-acento"
            aria-label="Seleccionar esta página"
            checked={todos}
            onChange={onAlternarTodos}
          />
          <span>Negocio</span>
          <span>Ciudad</span>
          <span>Teléfono</span>
          <span>Sitio web</span>
          <span>Estado</span>
          <span aria-label="Acciones" />
        </div>
        {negocios.map((n) => {
          const link = linkChatZak(n);
          return (
            <ListRow
              key={n.id}
              activa={seleccionados.has(n.id)}
              className={`${GRID_FILA} py-3.5`}
              // La fila abre la ficha, pero cede ante los controles
              // (checkbox/select/link) y ante una selección de texto (copiar
              // el teléfono no debe abrir nada).
              onClick={(e) => {
                const objetivo = e.target as HTMLElement;
                if (objetivo.closest("a, input, select, label, button")) return;
                if (window.getSelection()?.toString()) return;
                onAbrir(n.id);
              }}
            >
              <input
                type="checkbox"
                className="accent-acento"
                aria-label={`Seleccionar ${n.nombre}`}
                checked={seleccionados.has(n.id)}
                onChange={() => onAlternar(n.id)}
              />
              <span className="min-w-0">
                <button
                  type="button"
                  className="block max-w-full truncate text-left text-[15px] font-medium text-tinta hover:text-acento"
                  onClick={() => onAbrir(n.id)}
                >
                  {n.nombre}
                </button>
                {n.categoria ? (
                  <span className="block truncate text-xs text-tinta-40">
                    {n.categoria.replaceAll("_", " ")}
                  </span>
                ) : null}
              </span>
              <span className="truncate text-sm text-tinta-60">
                {n.ciudad ?? <span className="text-tinta-40">—</span>}
              </span>
              <span className="text-sm tabular-nums text-tinta-60">
                {n.telefono ?? <span className="text-tinta-40">—</span>}
                {n.tipo_telefono === "fijo" ? (
                  <span className="text-xs text-tinta-40"> fijo</span>
                ) : null}
              </span>
              <span className="min-w-0 truncate text-sm">
                {n.sitio_web ? (
                  <a
                    href={n.sitio_web}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-tinta-60 underline-offset-2 hover:text-tinta hover:underline"
                  >
                    {dominioDe(n.sitio_web)}
                  </a>
                ) : (
                  // Es la señal que se está buscando, no un dato secundario.
                  <span className="font-medium text-acento">Sin web</span>
                )}
              </span>
              <label className="flex items-center gap-1.5">
                <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${COLOR_ESTADO[n.estado]}`} />
                <Select
                  className="h-8 w-36 text-xs"
                  value={n.estado}
                  aria-label={`Estado de ${n.nombre}`}
                  disabled={guardando}
                  onChange={(e) => onEstado(n.id, e.target.value as EstadoNegocio)}
                >
                  {ESTADOS.map((e) => (
                    <option key={e.valor} value={e.valor}>
                      {e.label}
                    </option>
                  ))}
                </Select>
              </label>
              <span className="flex justify-end">
                {link !== null ? (
                  <Link
                    title="Chat Zak"
                    aria-label={`Chat de Zak con ${n.nombre}`}
                    href={link}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-tinta-60 transition-colors hover:bg-isla-alta hover:text-tinta"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Link>
                ) : null}
              </span>
            </ListRow>
          );
        })}
      </div>
    </div>
  );
}
