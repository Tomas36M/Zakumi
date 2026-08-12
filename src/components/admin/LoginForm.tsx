"use client";

import { useActionState } from "react";
import { login, type EstadoLogin } from "@/lib/admin/actions";

const INICIAL: EstadoLogin = { error: null };

export function LoginForm() {
  const [estado, accion, enviando] = useActionState(login, INICIAL);

  return (
    <form action={accion} className="adm-login-form">
      <label className="adm-field">
        <span className="adm-field-label">Correo</span>
        <input
          className="adm-input"
          type="email"
          name="email"
          autoComplete="email"
          required
          autoFocus
        />
      </label>
      <label className="adm-field">
        <span className="adm-field-label">Contraseña</span>
        <input
          className="adm-input"
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </label>
      {estado.error ? (
        <p className="adm-error" role="alert">
          {estado.error}
        </p>
      ) : null}
      <button className="adm-cta" type="submit" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
