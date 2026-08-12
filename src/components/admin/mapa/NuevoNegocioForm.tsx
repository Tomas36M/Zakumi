"use client";

import { useState, useTransition } from "react";
import { crearNegocioManual } from "@/lib/admin/actions";
import { CIUDADES, type Ciudad } from "@/lib/admin/negocios";

type Props = {
  lat: number;
  lng: number;
  ciudadSugerida: Exclude<Ciudad, "otra"> | null;
  onCreado: (id: string) => void;
  onCancelar: () => void;
};

export function NuevoNegocioForm(props: Props) {
  const [guardando, startGuardar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [ciudad, setCiudad] = useState<Ciudad>(props.ciudadSugerida ?? "otra");
  const [categoria, setCategoria] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");

  return (
    <form
      className="adm-ficha-contenido adm-nuevo-form"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startGuardar(async () => {
          const res = await crearNegocioManual({
            nombre,
            lat: props.lat,
            lng: props.lng,
            ciudad,
            categoria: categoria || undefined,
            telefono: telefono || undefined,
            direccion: direccion || undefined,
          });
          if ("error" in res) {
            setError(res.error);
            return;
          }
          props.onCreado(res.id);
        });
      }}
    >
      <div className="adm-ficha-cabecera">
        <div>
          <h2 className="adm-ficha-nombre">Negocio nuevo</h2>
          <p className="adm-ficha-meta">
            {props.lat.toFixed(5)}, {props.lng.toFixed(5)}
          </p>
        </div>
        <button
          type="button"
          className="adm-ficha-cerrar"
          aria-label="Cancelar"
          onClick={props.onCancelar}
        >
          ×
        </button>
      </div>

      <label className="adm-field">
        <span className="adm-field-label">Nombre *</span>
        <input
          className="adm-input"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          maxLength={300}
          autoFocus
        />
      </label>

      <label className="adm-field">
        <span className="adm-field-label">Ciudad</span>
        <select
          className="adm-select"
          value={ciudad}
          onChange={(e) => setCiudad(e.target.value as Ciudad)}
        >
          {CIUDADES.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.label}
            </option>
          ))}
          <option value="otra">Otra</option>
        </select>
      </label>

      <label className="adm-field">
        <span className="adm-field-label">Teléfono</span>
        <input
          className="adm-input"
          type="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="310 1234567"
        />
      </label>

      <label className="adm-field">
        <span className="adm-field-label">Oficio / categoría</span>
        <input
          className="adm-input"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          placeholder="ferretería, panadería…"
          maxLength={120}
        />
      </label>

      <label className="adm-field">
        <span className="adm-field-label">Dirección</span>
        <input
          className="adm-input"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          maxLength={300}
        />
      </label>

      {error ? (
        <p className="adm-error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="adm-cta" type="submit" disabled={guardando || !nombre.trim()}>
        {guardando ? "Guardando…" : "Guardar negocio"}
      </button>
    </form>
  );
}
