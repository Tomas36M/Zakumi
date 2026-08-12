"use client";

import { useState } from "react";
import type { ResultadoPlace } from "@/lib/admin/places";

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
    <div className="adm-busqueda">
      <form
        className="adm-busqueda-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim().length >= 2) props.onBuscar(query.trim());
        }}
      >
        <label className="adm-field">
          <span className="adm-field-label">Buscar negocios</span>
          <input
            className="adm-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="restaurantes en Madrid Cundinamarca"
            minLength={2}
            maxLength={120}
          />
        </label>
        <button
          className="adm-cta"
          type="submit"
          disabled={props.buscando || query.trim().length < 2}
        >
          {props.buscando ? "Buscando…" : "Buscar"}
        </button>
      </form>

      {props.error ? (
        <p className="adm-error" role="alert">
          {props.error}
        </p>
      ) : null}

      {props.resultados.length > 0 ? (
        <>
          <div className="adm-busqueda-lote">
            <span className="adm-busqueda-conteo">
              <strong>{props.resultados.length}</strong> resultados ·{" "}
              <strong>{importables.length}</strong> con teléfono sin importar
            </span>
            <button
              className="adm-cta-ghost"
              type="button"
              disabled={props.importando || importables.length === 0}
              onClick={() => props.onImportar(importables)}
            >
              {props.importando
                ? "Importando…"
                : `Importar ${importables.length} con teléfono`}
            </button>
          </div>

          <ul className="adm-resultados">
            {props.resultados.map((r) => (
              <li
                key={r.placeId}
                className={
                  props.seleccionPlaceId === r.placeId
                    ? "adm-resultado adm-resultado--activo"
                    : "adm-resultado"
                }
              >
                <button
                  type="button"
                  className="adm-resultado-info"
                  onClick={() => props.onSeleccionar(r.placeId)}
                >
                  <span className="adm-resultado-nombre">{r.nombre}</span>
                  <span className="adm-resultado-meta">
                    {r.telefono ?? "Sin teléfono"}
                    {r.rating !== null ? ` · ${r.rating.toFixed(1)}★` : ""}
                    {r.categoria ? ` · ${r.categoria.replaceAll("_", " ")}` : ""}
                    {!r.operativo ? " · CERRADO" : ""}
                  </span>
                </button>
                {r.yaImportado ? (
                  <span className="adm-resultado-ya">Ya está</span>
                ) : (
                  <button
                    type="button"
                    className="adm-cta-ghost adm-resultado-importar"
                    disabled={props.importando}
                    onClick={() => props.onImportar([r])}
                  >
                    Importar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="adm-busqueda-vacia">
          Busca por oficio y ciudad — «ferreterías en Ubaté», «panaderías en
          Madrid Cundinamarca» — e importa los que tengan teléfono.
        </p>
      )}
    </div>
  );
}
