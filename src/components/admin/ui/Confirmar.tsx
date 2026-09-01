"use client";

import { useCallback, useState } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

type Opciones = {
  titulo: string;
  mensaje?: React.ReactNode;
  /** Label del botón que confirma (default "Confirmar"). */
  accion?: string;
  /** true = el botón que confirma va en rojo. */
  peligro?: boolean;
};

type Pendiente = Opciones & { resolver: (ok: boolean) => void };

/**
 * Reemplazo de window.confirm SIN bloquear el hilo: confirm() nativo congela
 * la pintura mientras el diálogo está abierto y revienta el INP (medido:
 * 6.6s en el Borrar de la bandeja). Uso:
 *
 *   const { confirmar, dialogo } = useConfirmar();
 *   ...
 *   if (!(await confirmar({ titulo: "¿Borrar?", peligro: true }))) return;
 *   ...
 *   return <>{dialogo}…</>   // una vez, en el árbol del componente
 */
export function useConfirmar() {
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);

  const confirmar = useCallback(
    (opciones: Opciones) =>
      new Promise<boolean>((resolver) => setPendiente({ ...opciones, resolver })),
    [],
  );

  function cerrar(ok: boolean) {
    pendiente?.resolver(ok);
    setPendiente(null);
  }

  const dialogo = pendiente ? (
    <Modal
      abierto
      onCerrar={(abierto) => {
        if (!abierto) cerrar(false);
      }}
      titulo={pendiente.titulo}
    >
      {pendiente.mensaje != null && (
        <p className="mb-4 text-sm leading-relaxed whitespace-pre-line text-tinta-60">
          {pendiente.mensaje}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {/* Con `peligro`, el foco arranca en Cancelar. El diálogo se abre por
            teclado tan a menudo como por ratón, y un Enter de más confirmaba
            de inmediato "Cerrar y perderlas" o "Eliminar" sin que nadie
            llegara a leer el mensaje — un barrido cortado a medias, o unos
            leads borrados. Lo inocuo sigue enfocando el botón que confirma:
            ahí el Enter es la comodidad que se busca. */}
        <Button autoFocus={pendiente.peligro} onClick={() => cerrar(false)}>
          Cancelar
        </Button>
        <Button
          variante={pendiente.peligro ? "peligro" : "primaria"}
          autoFocus={!pendiente.peligro}
          onClick={() => cerrar(true)}
        >
          {pendiente.accion ?? "Confirmar"}
        </Button>
      </div>
    </Modal>
  ) : null;

  return { confirmar, dialogo };
}
