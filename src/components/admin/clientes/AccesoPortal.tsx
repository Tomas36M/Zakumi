"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import {
  buscarPerfiles,
  vincularPerfilACliente,
  type PerfilBuscado,
} from "@/lib/admin/perfiles-actions";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Input } from "@/components/admin/ui/Field";
import { Island } from "@/components/admin/ui/Island";
import { ListRow } from "@/components/admin/ui/ListRow";

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
  const { confirmar, dialogo } = useConfirmar();

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
    <Island
      className="bg-isla-alta/50"
      titulo="Acceso al portal"
      aria-label="Acceso al portal"
    >
      {dialogo}
      <div className="flex flex-col gap-3">
        {vinculados.length === 0 ? (
          <p className="text-sm text-tinta-40">
            Ninguna cuenta del portal ve a este cliente todavía.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {vinculados.map((p) => (
              <li key={p.userId}>
                <ListRow
                  interactiva={false}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="min-w-0 truncate text-sm text-tinta">
                    {p.nombre ? `${p.nombre} · ` : ""}
                    {p.email ?? p.userId}
                  </span>
                  <Button
                    variante="peligro"
                    disabled={ocupado}
                    onClick={async () => {
                      const ok = await confirmar({
                        titulo: "¿Desvincular esta cuenta?",
                        mensaje:
                          "Dejará de ver los productos y el bot de este cliente en el portal.",
                        accion: "Desvincular",
                        peligro: true,
                      });
                      if (ok) vincular(p.userId, null);
                    }}
                  >
                    Desvincular
                  </Button>
                </ListRow>
              </li>
            ))}
          </ul>
        )}

        {sugerencia && (
          <Banner>
            <span className="flex flex-wrap items-center gap-2">
              <span>
                <strong>{sugerencia.email}</strong> se registró en el portal con el
                mismo correo de este cliente.
              </span>
              <Button
                disabled={ocupado}
                onClick={() => vincular(sugerencia.userId, clienteId)}
              >
                Vincular
              </Button>
            </span>
          </Banner>
        )}

        <div className="flex gap-2">
          <Input
            className="flex-1"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cuenta por correo…"
            onKeyDown={(e) => {
              if (e.key === "Enter") buscar();
            }}
          />
          <Button disabled={ocupado || q.trim().length < 3} onClick={buscar}>
            Buscar
          </Button>
        </div>

        {error && <Banner variante="error">{error}</Banner>}

        {resultados !== null &&
          (resultados.length === 0 ? (
            <p className="text-sm text-tinta-40">Sin cuentas con ese correo.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {resultados.map((p) => (
                <li key={p.userId}>
                  <ListRow
                    interactiva={false}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="min-w-0 truncate text-sm text-tinta">
                      {p.nombre ? `${p.nombre} · ` : ""}
                      {p.email ?? p.userId}
                      {p.clienteId && p.clienteId !== clienteId && (
                        <em className="text-tinta-40"> — ya vinculada a otro cliente</em>
                      )}
                      {p.clienteId === clienteId && (
                        <em className="text-tinta-40"> — ya vinculada</em>
                      )}
                    </span>
                    {p.clienteId !== clienteId && (
                      <Button
                        disabled={ocupado}
                        onClick={() => vincular(p.userId, clienteId)}
                      >
                        Vincular
                      </Button>
                    )}
                  </ListRow>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </Island>
  );
}
