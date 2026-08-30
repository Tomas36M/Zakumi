"use client";

import { useState } from "react";
import { fechaCorta } from "@/lib/admin/formato";
import {
  LABEL_DIRECCION,
  LABEL_RESULTADO,
  type Direccion,
  type LlamadaVoz,
} from "@/lib/voz/tipos";
import { Badge, type TonoBadge } from "@/components/admin/ui/Badge";
import { ChatBubble } from "@/components/admin/ui/ChatBubble";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { ListRow } from "@/components/admin/ui/ListRow";

const TONO_DIRECCION: Record<Direccion, TonoBadge> = {
  prueba: "contactado",
  saliente: "respondido",
  entrante: "interesado",
  widget: "neutro",
};

function duracion(seg: number | null): string {
  if (seg === null) return "—";
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** Detalle de una llamada aterrizada. Lo reusa el Lab para mostrar el resultado. */
export function DetalleLlamada({
  agenteId,
  llamada,
}: {
  agenteId: string;
  llamada: LlamadaVoz;
}) {
  const datos = Object.entries(llamada.datos ?? {}).filter(([, v]) => v !== null);
  return (
    <div className="flex flex-col gap-3 rounded-fila bg-isla-alta/40 p-4">
      {llamada.resumen && (
        <p className="text-sm leading-relaxed text-tinta-85">{llamada.resumen}</p>
      )}

      {datos.length > 0 && (
        <dl className="grid gap-2 sm:grid-cols-2">
          {datos.map(([clave, valor]) => (
            <div key={clave} className="rounded-fila bg-isla px-3 py-2">
              <dt className="text-xs text-tinta-40">{clave}</dt>
              <dd className="text-sm text-tinta">{String(valor)}</dd>
            </div>
          ))}
        </dl>
      )}

      {llamada.tiene_audio && (
        // El audio pasa por el proxy admin: la key de ElevenLabs no baja nunca.
        <audio
          className="w-full"
          controls
          preload="none"
          src={`/admin/api/voz/${agenteId}/audio/${llamada.conversation_id}`}
        />
      )}

      {llamada.transcript && llamada.transcript.length > 0 && (
        <div className="flex flex-col gap-2 rounded-fila bg-isla p-3">
          {llamada.transcript.map((turno, i) =>
            turno.message ? (
              <ChatBubble
                key={i}
                lado={turno.role === "agent" ? "agente" : "cliente"}
                autor={turno.role === "agent" ? "Agente" : "Persona"}
              >
                {turno.message}
              </ChatBubble>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

export function LlamadasVoz({
  agenteId,
  llamadas,
}: {
  agenteId: string;
  llamadas: LlamadaVoz[];
}) {
  const [abierta, setAbierta] = useState<string | null>(null);

  if (llamadas.length === 0) {
    return (
      <EmptyState
        titulo="Todavía no hay llamadas."
        detalle="Cada conversación (teléfono o widget) aterriza aquí sola vía el webhook post-call, con transcript, datos y audio."
      />
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {llamadas.map((ll) => (
        <div key={ll.id} className="flex flex-col gap-1">
          <ListRow
            activa={abierta === ll.id}
            onClick={() => setAbierta((v) => (v === ll.id ? null : ll.id))}
            className="flex flex-wrap items-center gap-3"
          >
            <Badge tono={TONO_DIRECCION[ll.direccion]}>
              {LABEL_DIRECCION[ll.direccion]}
            </Badge>
            <span className="min-w-0 flex-1 truncate text-sm text-tinta">
              {ll.telefono ?? "Web"}
            </span>
            <span className="text-xs text-tinta-40">
              {fechaCorta(ll.iniciada_en ?? ll.created_at) || "—"} · {duracion(ll.duracion_seg)}
            </span>
            {ll.estado === "fallo_inicio" ? (
              <Badge tono="peligro">No contestó</Badge>
            ) : (
              <span className="text-xs text-tinta-60">
                {ll.resultado ? LABEL_RESULTADO[ll.resultado] : "—"}
              </span>
            )}
          </ListRow>
          {abierta === ll.id && <DetalleLlamada agenteId={agenteId} llamada={ll} />}
        </div>
      ))}
    </div>
  );
}
