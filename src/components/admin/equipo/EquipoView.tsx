"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  buscarPerfiles,
  cambiarRolPerfil,
  type PerfilBuscado,
} from "@/lib/admin/perfiles-actions";

type Props = {
  admins: PerfilBuscado[];
  /** Para bloquear la auto-degradación en la UI (la action también la bloquea). */
  miUserId: string;
};

export function EquipoView({ admins, miUserId }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<PerfilBuscado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, startTransition] = useTransition();

  function cambiar(userId: string, rol: "admin" | "cliente") {
    setError(null);
    startTransition(async () => {
      const r = await cambiarRolPerfil(userId, rol);
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
    <>
      <h2 className="adm-field-label">Admins actuales</h2>
      {admins.length === 0 ? (
        <p className="adm-ficha-sin">
          No hay admins todavía — corre supabase/perfiles.sql (el seed) primero.
        </p>
      ) : (
        <ul className="adm-notas-lista">
          {admins.map((p) => (
            <li key={p.userId} className="adm-nota">
              <span className="adm-nota-texto">
                {p.nombre ? `${p.nombre} · ` : ""}
                {p.email ?? p.userId}
                {p.userId === miUserId && <em> — tú</em>}
              </span>
              <button
                type="button"
                className="adm-cta-ghost adm-cta--peligro"
                disabled={ocupado || p.userId === miUserId}
                title={
                  p.userId === miUserId
                    ? "No puedes quitarte el rol a ti mismo"
                    : undefined
                }
                onClick={() => {
                  if (
                    window.confirm(
                      `¿Quitar el rol de admin a ${p.email ?? "esta cuenta"}? Pasará a ser cliente del portal y dejará de ver el CRM.`,
                    )
                  ) {
                    cambiar(p.userId, "cliente");
                  }
                }}
              >
                Quitar admin
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2 className="adm-field-label adm-sol-cerradas">Promover una cuenta</h2>
      <p className="adm-ficha-meta">
        La persona primero se registra en zakumistudio.com/app y luego la buscas
        aquí por su correo.
      </p>
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
                  {p.clienteId && <em> — es cliente con servicios activos</em>}
                </span>
                <button
                  type="button"
                  className="adm-cta-ghost"
                  disabled={ocupado}
                  onClick={() => {
                    if (
                      window.confirm(
                        `¿Hacer admin a ${p.email ?? "esta cuenta"}? Verá todo el CRM, los clientes, los pagos y todos los bots.`,
                      )
                    ) {
                      cambiar(p.userId, "admin");
                    }
                  }}
                >
                  Hacer admin
                </button>
              </li>
            ))}
          </ul>
        ))}
    </>
  );
}
