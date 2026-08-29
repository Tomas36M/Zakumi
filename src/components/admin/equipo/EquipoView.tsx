"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import {
  buscarPerfiles,
  cambiarRolPerfil,
  type PerfilBuscado,
} from "@/lib/admin/perfiles-actions";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Input } from "@/components/admin/ui/Field";
import { Island } from "@/components/admin/ui/Island";
import { ListRow } from "@/components/admin/ui/ListRow";

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
  const { confirmar, dialogo } = useConfirmar();

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
    <div className="flex flex-col gap-aire">
      {dialogo}
      <Island className="bg-isla-alta/50" titulo="Admins actuales">
        {admins.length === 0 ? (
          <p className="text-sm text-tinta-40">
            No hay admins todavía — corre supabase/perfiles.sql (el seed) primero.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {admins.map((p) => (
              <li key={p.userId}>
                <ListRow
                  interactiva={false}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="min-w-0 truncate text-sm text-tinta">
                    {p.nombre ? `${p.nombre} · ` : ""}
                    {p.email ?? p.userId}
                    {p.userId === miUserId && <em className="text-tinta-40"> — tú</em>}
                  </span>
                  <Button
                    variante="peligro"
                    disabled={ocupado || p.userId === miUserId}
                    title={
                      p.userId === miUserId
                        ? "No puedes quitarte el rol a ti mismo"
                        : undefined
                    }
                    onClick={async () => {
                      const ok = await confirmar({
                        titulo: `¿Quitar el rol de admin a ${p.email ?? "esta cuenta"}?`,
                        mensaje: "Pasará a ser cliente del portal y dejará de ver el CRM.",
                        accion: "Quitar admin",
                        peligro: true,
                      });
                      if (ok) cambiar(p.userId, "cliente");
                    }}
                  >
                    Quitar admin
                  </Button>
                </ListRow>
              </li>
            ))}
          </ul>
        )}
      </Island>

      <Island className="bg-isla-alta/50" titulo="Promover una cuenta">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-tinta-40">
            La persona primero se registra en zakumistudio.com/app y luego la buscas
            aquí por su correo.
          </p>
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
                        {p.clienteId && (
                          <em className="text-tinta-40">
                            {" "}
                            — es cliente con servicios activos
                          </em>
                        )}
                      </span>
                      <Button
                        disabled={ocupado}
                        onClick={async () => {
                          const ok = await confirmar({
                            titulo: `¿Hacer admin a ${p.email ?? "esta cuenta"}?`,
                            mensaje:
                              "Verá todo el CRM, los clientes, los pagos y todos los bots.",
                            accion: "Hacer admin",
                          });
                          if (ok) cambiar(p.userId, "admin");
                        }}
                      >
                        Hacer admin
                      </Button>
                    </ListRow>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      </Island>
    </div>
  );
}
