"use client";

import { Bot, Trash2 } from "lucide-react";
import { ESTADOS, type EstadoNegocio } from "@/lib/admin/negocios";
import { Button } from "@/components/admin/ui/Button";
import { Select } from "@/components/admin/ui/Field";

type Props = {
  cantidad: number;
  /** Cuántos de los seleccionados tienen celular con WhatsApp. */
  contactables: number;
  guardando: boolean;
  estadoLote: EstadoNegocio;
  onEstadoLote: (estado: EstadoNegocio) => void;
  onAplicar: () => void;
  onContactar: () => void;
  onEliminar: () => void;
};

/** La barra que aparece con filas seleccionadas: cambiar estado en lote,
 * mandarlos a Zak o borrarlos. */
export function AccionesLote({
  cantidad,
  contactables,
  guardando,
  estadoLote,
  onEstadoLote,
  onAplicar,
  onContactar,
  onEliminar,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-fila bg-isla-alta px-4 py-2.5">
      <span className="text-sm text-tinta">
        <strong>{cantidad}</strong> seleccionados
      </span>
      <label className="flex items-center gap-2 text-xs font-medium text-tinta-60">
        Pasar a
        <span className="w-40">
          <Select
            className="bg-isla"
            value={estadoLote}
            onChange={(e) => onEstadoLote(e.target.value as EstadoNegocio)}
          >
            {ESTADOS.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.label}
              </option>
            ))}
          </Select>
        </span>
      </label>
      <Button disabled={guardando} onClick={onAplicar}>
        {guardando ? "Aplicando…" : `Aplicar a ${cantidad}`}
      </Button>
      <Button
        variante="primaria"
        disabled={guardando || contactables === 0}
        title={contactables === 0 ? "Ninguno de los seleccionados tiene celular contactable" : undefined}
        onClick={onContactar}
      >
        <Bot className="h-4 w-4" /> Que Zak los contacte ({contactables})
      </Button>
      <Button variante="peligro" disabled={guardando} onClick={onEliminar}>
        <Trash2 className="h-4 w-4" /> Eliminar ({cantidad})
      </Button>
    </div>
  );
}
