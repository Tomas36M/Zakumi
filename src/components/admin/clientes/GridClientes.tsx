"use client";

import { resumenCliente, type Cliente, type ProductoConCliente } from "@/lib/admin/cartera";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { GridCards } from "@/components/admin/ui/GridCards";
import { TarjetaCliente } from "./TarjetaCliente";

type Props = {
  clientes: Cliente[];
  productos: ProductoConCliente[];
  hoy: string;
  clienteAbierto: string | null;
  onAbrir: (id: string) => void;
};

/** El grid de clientes: una tarjeta por cliente con su resumen. */
export function GridClientes({ clientes, productos, hoy, clienteAbierto, onAbrir }: Props) {
  if (clientes.length === 0) {
    return (
      <EmptyState
        titulo="Sin clientes todavía."
        detalle="Los puedes crear aquí o convertir un negocio del CRM desde su ficha."
      />
    );
  }

  return (
    <GridCards>
      {clientes.map((c) => (
        <TarjetaCliente
          key={c.id}
          cliente={c}
          resumen={resumenCliente(
            productos.filter((p) => p.cliente_id === c.id),
            hoy,
          )}
          hoy={hoy}
          activa={c.id === clienteAbierto}
          onAbrir={onAbrir}
        />
      ))}
    </GridCards>
  );
}
