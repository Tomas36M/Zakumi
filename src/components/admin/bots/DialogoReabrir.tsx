"use client";

import { useState, useTransition } from "react";
import type { VerticalProspeccion } from "@/lib/admin/zak";
import { abrirChatZak } from "@/lib/admin/zak-actions";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Modal } from "@/components/admin/ui/Modal";
import { SelectorPlantilla } from "./SelectorPlantilla";

type Props = {
  /** Teléfono en formato del bot (el mismo de la conversación). */
  telefono: string;
  /** Plantilla preseleccionada: la vertical del negocio, si el CRM la sabe. */
  slugInicial: string;
  /** El negocio del chat: con él, reabrir avanza el CRM a «contactado». */
  negocioId?: string | null;
  /** El catálogo vivo de verticales (props desde el server). */
  verticales?: readonly VerticalProspeccion[];
  onCerrar: () => void;
  /** Recargar el historial del chat: la plantilla ya salió. */
  onReabierto: () => void | Promise<void>;
};

/**
 * Reabrir un chat cuya ventana de 24 h de Meta ya venció: elegir la plantilla
 * de saludo, ver qué va a salir y mandarla. Vive en un modal a propósito — el
 * selector con su vista previa se comía el compositor del chat.
 *
 * El error se queda ACÁ dentro: el banner del chat quedaría detrás del velo,
 * o sea invisible justo cuando hay que elegir otra plantilla.
 */
export function DialogoReabrir({
  telefono,
  slugInicial,
  negocioId,
  verticales,
  onCerrar,
  onReabierto,
}: Props) {
  const [slug, setSlug] = useState(slugInicial);
  const [error, setError] = useState<string | null>(null);
  const [enviando, startEnviar] = useTransition();

  function reabrir() {
    setError(null);
    startEnviar(async () => {
      const res = await abrirChatZak(telefono, slug, negocioId ?? undefined);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      // El historial primero, el cierre después: si se cierra antes, el chat
      // se queda un instante mostrando el compositor muerto de una ventana
      // que ya está abierta.
      await onReabierto();
      onCerrar();
    });
  }

  return (
    <Modal
      abierto
      onCerrar={(abierto) => {
        if (!abierto && !enviando) onCerrar();
      }}
      titulo="Reabrir el chat con una plantilla"
      descripcion="Pasaron más de 24 horas desde el último mensaje de esta persona: Meta descarta el texto libre, así que Zak reabre saludando con una plantilla aprobada."
    >
      <div className="flex flex-col gap-4">
        <SelectorPlantilla
          valor={slug}
          onCambiar={setSlug}
          disabled={enviando}
          opciones={verticales}
        />
        {error && <Banner variante="error">{error}</Banner>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button disabled={enviando} onClick={onCerrar}>
            Cancelar
          </Button>
          <Button variante="primaria" disabled={enviando} onClick={reabrir}>
            {enviando ? "Enviando…" : "Reabrir con plantilla"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
