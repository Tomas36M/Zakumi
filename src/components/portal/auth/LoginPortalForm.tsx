"use client";

import { useActionState } from "react";
import { loginPortal, type EstadoAuth } from "@/lib/portal/auth-actions";

const INICIAL: EstadoAuth = { error: null, aviso: null };

export function LoginPortalForm() {
  const [estado, accion, enviando] = useActionState(loginPortal, INICIAL);

  return (
    <form action={accion} className="app-auth-form">
      <div className="app-field">
        <label className="app-field-label" htmlFor="login-email">
          Correo
        </label>
        <input
          id="login-email"
          className="app-input"
          type="email"
          name="email"
          autoComplete="email"
          required
          autoFocus
        />
      </div>
      <div className="app-field">
        <label className="app-field-label" htmlFor="login-pass">
          Contraseña
        </label>
        <input
          id="login-pass"
          className="app-input"
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </div>
      {estado.error && (
        <p className="app-error" role="alert">
          {estado.error}
        </p>
      )}
      <button className="app-btn" type="submit" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
