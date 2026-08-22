"use client";

import { useState } from "react";
import type { ResultadoPlace } from "@/lib/admin/places";
import { Badge } from "@/components/admin/ui/Badge";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input } from "@/components/admin/ui/Field";
import { ListRow } from "@/components/admin/ui/ListRow";

type Props = {
  resultados: ResultadoPlace[];
  buscando: boolean;
  importando: boolean;
  error: string | null;
  seleccionPlaceId: string | null;
  onBuscar: (query: string) => void;
  onImportar: (resultados: ResultadoPlace[]) => void;
  onSeleccionar: (placeId: string) => void;
};

export function SearchPanel(props: Props) {
  const [query, setQuery] = useState("");

  const importables = props.resultados.filter(
    (r) => r.telefono !== null && !r.yaImportado,
  );

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim().length >= 2) props.onBuscar(query.trim());
        }}
      >
        <Field label="Buscar negocios">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="restaurantes en Madrid Cundinamarca"
            minLength={2}
            maxLength={120}
          />
        </Field>
        <Button
          variante="primaria"
          type="submit"
          className="self-start"
          disabled={props.buscando || query.trim().length < 2}
        >
          {props.buscando ? "Buscando…" : "Buscar"}
        </Button>
      </form>

      {props.error ? <Banner variante="error">{props.error}</Banner> : null}

      {props.resultados.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-tinta-60">
              <strong className="text-tinta-85">{props.resultados.length}</strong> con
              teléfono ·{" "}
              <strong className="text-tinta-85">{importables.length}</strong> sin
              importar
            </span>
            <Button
              disabled={props.importando || importables.length === 0}
              onClick={() => props.onImportar(importables)}
            >
              {props.importando
                ? "Importando…"
                : `Importar los ${importables.length} nuevos`}
            </Button>
          </div>

          <ul className="flex flex-col gap-1">
            {props.resultados.map((r) => (
              <li key={r.placeId}>
                <ListRow
                  activa={props.seleccionPlaceId === r.placeId}
                  className="flex items-center justify-between gap-2"
                  onClick={() => props.onSeleccionar(r.placeId)}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-tinta">
                      {r.nombre}
                    </span>
                    <span className="block truncate text-xs text-tinta-40">
                      {r.telefono ?? "Sin teléfono"}
                      {r.rating !== null ? ` · ${r.rating.toFixed(1)}★` : ""}
                      {r.categoria ? ` · ${r.categoria.replaceAll("_", " ")}` : ""}
                      {!r.operativo ? " · CERRADO" : ""}
                    </span>
                  </span>
                  {r.yaImportado ? (
                    <Badge tono="neutro">Ya está</Badge>
                  ) : (
                    <Button
                      disabled={props.importando}
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onImportar([r]);
                      }}
                    >
                      Importar
                    </Button>
                  )}
                </ListRow>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-tinta-60">
          Busca por oficio y ciudad — «ferreterías en Ubaté», «panaderías en
          Madrid Cundinamarca». Solo aparecen negocios <strong>con teléfono</strong>:
          sin número no hay a quién venderle.
        </p>
      )}
    </div>
  );
}
