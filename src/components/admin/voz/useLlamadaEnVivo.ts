"use client";

import { useEffect, useRef, useState } from "react";
import type { FaseLlamadaLab } from "@/lib/admin/voz-actions";
import type { TurnoTranscript } from "@/lib/voz/transcript";

const POLL_MS = 4_000;
/** ~6 minutos. Más que cualquier llamada de prospección razonable; el tope
 *  existe para no pollear para siempre si el proveedor deja de contestar. */
const MAX_INTENTOS = 90;

export type LlamadaEnVivo = {
  /** null = no hay llamada que mirar. */
  fase: FaseLlamadaLab | null;
  /** Lo transcrito hasta ahora. Se CONSERVA entre fases: una fase sin turnos
   *  (fallida, o un tick raro) no borra lo que ya se leyó en pantalla. */
  turnos: TurnoTranscript[];
  /** true mientras se sigue preguntando por esta llamada. */
  activo: boolean;
  /** true = se dejó de preguntar por tope de tiempo, no porque terminara. */
  agotado: boolean;
};

/** Lo último que se sabe, ATADO a su conversación: así un id nuevo no arrastra
 *  la narración del anterior y el hook no tiene que resetear nada a mano. */
type Narracion = LlamadaEnVivo & { id: string; fase: FaseLlamadaLab };

const RECIEN_MARCADA: LlamadaEnVivo & { fase: FaseLlamadaLab } = {
  // Justo tras marcar, ElevenLabs todavía puede no registrar la conversación.
  fase: { fase: "buscando" },
  turnos: [],
  activo: true,
  agotado: false,
};

const SIN_LLAMADA: LlamadaEnVivo = {
  fase: null,
  turnos: [],
  activo: false,
  agotado: false,
};

/**
 * Narra una llamada en curso preguntando cada 4 s hasta que aterriza (la fila
 * del webhook post-call) o falla. El bucle es el mismo para el Lab de voz
 * (agente conocido) y para el cockpit de Zak (agente resuelto en el
 * servidor): a quién se le pregunta lo decide `consultar`.
 *
 * Nunca apila ticks (guarda de tick en vuelo) y un tick perdido por red no
 * rompe la narración: se reintenta en el siguiente.
 */
export function useLlamadaEnVivo({
  conversationId,
  consultar,
  onAterrizada,
}: {
  /** Cambiarlo arranca una narración nueva; null apaga el poll. */
  conversationId: string | null;
  consultar: (conversationId: string) => Promise<FaseLlamadaLab>;
  /** Se llama UNA vez, cuando la llamada aterriza (para refrescar la página). */
  onAterrizada?: () => void;
}): LlamadaEnVivo {
  const [narracion, setNarracion] = useState<Narracion | null>(null);

  // Los callbacks viven en refs: que el padre los recree en cada render no
  // puede reiniciar el intervalo (y con él la cuenta de intentos).
  const consultarRef = useRef(consultar);
  const aterrizadaRef = useRef(onAterrizada);
  useEffect(() => {
    consultarRef.current = consultar;
    aterrizadaRef.current = onAterrizada;
  });

  useEffect(() => {
    if (!conversationId) return;
    let vivo = true;
    let enVuelo = false;
    let intentos = 0;

    const timer = setInterval(() => {
      void (async () => {
        if (enVuelo) return; // el tick anterior sigue en vuelo: sin apilar ni desordenar
        enVuelo = true;
        intentos += 1;
        try {
          const f = await consultarRef.current(conversationId);
          if (!vivo) return;
          const terminal = f.fase === "aterrizada" || f.fase === "error";
          setNarracion((prev) => ({
            id: conversationId,
            fase: f,
            turnos:
              "turnos" in f && f.turnos.length > 0
                ? f.turnos
                : prev?.id === conversationId
                  ? prev.turnos
                  : [],
            activo: !terminal,
            agotado: false,
          }));
          if (terminal) {
            clearInterval(timer);
            if (f.fase === "aterrizada") aterrizadaRef.current?.();
          }
          return;
        } catch {
          // Transporte caído (red, deploy a mitad): tick perdido, se reintenta —
          // el tope de intentos de abajo evita pollear para siempre.
        } finally {
          enVuelo = false;
        }
        if (!vivo) return;
        if (intentos >= MAX_INTENTOS) {
          clearInterval(timer);
          setNarracion((prev) =>
            prev?.id === conversationId
              ? { ...prev, activo: false, agotado: true }
              : { ...RECIEN_MARCADA, id: conversationId, activo: false, agotado: true },
          );
        }
      })();
    }, POLL_MS);

    return () => {
      vivo = false;
      clearInterval(timer);
    };
  }, [conversationId]);

  // Derivado en render, no reseteado en un efecto: si no hay llamada, no hay
  // nada; si la que se está mirando no es la que el estado guarda (llamada
  // nueva, o el primer tick sin responder), arranca en "recién marcada".
  if (!conversationId) return SIN_LLAMADA;
  if (narracion?.id !== conversationId) return RECIEN_MARCADA;
  return narracion;
}
