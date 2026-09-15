"use client";

import { useState } from "react";
import Link from "next/link";
import { PencilLine } from "lucide-react";
import type { Cliente, ProductoConCliente } from "@/lib/admin/cartera";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Modal } from "@/components/admin/ui/Modal";
import { FormCliente } from "./FormCliente";
import { PagosRecientes } from "./PagosRecientes";
import { ProductosCliente } from "./ProductosCliente";

type Props = {
  clienteId: string | null;
  /** El cliente resuelto por el dueño en cada render (id → fila viva). */
  cliente: Cliente | null;
  productos: ProductoConCliente[];
  hoy: string;
  onCerrar: () => void;
  onCambio: () => void;
};

/** La ficha del cliente en un modal: contacto, datos editables, productos y
 * pagos. La Ficha 360 (bots en vivo, upsell) sigue a un clic. */
export function ClienteModal({ clienteId, cliente, productos, hoy, onCerrar, onCambio }: Props) {
  const [editando, setEditando] = useState(false);
  // Cada pago registrado incrementa la versión: PagosRecientes relee.
  const [versionPagos, setVersionPagos] = useState(0);

  return (
    <Modal
      abierto={clienteId !== null}
      onCerrar={(abierto) => {
        if (!abierto) onCerrar();
      }}
      titulo={cliente?.nombre ?? "Cliente"}
      descripcion={
        cliente
          ? [cliente.telefono, cliente.email].filter(Boolean).join(" · ") || "Sin datos de contacto"
          : undefined
      }
      tamano="ancho"
    >
      {cliente ? (
        <div key={cliente.id} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variante={editando ? "primaria" : "fantasma"} onClick={() => setEditando((e) => !e)}>
              <PencilLine className="h-4 w-4" /> {editando ? "Cerrar edición" : "Editar datos"}
            </Button>
            <Link
              href={`/admin/clientes/${cliente.id}`}
              className="inline-flex h-control items-center justify-center gap-2 rounded-full bg-isla-alta px-4 text-sm font-medium text-tinta-85 transition-colors hover:bg-acento-10 hover:text-tinta"
            >
              Ver ficha completa →
            </Link>
            {!cliente.activo && <span className="text-xs text-tinta-40">Cliente inactivo</span>}
          </div>

          {editando && (
            <FormCliente
              cliente={cliente}
              onGuardado={() => {
                setEditando(false);
                onCambio();
              }}
              onCancelar={() => setEditando(false)}
            />
          )}

          <div className="grid gap-4 min-[720px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <ProductosCliente
              clienteId={cliente.id}
              productos={productos}
              hoy={hoy}
              onCambio={onCambio}
              onPago={() => setVersionPagos((v) => v + 1)}
            />
            <PagosRecientes clienteId={cliente.id} productos={productos} version={versionPagos} />
          </div>
        </div>
      ) : (
        <Banner variante="error">Este cliente no está en la lista cargada. Recarga la página.</Banner>
      )}
    </Modal>
  );
}
