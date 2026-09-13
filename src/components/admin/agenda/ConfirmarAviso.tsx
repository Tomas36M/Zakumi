"use client";

import { useState } from "react";
import { Button } from "@/components/admin/ui/Button";
import { Modal } from "@/components/admin/ui/Modal";
import { Toggle } from "@/components/admin/ui/Toggle";

type Props = {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  accion: string;
  peligro?: boolean;
  /** A quién se le avisaría; null = no hay a quién. */
  telefonoAviso: string | null;
  ocupado: boolean;
  onConfirmar: (avisar: boolean) => void;
  onCancelar: () => void;
};

/**
 * «¿Seguro? Se le avisará al lead». La confirmación de mover o cancelar una
 * reunión lleva el interruptor del aviso: encendido por defecto cuando hay
 * teléfono, apagado y explicado cuando no. Lo comparten la agenda y la
 * bandeja de solicitudes.
 */
export function ConfirmarAviso({
  abierto,
  titulo,
  mensaje,
  accion,
  peligro = false,
  telefonoAviso,
  ocupado,
  onConfirmar,
  onCancelar,
}: Props) {
  const [avisar, setAvisar] = useState(telefonoAviso !== null);

  return (
    <Modal
      abierto={abierto}
      onCerrar={(a) => {
        if (!a && !ocupado) onCancelar();
      }}
      titulo={titulo}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-tinta-60">{mensaje}</p>
        <div className="rounded-fila bg-isla-alta/50 p-3">
          <Toggle
            activo={avisar && telefonoAviso !== null}
            disabled={telefonoAviso === null || ocupado}
            onCambiar={setAvisar}
            etiqueta={
              telefonoAviso ? `Avisar por WhatsApp al ${telefonoAviso}` : "Avisar por WhatsApp"
            }
          />
          <p className="mt-1.5 text-xs text-tinta-40">
            {telefonoAviso
              ? "Zak le escribe con la fecha nueva (o la cancelación). Si la plantilla de Meta aún no está aprobada, solo llega dentro de las 24 h de su último mensaje."
              : "No hay teléfono de contacto: no se avisará a nadie."}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button autoFocus={peligro} onClick={onCancelar} disabled={ocupado}>
            Volver
          </Button>
          <Button
            variante={peligro ? "peligro" : "primaria"}
            autoFocus={!peligro}
            disabled={ocupado}
            onClick={() => onConfirmar(avisar && telefonoAviso !== null)}
          >
            {ocupado ? "Un momento…" : accion}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
