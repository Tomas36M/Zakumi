"use client";

import { X } from "lucide-react";
import type { ResultadoPlace } from "@/lib/admin/places";
import { Button } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { IconButton } from "@/components/admin/ui/IconButton";
import { NuevoNegocioForm } from "@/components/admin/mapa/NuevoNegocioForm";
import type { Seleccion } from "./TerritorioView";

type Props = {
  seleccion: Seleccion;
  resultado: ResultadoPlace | null;
  importando: boolean;
  onImportar: (resultados: ResultadoPlace[]) => void;
  /** El alta manual terminó: el dueño abre la ficha del lead nuevo. */
  onCreado: (id: string) => void;
  onCerrar: () => void;
};

/**
 * La isla derecha: lo que todavía NO es un lead del CRM — un resultado suelto
 * de la búsqueda, o el alta manual de un pin nuevo. La ficha de un lead ya no
 * vive aquí: es el modal compartido del shell (FichaLeadModal).
 */
export function FichaLateral({
  seleccion,
  resultado,
  importando,
  onImportar,
  onCreado,
  onCerrar,
}: Props) {
  if (resultado) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-tinta">{resultado.nombre}</h2>
            <p className="text-xs text-tinta-40">Resultado sin importar</p>
          </div>
          <IconButton etiqueta="Cerrar" onClick={onCerrar}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        {resultado.direccion ? (
          <p className="text-sm text-tinta-60">{resultado.direccion}</p>
        ) : null}
        <p className="text-sm text-tinta">{resultado.telefono ?? "Sin teléfono"}</p>
        <Button
          variante="primaria"
          className="self-start"
          disabled={importando}
          onClick={() => onImportar([resultado])}
        >
          {importando ? "Importando…" : "Importar al CRM"}
        </Button>
      </div>
    );
  }

  if (seleccion?.tipo === "nuevo") {
    return (
      <NuevoNegocioForm
        lat={seleccion.lat}
        lng={seleccion.lng}
        onCreado={onCreado}
        onCancelar={onCerrar}
      />
    );
  }

  // Solo visible en móvil: en desktop la pista es la píldora flotante.
  return (
    <EmptyState titulo="Toca un pin del mapa o un resultado de la búsqueda para ver su ficha." />
  );
}
