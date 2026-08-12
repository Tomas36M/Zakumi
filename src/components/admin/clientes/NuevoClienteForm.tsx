"use client";

import { useState, useTransition } from "react";
import { crearCliente } from "@/lib/admin/cartera-actions";

type Props = {
  onCreado: (id: string) => void;
  onCancelar: () => void;
};

export function NuevoClienteForm({ onCreado, onCancelar }: Props) {
  const [guardando, startGuardar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");

  return (
    <form
      className="adm-ficha-contenido adm-nuevo-form"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startGuardar(async () => {
          const res = await crearCliente({
            nombre,
            telefono: telefono || undefined,
            email: email || undefined,
          });
          if ("error" in res) {
            setError(res.error);
            return;
          }
          onCreado(res.id);
        });
      }}
    >
      <div className="adm-ficha-cabecera">
        <div>
          <h2 className="adm-ficha-nombre">Cliente nuevo</h2>
          <p className="adm-ficha-meta">
            También puedes convertir un negocio del CRM desde su ficha.
          </p>
        </div>
        <button
          type="button"
          className="adm-ficha-cerrar"
          aria-label="Cancelar"
          onClick={onCancelar}
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
        <span className="adm-field-label">Correo</span>
        <input
          className="adm-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      {error ? (
        <p className="adm-error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="adm-cta" type="submit" disabled={guardando || !nombre.trim()}>
        {guardando ? "Guardando…" : "Crear cliente"}
      </button>
    </form>
  );
}
