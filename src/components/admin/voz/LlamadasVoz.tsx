"use client";

import { useState } from "react";
import {
  LABEL_DIRECCION,
  LABEL_RESULTADO,
  type LlamadaVoz,
} from "@/lib/voz/tipos";

function fechaCorta(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  }).format(new Date(iso));
}

function duracion(seg: number | null): string {
  if (seg === null) return "—";
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function Detalle({ agenteId, llamada }: { agenteId: string; llamada: LlamadaVoz }) {
  const datos = Object.entries(llamada.datos ?? {}).filter(([, v]) => v !== null);
  return (
    <div className="adm-voz-detalle">
      {llamada.resumen && <p className="adm-voz-resumen">{llamada.resumen}</p>}

      {datos.length > 0 && (
        <dl className="adm-voz-datos">
          {datos.map(([clave, valor]) => (
            <div key={clave} className="adm-voz-dato">
              <dt>{clave}</dt>
              <dd>{String(valor)}</dd>
            </div>
          ))}
        </dl>
      )}

      {llamada.tiene_audio && (
        // El audio pasa por el proxy admin: la key de ElevenLabs no baja nunca.
        <audio
          className="adm-voz-audio"
          controls
          preload="none"
          src={`/admin/api/voz/${agenteId}/audio/${llamada.conversation_id}`}
        />
      )}

      {llamada.transcript && llamada.transcript.length > 0 && (
        <div className="adm-chat adm-voz-transcript">
          {llamada.transcript.map((turno, i) =>
            turno.message ? (
              <p
                key={i}
                className={
                  turno.role === "agent"
                    ? "adm-chat-burbuja adm-chat-burbuja--bot"
                    : "adm-chat-burbuja adm-chat-burbuja--persona"
                }
              >
                {turno.message}
              </p>
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
      <p className="adm-busqueda-vacia">
        Todavía no hay llamadas. Cada conversación (teléfono o widget) aterriza
        aquí sola vía el webhook post-call, con transcript, datos y audio.
      </p>
    );
  }

  return (
    <div className="adm-voz-llamadas">
      {llamadas.map((ll) => (
        <div key={ll.id} className="adm-voz-llamada">
          <button
            type="button"
            className="adm-voz-llamada-fila"
            onClick={() => setAbierta((v) => (v === ll.id ? null : ll.id))}
          >
            <span className="adm-badge">{LABEL_DIRECCION[ll.direccion]}</span>
            <span className="adm-voz-llamada-tel">{ll.telefono ?? "Web"}</span>
            <span className="adm-voz-llamada-meta">
              {fechaCorta(ll.iniciada_en ?? ll.created_at)} · {duracion(ll.duracion_seg)}
            </span>
            <span className="adm-voz-llamada-meta">
              {ll.estado === "fallo_inicio"
                ? "No contestó"
                : ll.resultado
                  ? LABEL_RESULTADO[ll.resultado]
                  : "—"}
            </span>
          </button>
          {abierta === ll.id && <Detalle agenteId={agenteId} llamada={ll} />}
        </div>
      ))}
    </div>
  );
}
