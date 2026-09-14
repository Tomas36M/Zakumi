"use client";

import type { Negocio } from "@/lib/admin/negocios";
import type { EstadoVozZak } from "@/lib/admin/voz-estado";
import { Banner } from "@/components/admin/ui/Banner";
import { Modal } from "@/components/admin/ui/Modal";
import { Skeleton } from "@/components/admin/ui/Skeleton";
import { FichaLeadAcciones } from "./FichaLeadAcciones";
import { FichaLeadDatos } from "./FichaLeadDatos";
import { FichaLeadNotas } from "./FichaLeadNotas";

type Props = {
  /** El id abierto (de la URL). `null` = modal cerrado. */
  leadId: string | null;
  /** El negocio resuelto por el dueño en cada render (id → fila viva). */
  negocio: Negocio | null;
  /** true mientras el dueño todavía está resolviendo `negocio` (ej. un
   *  fetch por id, en vez de buscarlo en una lista ya cargada). Pinta un
   *  esqueleto en vez del banner de "no encontrado". */
  cargando?: boolean;
  vozZak: EstadoVozZak;
  onCerrar: () => void;
  /** router.refresh() del dueño: los datos frescos llegan por props. */
  onCambio: () => void;
  onEliminado: () => void;
};

/**
 * LA ficha de un lead, la misma desde el mapa, la lista de Leads y la página
 * de un territorio: datos editables, notas, y lo que se puede hacer con él
 * (chat, llamar con Zak, convertir, eliminar).
 *
 * El dueño guarda solo el id y resuelve el negocio en cada render: tras un
 * `router.refresh()` el modal ve la fila nueva sin remontar. El contenido
 * lleva `key={negocio.id}` para que cambiar de lead resetee los formularios.
 */
export function FichaLeadModal({
  leadId,
  negocio,
  cargando = false,
  vozZak,
  onCerrar,
  onCambio,
  onEliminado,
}: Props) {
  const subtitulo = negocio
    ? [
        negocio.categoria?.replaceAll("_", " "),
        negocio.ciudad,
        negocio.rating !== null ? `${negocio.rating.toFixed(1)}★` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <Modal
      abierto={leadId !== null}
      onCerrar={(abierto) => {
        if (!abierto) onCerrar();
      }}
      titulo={negocio?.nombre ?? "Negocio"}
      descripcion={subtitulo || undefined}
      tamano="ancho"
    >
      {cargando && negocio?.id !== leadId ? (
        <div className="grid gap-5 min-[720px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      ) : negocio ? (
        <div
          key={negocio.id}
          className="grid gap-5 min-[720px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
        >
          <FichaLeadDatos negocio={negocio} onCambio={onCambio} />
          <div className="flex min-w-0 flex-col gap-4">
            <FichaLeadAcciones
              negocio={negocio}
              vozZak={vozZak}
              onCerrar={onCerrar}
              onEliminado={onEliminado}
            />
            <FichaLeadNotas negocioId={negocio.id} version={negocio.updated_at} />
          </div>
        </div>
      ) : (
        // La lista de esta pantalla viene topada (TOPE_LEADS): un enlace a un
        // negocio antiguo puede caer fuera de lo cargado. (Zak no cae acá:
        // resuelve por fetch, no por lista — ver `cargando` arriba.)
        <Banner variante="error">
          Este negocio no está en la lista cargada en pantalla. Búscalo en su
          territorio o ajusta los filtros.
        </Banner>
      )}
    </Modal>
  );
}
