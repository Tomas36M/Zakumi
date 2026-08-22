"use client";

import { useEffect, useState, useTransition } from "react";
import { actualizarNombre, cambiarPassword } from "@/lib/portal/actions";
import { IconoCerrar } from "./Iconos";

type Tab = "cuenta" | "seguridad";

type Props = {
  nombre: string | null;
  email: string | null;
  onCerrar: () => void;
};

/**
 * Modal de ajustes (patrón Scribe): sidebar interno de tabs-píldora +
 * contenido. V1: Cuenta (nombre) y Seguridad (contraseña). Escape cierra.
 */
export function AjustesModal({ nombre, email, onCerrar }: Props) {
  const [tab, setTab] = useState<Tab>("cuenta");

  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  return (
    <div
      className="app-modal-fondo"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="app-modal" role="dialog" aria-modal aria-label="Ajustes">
        <div className="app-modal-tabs">
          <button
            type="button"
            className={
              tab === "cuenta" ? "app-modal-tab app-modal-tab--activa" : "app-modal-tab"
            }
            onClick={() => setTab("cuenta")}
          >
            Cuenta
          </button>
          <button
            type="button"
            className={
              tab === "seguridad"
                ? "app-modal-tab app-modal-tab--activa"
                : "app-modal-tab"
            }
            onClick={() => setTab("seguridad")}
          >
            Seguridad
          </button>
          <button
            type="button"
            className="app-modal-tab app-modal-cerrar"
            onClick={onCerrar}
          >
            <IconoCerrar size={13} /> Cerrar
          </button>
        </div>
        <div className="app-modal-contenido">
          {tab === "cuenta" ? (
            <SeccionCuenta nombre={nombre} email={email} />
          ) : (
            <SeccionSeguridad />
          )}
        </div>
      </div>
    </div>
  );
}

function SeccionCuenta({ nombre, email }: { nombre: string | null; email: string | null }) {
  const [valor, setValor] = useState(nombre ?? "");
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, startTransition] = useTransition();

  function guardar() {
    setMensaje(null);
    startTransition(async () => {
      const r = await actualizarNombre(valor);
      setMensaje(
        r.error
          ? { ok: false, texto: r.error }
          : { ok: true, texto: "Nombre guardado." },
      );
    });
  }

  return (
    <div>
      <h2 className="app-modal-titulo">Cuenta</h2>
      <div className="app-field">
        <label className="app-field-label" htmlFor="ajustes-nombre">
          Tu nombre
        </label>
        <input
          id="ajustes-nombre"
          className="app-input"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          maxLength={200}
          placeholder="Cómo quieres que te saludemos"
        />
      </div>
      <div className="app-field">
        <span className="app-field-label">Correo</span>
        <input className="app-input" value={email ?? ""} disabled readOnly />
        <span className="app-field-ayuda">
          El correo de acceso no se cambia desde aquí — escríbenos si lo necesitas.
        </span>
      </div>
      {mensaje && (
        <p className={mensaje.ok ? "app-ok-texto" : "app-error"} role="status">
          {mensaje.texto}
        </p>
      )}
      <button
        type="button"
        className="app-btn"
        onClick={guardar}
        disabled={guardando || !valor.trim()}
      >
        {guardando ? "Guardando…" : "Guardar cambios"}
      </button>
    </div>
  );
}

function SeccionSeguridad() {
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, startTransition] = useTransition();

  function guardar() {
    setMensaje(null);
    startTransition(async () => {
      const r = await cambiarPassword({ password, confirmacion });
      if (r.error) {
        setMensaje({ ok: false, texto: r.error });
        return;
      }
      setPassword("");
      setConfirmacion("");
      setMensaje({ ok: true, texto: "Contraseña cambiada." });
    });
  }

  return (
    <div>
      <h2 className="app-modal-titulo">Seguridad</h2>
      <div className="app-field">
        <label className="app-field-label" htmlFor="ajustes-pass">
          Contraseña nueva
        </label>
        <input
          id="ajustes-pass"
          className="app-input"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 8 caracteres"
        />
      </div>
      <div className="app-field">
        <label className="app-field-label" htmlFor="ajustes-pass2">
          Repite la contraseña
        </label>
        <input
          id="ajustes-pass2"
          className="app-input"
          type="password"
          autoComplete="new-password"
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
        />
      </div>
      {mensaje && (
        <p className={mensaje.ok ? "app-ok-texto" : "app-error"} role="status">
          {mensaje.texto}
        </p>
      )}
      <button
        type="button"
        className="app-btn"
        onClick={guardar}
        disabled={guardando || password.length === 0}
      >
        {guardando ? "Cambiando…" : "Cambiar contraseña"}
      </button>
    </div>
  );
}
