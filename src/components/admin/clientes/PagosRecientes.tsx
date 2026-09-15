"use client";

import { useEffect, useState } from "react";
import { formatearCOP, type Pago, type ProductoContratado } from "@/lib/admin/cartera";
import { Banner } from "@/components/admin/ui/Banner";
import { Island } from "@/components/admin/ui/Island";
import { ListRow } from "@/components/admin/ui/ListRow";
import { Skeleton } from "@/components/admin/ui/Skeleton";

/**
 * Lee por /admin/api (cliente de servidor), no con el SDK de Supabase en el
 * navegador: ese SDK viajaba a /admin/clientes solo por esta lectura.
 * `null` = la lectura falló, que no es lo mismo que "sin pagos".
 */
async function leerPagos(clienteId: string): Promise<Pago[] | null> {
  try {
    const res = await fetch(`/admin/api/clientes/${clienteId}/pagos`);
    if (!res.ok) return null;
    return ((await res.json()) as { pagos: Pago[] }).pagos;
  } catch {
    return null;
  }
}

type Props = {
  clienteId: string;
  /** Los productos del cliente: solo para ponerle nombre a cada pago. */
  productos: ProductoContratado[];
  /** Cambia con cada pago registrado: se vuelven a leer. */
  version: number;
};

/** Los últimos 20 pagos del cliente. */
export function PagosRecientes({ clienteId, productos, version }: Props) {
  // null = primera lectura en curso; "error" = la última lectura falló. Un
  // error nunca se pinta como "sin pagos": es plata.
  const [pagos, setPagos] = useState<Pago[] | "error" | null>(null);

  // Los pagos solo cambian al registrar uno (`version`): en el panel no se
  // borran productos ni pagos, y un producto nuevo nace sin pagos.
  useEffect(() => {
    let activo = true;
    leerPagos(clienteId).then((ps) => {
      if (activo) setPagos(ps ?? "error");
    });
    return () => {
      activo = false;
    };
  }, [clienteId, version]);

  return (
    <Island className="bg-isla-alta/50" titulo="Pagos recientes" aria-label="Pagos recientes">
      {pagos === null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ) : pagos === "error" ? (
        <Banner variante="error">
          No se pudieron cargar los pagos. Recarga la página en un momento.
        </Banner>
      ) : pagos.length === 0 ? (
        <p className="text-sm text-tinta-40">Sin pagos registrados todavía.</p>
      ) : (
        <ul className="barra-fina flex max-h-56 flex-col gap-1 overflow-y-auto">
          {pagos.map((pg) => {
            const producto = productos.find((p) => p.id === pg.producto_id);
            return (
              <li key={pg.id}>
                <ListRow interactiva={false} className="flex flex-col gap-0.5">
                  <span className="text-xs text-tinta-40">
                    {pg.fecha} · {producto?.nombre ?? "producto"}
                  </span>
                  <span className="text-sm text-tinta">
                    {formatearCOP(pg.monto)}
                    {pg.nota ? ` — ${pg.nota}` : ""}
                  </span>
                </ListRow>
              </li>
            );
          })}
        </ul>
      )}
    </Island>
  );
}
