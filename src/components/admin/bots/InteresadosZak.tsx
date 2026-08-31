"use client";

import { fechaCorta } from "@/lib/admin/formato";
import type { Prospecto } from "@/lib/bots/tipos";
import { Button } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { ListRow } from "@/components/admin/ui/ListRow";
import { BotonLlamarZak, type EstadoVozZak } from "@/components/admin/voz/BotonLlamarZak";

type Props = {
  interesados: Prospecto[];
  vozZak: EstadoVozZak;
  sincronizando: boolean;
  onSincronizar: () => void;
  onAbrirChat: () => void;
};

/** Los negocios que Zak calentó y esperan que Tomás cierre. */
export function InteresadosZak({
  interesados,
  vozZak,
  sincronizando,
  onSincronizar,
  onAbrirChat,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-tinta-60">
          Negocios que Zak calentó y están listos para que tú cierres.
        </p>
        <Button disabled={sincronizando} onClick={onSincronizar}>
          {sincronizando ? "Sincronizando…" : "Sincronizar con el CRM"}
        </Button>
      </div>
      {interesados.length === 0 ? (
        <EmptyState
          titulo="Todavía nadie levanta la mano."
          detalle="Manda una tanda desde Negocios y deja que Zak caliente."
        />
      ) : (
        <ul className="flex flex-col">
          {interesados.map((p) => (
            <li key={p.id}>
              <ListRow interactiva={false} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <strong className="text-sm font-semibold text-tinta">
                    {p.contexto.nombre ?? p.telefono}
                  </strong>
                  <span className="text-xs text-tinta-40">
                    {" "}
                    · {p.telefono} · {fechaCorta(p.actualizado_en)}
                  </span>
                  <p className="text-xs text-tinta-60">
                    {p.interes_resumen ?? "interés sin detalle"}
                  </p>
                </div>
                <span className="flex shrink-0 flex-wrap items-center gap-2">
                  <BotonLlamarZak
                    vozZak={vozZak}
                    telefono={`+${p.telefono}`}
                    nombre={p.contexto.nombre ?? null}
                    negocioId={p.negocio_id}
                  />
                  <Button onClick={onAbrirChat}>Abrir chat</Button>
                </span>
              </ListRow>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
