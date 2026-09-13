"use client";

import { useMemo } from "react";
import { categoriasDe, type FiltroLeads, type FiltroTelefono, type FiltroWeb } from "@/lib/admin/filtros-leads";
import { ciudadesDe, ESTADOS, type EstadoNegocio, type Negocio } from "@/lib/admin/negocios";
import type { Territorio } from "@/lib/admin/territorios";
import { Field, Input, Select } from "@/components/admin/ui/Field";
import { Island } from "@/components/admin/ui/Island";

type Props = {
  filtro: FiltroLeads;
  onCambiar: (filtro: FiltroLeads) => void;
  /** La lista completa: de aquí salen las ciudades y categorías del select. */
  negocios: readonly Negocio[];
  territorios: readonly Territorio[];
  /** Cuántos quedan tras filtrar. */
  visibles: number;
};

/** La isla de búsqueda de la lista de leads: texto + seis selects. */
export function FiltrosLeads({ filtro, onCambiar, negocios, territorios, visibles }: Props) {
  const categorias = useMemo(() => categoriasDe(negocios), [negocios]);
  const ciudades = useMemo(() => ciudadesDe(negocios), [negocios]);
  const territoriosOrdenados = useMemo(
    () => [...territorios].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [territorios],
  );

  function poner<K extends keyof FiltroLeads>(clave: K, valor: FiltroLeads[K]) {
    onCambiar({ ...filtro, [clave]: valor });
  }

  return (
    <Island role="search" className="p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Input
            type="search"
            className="h-12 min-w-64 flex-1 px-5 text-base"
            value={filtro.q}
            onChange={(e) => poner("q", e.target.value)}
            placeholder="Buscar negocio por nombre — El Tornillo…"
            aria-label="Buscar por nombre"
          />
          <p className="whitespace-nowrap">
            <span className="font-editorial text-3xl italic text-tinta">{visibles}</span>
            <span className="text-sm text-tinta-40"> de {negocios.length} negocios</span>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-3">
          <Field label="Ciudad">
            <Select value={filtro.ciudad} onChange={(e) => poner("ciudad", e.target.value)}>
              <option value="todas">Todas</option>
              {ciudades.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estado">
            <Select
              value={filtro.estados[0] ?? "todos"}
              onChange={(e) =>
                poner(
                  "estados",
                  e.target.value === "todos" ? [] : [e.target.value as EstadoNegocio],
                )
              }
            >
              <option value="todos">Todos</option>
              {ESTADOS.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.label}
                </option>
              ))}
            </Select>
          </Field>
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
          <Field label="Teléfono">
            <Select
              value={filtro.telefono}
              onChange={(e) => poner("telefono", e.target.value as FiltroTelefono)}
            >
              <option value="todos">Todos</option>
              <option value="con">Con teléfono</option>
              <option value="sin">Sin teléfono</option>
            </Select>
          </Field>
          <Field label="Sitio web">
            <Select value={filtro.web} onChange={(e) => poner("web", e.target.value as FiltroWeb)}>
              <option value="todos">Todos</option>
              <option value="sin">Sin web</option>
              <option value="con">Con web</option>
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
        </div>
      </div>
    </Island>
  );
}
