"use client";

import { X } from "lucide-react";
import type { Negocio } from "@/lib/admin/negocios";
import type { ResultadoPlace } from "@/lib/admin/places";
import { Button } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { IconButton } from "@/components/admin/ui/IconButton";
import { FichaNegocio } from "@/components/admin/mapa/FichaNegocio";
import { NuevoNegocioForm } from "@/components/admin/mapa/NuevoNegocioForm";
import type { Seleccion } from "./TerritorioView";

type Props = {
  seleccion: Seleccion;
  negocio: Negocio | null;
  resultado: ResultadoPlace | null;
  importando: boolean;
  onImportar: (resultados: ResultadoPlace[]) => void;
  onSeleccionar: (seleccion: Seleccion) => void;
  onCerrar: () => void;
  onCambio: () => void;
};

/**
 * La isla derecha: la ficha de lo que esté seleccionado — un lead del CRM, un
 * resultado suelto de la búsqueda, o el alta manual de un pin nuevo.
 */
export function FichaLateral({
  seleccion,
  negocio,
  resultado,
  importando,
  onImportar,
  onSeleccionar,
  onCerrar,
  onCambio,
}: Props) {
  if (negocio) {
    return (
      <FichaNegocio
        key={negocio.id}
        negocio={negocio}
        onCambio={onCambio}
        onCerrar={onCerrar}
      />
    );
  }

  if (seleccion?.tipo === "negocio") {
    return <EmptyState titulo="Actualizando…" />;
  }

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
        onCreado={(id) => {
          onSeleccionar({ tipo: "negocio", id });
          onCambio();
        }}
        onCancelar={onCerrar}
      />
    );
  }

  // Solo visible en móvil: en desktop la pista es la píldora flotante.
  return (
    <EmptyState titulo="Toca un pin del mapa o un resultado de la búsqueda para ver su ficha." />
  );
}
