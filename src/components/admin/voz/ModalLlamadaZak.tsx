"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { estadoLlamadaZak } from "@/lib/admin/voz-actions";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { ChatBubble } from "@/components/admin/ui/ChatBubble";
import { Modal } from "@/components/admin/ui/Modal";
import { DetalleLlamada } from "./LlamadasVoz";
import { useLlamadaEnVivo } from "./useLlamadaEnVivo";

/** Qué está pasando, en una línea. El sujeto es el prospecto, no quien mira:
 *  en el Lab de voz el agente te llama a TI y el copy es el otro. */
const COPY_FASE: Record<string, string> = {
  buscando: "Marcando…",
  sonando: "Sonando en su teléfono…",
  hablando: "En llamada — Zak está hablando 📞",
  procesando: "Colgaron. Procesando la llamada…",
  fallida: "No se pudo iniciar la llamada. Esperando el detalle del proveedor…",
};

/**
 * Mirar una llamada de Zak mientras pasa: la fase, la transcripción que va
 * cayendo y, al colgar, el detalle completo (resumen, datos extraídos, audio).
 *
 * Cerrar NO cuelga: no hay endpoint de colgar, así que cerrar es dejar de
 * mirar. La llamada sigue y su resultado aterriza igual por el webhook — y se
 * dice en pantalla, porque un botón «Cerrar» que parece un «Colgar» es peor
 * que no tener botón.
 */
export function ModalLlamadaZak({
  conversationId,
  nombre,
  telefono,
  onCerrar,
}: {
  /** null = la llamada salió pero el proveedor no devolvió id narrable. */
  conversationId: string | null;
  nombre?: string | null;
  /** E.164, como lo manda el cockpit. */
  telefono: string;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const { fase, turnos, activo, agotado } = useLlamadaEnVivo({
    conversationId,
    consultar: estadoLlamadaZak,
    // La llamada aterrizada mueve contadores, estado del CRM y la lista de
    // llamadas: cuando la fila existe, la página se pone al día.
    onAterrizada: () => router.refresh(),
  });

  const aQuien = nombre?.trim() ? nombre : telefono;
  const aterrizada = fase?.fase === "aterrizada" ? fase.llamada : null;
  const visibles = turnos.filter((t) => t.message);

  // Autoscroll de la transcripción, con el mismo criterio que el chat: solo
  // si ya estabas abajo. Si subiste a leer, un turno nuevo no te mueve.
  const caja = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const c = caja.current;
    if (!c) return;
    if (c.scrollHeight - c.scrollTop - c.clientHeight < 64) {
      c.scrollTop = c.scrollHeight;
    }
  }, [visibles.length]);

  return (
    <Modal
      abierto
      onCerrar={(abierto) => {
        if (!abierto) onCerrar();
      }}
      titulo="Llamada de Zak"
      descripcion={`${aQuien} · ${telefono}`}
      tamano="ancho"
    >
      <div className="flex flex-col gap-3">
        {conversationId === null ? (
          <Banner>
            La llamada salió, pero el proveedor no devolvió el identificador para
            narrarla en vivo. El resultado aterriza igual al colgar, en Llamadas de
            /admin/voz.
          </Banner>
        ) : (
          <>
            {fase && fase.fase in COPY_FASE && (
              <Banner variante={fase.fase === "fallida" ? "error" : "aviso"}>
                {COPY_FASE[fase.fase]}
              </Banner>
            )}
            {fase?.fase === "error" && <Banner variante="error">{fase.error}</Banner>}
            {agotado && (
              <Banner>
                Dejé de seguir la llamada tras seis minutos. Si duró más, su detalle
                completo está en Llamadas de /admin/voz.
              </Banner>
            )}

            {/* Una llamada puede aterrizar sin resumen ni datos (nadie
                contestó, contestadora, cortaron al segundo): sin esta línea el
                modal se quedaría con un bloque vacío y sin decir que terminó. */}
            {aterrizada && (
              <Banner>
                Llamada terminada
                {aterrizada.duracion_seg !== null ? ` · ${aterrizada.duracion_seg} s` : ""}.
                Esto es lo que quedó registrado.
              </Banner>
            )}

            {/* Mientras no aterriza, la transcripción en vivo; al aterrizar, el
                detalle completo ya la trae (y con audio y datos), así que no se
                pintan las dos. */}
            {aterrizada ? (
              <DetalleLlamada agenteId={aterrizada.agente_id} llamada={aterrizada} />
            ) : (
              <>
                <div
                  ref={caja}
                  className="barra-fina flex max-h-[45vh] min-h-32 flex-col gap-3 overflow-y-auto rounded-fila border border-hairline bg-isla p-3"
                >
                  {visibles.length === 0 ? (
                    <p className="m-auto max-w-xs text-center text-sm text-tinta-40">
                      Todavía no hay nada transcrito.
                    </p>
                  ) : (
                    visibles.map((t, i) => (
                      <ChatBubble
                        key={i}
                        lado={t.role === "agent" ? "agente" : "cliente"}
                        autor={t.role === "agent" ? "Zak" : aQuien}
                      >
                        {t.message}
                      </ChatBubble>
                    ))
                  )}
                </div>
                <p className="text-xs text-tinta-40">
                  La transcripción llega por turnos cerrados y con unos segundos de
                  retraso: es lo que el proveedor ya transcribió, no palabra por
                  palabra.
                </p>
              </>
            )}
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3">
          <p className="text-xs text-tinta-40">
            {activo
              ? "Cerrar no cuelga la llamada: solo dejas de mirarla."
              : "El detalle completo queda en Llamadas de /admin/voz."}
          </p>
          <Button onClick={onCerrar}>Cerrar</Button>
        </div>
      </div>
    </Modal>
  );
}
