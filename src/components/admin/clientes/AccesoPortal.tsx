"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  buscarPerfiles,
  vincularPerfilACliente,
  type PerfilBuscado,
} from "@/lib/admin/perfiles-actions";

type Props = {
  clienteId: string;
  /** Cuentas del portal ya vinculadas a este cliente. */
  vinculados: PerfilBuscado[];
  /** Cuenta cuyo email coincide con el del cliente y aún no está vinculada. */
  sugerencia: PerfilBuscado | null;
};

/**
 * "Acceso al portal" de la ficha 360: qué cuenta de /app ve a este cliente.
 * La vinculación es manual a propósito — el email de la cartera lo tipeó
 * Tomás y no es prueba de identidad; vincular expone productos, pagos y bot.
 */
export function AccesoPortal({ clienteId, vinculados, sugerencia }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<PerfilBuscado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, startTransition] = useTransition();

  function vincular(userId: string, destino: string | null) {
    setError(null);
    startTransition(async () => {
      const r = await vincularPerfilACliente(userId, destino);
      if (r.error) {
        setError(r.error);
        return;
      }
      setResultados(null);
      setQ("");
      router.refresh();
    });
  }

  function buscar() {
    setError(null);
    startTransition(async () => {
      const r = await buscarPerfiles(q);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setResultados(r.perfiles);
    });
  }

  return (
    <section className="adm-notas" aria-label="Acceso al portal">
      <h2 className="adm-field-label">Acceso al portal</h2>

      {vinculados.length === 0 ? (
        <p className="adm-ficha-sin">
          Ninguna cuenta del portal ve a este cliente todavía.
        </p>
      ) : (
        <ul className="adm-notas-lista">
          {vinculados.map((p) => (
            <li key={p.userId} className="adm-nota">
              <span className="adm-nota-texto">
                {p.nombre ? `${p.nombre} · ` : ""}
                {p.email ?? p.userId}
              </span>
              <button
                type="button"
                className="adm-cta-ghost adm-cta--peligro"
                disabled={ocupado}
                onClick={() => {
                  if (
                    window.confirm(
                      "¿Desvincular esta cuenta? Dejará de ver los productos y el bot de este cliente en el portal.",
                    )
                  ) {
                    vincular(p.userId, null);
                  }
                }}
              >
                Desvincular
              </button>
            </li>
          ))}
        </ul>
      )}

      {sugerencia && (
        <p className="adm-aviso">
          <strong>{sugerencia.email}</strong> se registró en el portal con el
          mismo correo de este cliente.{" "}
          <button
            type="button"
            className="adm-cta-ghost"
            disabled={ocupado}
            onClick={() => vincular(sugerencia.userId, clienteId)}
          >
            Vincular
          </button>
        </p>
      )}

      <div className="adm-sol-rechazo">
        <input
          className="adm-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar cuenta por correo…"
          onKeyDown={(e) => {
            if (e.key === "Enter") buscar();
          }}
        />
        <button
          type="button"
          className="adm-cta-ghost"
          disabled={ocupado || q.trim().length < 3}
          onClick={buscar}
        >
          Buscar
        </button>
      </div>

      {error && (
        <p className="adm-error" role="alert">
          {error}
        </p>
      )}

      {resultados !== null &&
        (resultados.length === 0 ? (
          <p className="adm-ficha-sin">Sin cuentas con ese correo.</p>
        ) : (
          <ul className="adm-notas-lista">
            {resultados.map((p) => (
              <li key={p.userId} className="adm-nota">
                <span className="adm-nota-texto">
                  {p.nombre ? `${p.nombre} · ` : ""}
                  {p.email ?? p.userId}
                  {p.clienteId && p.clienteId !== clienteId && (
                    <em> — ya vinculada a otro cliente</em>
                  )}
                  {p.clienteId === clienteId && <em> — ya vinculada</em>}
                </span>
                {p.clienteId !== clienteId && (
                  <button
                    type="button"
                    className="adm-cta-ghost"
                    disabled={ocupado}
                    onClick={() => vincular(p.userId, clienteId)}
                  >
                    Vincular
                  </button>
                )}
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
