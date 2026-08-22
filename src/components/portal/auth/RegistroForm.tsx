"use client";

import { useActionState } from "react";
import { registroPortal, type EstadoAuth } from "@/lib/portal/auth-actions";

const INICIAL: EstadoAuth = { error: null, aviso: null };

export function RegistroForm() {
  const [estado, accion, enviando] = useActionState(registroPortal, INICIAL);

  if (estado.aviso) {
    return (
      <p className="app-aviso" role="status">
        {estado.aviso}
      </p>
    );
  }

  return (
    <form action={accion} className="app-auth-form">
      <div className="app-field">
        <label className="app-field-label" htmlFor="reg-nombre">
          Tu nombre
        </label>
        <input
          id="reg-nombre"
          className="app-input"
          type="text"
          name="nombre"
          autoComplete="name"
          maxLength={200}
          placeholder="Cómo te llamas o tu negocio"
        />
      </div>
      <div className="app-field">
        <label className="app-field-label" htmlFor="reg-email">
          Correo
        </label>
        <input
          id="reg-email"
          className="app-input"
          type="email"
          name="email"
          autoComplete="email"
          required
        />
      </div>
      <div className="app-field">
        <label className="app-field-label" htmlFor="reg-pass">
          Contraseña
        </label>
        <input
          id="reg-pass"
          className="app-input"
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <span className="app-field-ayuda">Mínimo 8 caracteres.</span>
      </div>
      {estado.error && (
        <p className="app-error" role="alert">
          {estado.error}
        </p>
      )}
      <button className="app-btn" type="submit" disabled={enviando}>
        {enviando ? "Creando cuenta…" : "Crear cuenta"}
      </button>
    </form>
  );
}
