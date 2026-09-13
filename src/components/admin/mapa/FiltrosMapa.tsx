"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { categoriasDe, FILTRO_VACIO, hayFiltro, type FiltroLeads } from "@/lib/admin/filtros-leads";
import { ESTADOS, type EstadoNegocio, type Negocio } from "@/lib/admin/negocios";
import type { Territorio } from "@/lib/admin/territorios";
import { cn } from "@/lib/cn";
import { Button } from "@/components/admin/ui/Button";
import { Field, Select } from "@/components/admin/ui/Field";
import { IconButton } from "@/components/admin/ui/IconButton";
import { Toggle } from "@/components/admin/ui/Toggle";
import { COLOR_PIN } from "./pines";

type Props = {
  filtro: FiltroLeads;
  onCambiar: (filtro: FiltroLeads) => void;
  /** La lista completa: de aquí salen las categorías del select. */
  negocios: readonly Negocio[];
  territorios: readonly Territorio[];
  /** Cuántos pines quedan tras filtrar. */
  visibles: number;
};

/**
 * El panel de filtros de cristal sobre el mapa (patrón del mapa de LUCI).
 * Plegado es un botón; abierto, chips de estado, «solo sin web», categoría y
 * territorio. Recorta con la MISMA `filtrarLeads` que la lista de Leads.
 * La fila «Mostrando N de M» tiene altura fija para que abrir y cerrar no
 * mueva nada.
 */
export function FiltrosMapa({ filtro, onCambiar, negocios, territorios, visibles }: Props) {
  const [abierto, setAbierto] = useState(false);
  const categorias = useMemo(() => categoriasDe(negocios), [negocios]);
  const territoriosOrdenados = useMemo(
    () => [...territorios].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [territorios],
  );
  const activo = hayFiltro(filtro);

  function poner<K extends keyof FiltroLeads>(clave: K, valor: FiltroLeads[K]) {
    onCambiar({ ...filtro, [clave]: valor });
  }

  function alternarEstado(estado: EstadoNegocio) {
    poner(
      "estados",
      filtro.estados.includes(estado)
        ? filtro.estados.filter((e) => e !== estado)
        : [...filtro.estados, estado],
    );
  }

  return (
    <div
      className={cn(
        "absolute top-3 left-3 z-10 rounded-fila border border-hairline bg-isla/90 backdrop-blur-md",
        abierto && "w-72 max-w-[calc(100%-1.5rem)]",
      )}
    >
      <div className="flex h-9 items-center justify-between gap-2 pr-1 pl-3">
        <button
          type="button"
          aria-expanded={abierto}
          onClick={() => setAbierto((a) => !a)}
          className="flex h-9 items-center gap-2 text-xs font-medium text-tinta-85"
        >
          <SlidersHorizontal className="h-4 w-4 text-tinta-60" />
          Filtros
          {activo && (
            <span role="img" aria-label="hay filtros activos" className="h-1.5 w-1.5 rounded-full bg-acento" />
          )}
          {/* Altura fija: la cifra cambia, la fila no se mueve. */}
          <span className="text-tinta-40">
            · {visibles} de {negocios.length}
          </span>
        </button>
        {abierto && (
          <IconButton etiqueta="Cerrar filtros" className="h-7 w-7" onClick={() => setAbierto(false)}>
            <X className="h-3.5 w-3.5" />
          </IconButton>
        )}
      </div>

      {abierto && (
        <div className="flex flex-col gap-3 border-t border-hairline p-3">
          <div role="group" aria-label="Estado" className="flex flex-wrap gap-1">
            {ESTADOS.map((e) => {
              const marcado = filtro.estados.includes(e.valor);
              return (
                <button
                  key={e.valor}
                  type="button"
                  aria-pressed={marcado}
                  onClick={() => alternarEstado(e.valor)}
                  className={cn(
                    "flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
                    marcado
                      ? "border-acento bg-acento-10 text-tinta"
                      : "border-hairline text-tinta-60 hover:bg-isla-alta",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", COLOR_PIN[e.valor])} />
                  {e.label}
                </button>
              );
            })}
          </div>

          <Toggle
            activo={filtro.web === "sin"}
            onCambiar={(v) => poner("web", v ? "sin" : "todos")}
            etiqueta="Solo sin sitio web"
          />

          <Field label="Categoría">
            <Select value={filtro.categoria} onChange={(e) => poner("categoria", e.target.value)}>
              <option value="todas">Todas</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Territorio">
            <Select value={filtro.territorio} onChange={(e) => poner("territorio", e.target.value)}>
              <option value="todos">Todos</option>
              {territoriosOrdenados.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </Select>
          </Field>

          <Button className="self-start" disabled={!activo} onClick={() => onCambiar(FILTRO_VACIO)}>
            Limpiar filtros
          </Button>
        </div>
      )}
    </div>
  );
}
