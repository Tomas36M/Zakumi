"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ordenarPorUrgencia, type Cliente, type ProductoConCliente } from "@/lib/admin/cartera";
import { Button } from "@/components/admin/ui/Button";
import { Cockpit, CockpitBody } from "@/components/admin/ui/Cockpit";
import { Modal } from "@/components/admin/ui/Modal";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Tabs } from "@/components/admin/ui/Tabs";
import { useParametroUrl } from "@/components/admin/ui/useParametroUrl";
import { ClienteModal } from "./ClienteModal";
import { GridClientes } from "./GridClientes";
import { ListaCobros } from "./ListaCobros";
import { NuevoClienteForm } from "./NuevoClienteForm";

export type VistaClientes = "cobros" | "clientes";

type Props = {
  productos: ProductoConCliente[];
  clientes: Cliente[];
  vistaInicial: VistaClientes;
  /** El día de hoy en Bogotá, decidido en el servidor. */
  hoy: string;
};

const VISTAS = [
  { id: "cobros", label: "Próximos cobros" },
  { id: "clientes", label: "Clientes" },
] as const;

/**
 * Clientes: la cartera. Dos caras en la cabecera — los próximos cobros por
 * urgencia y el grid de clientes — y una sola ficha (modal, `?cliente=<id>`)
 * a la que llegan las dos.
 */
export function ClientesView({ productos, clientes, vistaInicial, hoy }: Props) {
  const router = useRouter();
  const [vista, setVista] = useState<VistaClientes>(vistaInicial);
  const [, ponerTab] = useParametroUrl("tab");
  // El cliente abierto vive en la URL: «Convertir en cliente» desde un lead
  // aterriza aquí con `?cliente=<id>` y la ficha ya está abierta.
  const [clienteId, abrirCliente] = useParametroUrl("cliente");
  const [creando, setCreando] = useState(false);

  const cobros = useMemo(() => ordenarPorUrgencia(productos.filter((p) => p.activo)), [productos]);
  const clienteAbierto = clienteId ? (clientes.find((c) => c.id === clienteId) ?? null) : null;
  const productosDelAbierto = useMemo(
    () => productos.filter((p) => p.cliente_id === clienteId),
    [productos, clienteId],
  );

  function cambiarVista(nueva: VistaClientes) {
    setVista(nueva);
    ponerTab(nueva);
  }

  return (
    <Cockpit>
      <PageHeader
        titulo="Clientes"
        coletilla="la cartera"
        migas={
          vista === "clientes" ? ["Clientes"] : ["Clientes", "Próximos cobros"]
        }
        navegacion={<Tabs pestanas={VISTAS} activa={vista} onCambiar={cambiarVista} />}
        contador={
          <>
            <strong className="text-tinta-85">{clientes.length}</strong> clientes ·{" "}
            <strong className="text-tinta-85">{cobros.length}</strong> cobros activos
          </>
        }
        acciones={<Button onClick={() => setCreando(true)}>Nuevo cliente</Button>}
      />

      <CockpitBody>
        {vista === "cobros" ? (
          <ListaCobros cobros={cobros} hoy={hoy} clienteAbierto={clienteId} onAbrir={abrirCliente} />
        ) : (
          <GridClientes
            clientes={clientes}
            productos={productos}
            hoy={hoy}
            clienteAbierto={clienteId}
            onAbrir={abrirCliente}
          />
        )}
      </CockpitBody>

      <ClienteModal
        clienteId={clienteId}
        cliente={clienteAbierto}
        productos={productosDelAbierto}
        hoy={hoy}
        onCerrar={() => abrirCliente(null)}
        onCambio={() => router.refresh()}
      />

      <Modal
        abierto={creando}
        onCerrar={(abierto) => {
          if (!abierto) setCreando(false);
        }}
        titulo="Cliente nuevo"
        descripcion="También puedes convertir un negocio del CRM desde su ficha."
      >
        {creando && (
          <NuevoClienteForm
            onCreado={(id) => {
              setCreando(false);
              abrirCliente(id);
              router.refresh();
            }}
            onCancelar={() => setCreando(false)}
          />
        )}
      </Modal>
    </Cockpit>
  );
}
