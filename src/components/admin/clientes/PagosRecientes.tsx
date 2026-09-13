"use client";

import { useEffect, useState } from "react";
import { formatearCOP, type Pago, type ProductoContratado } from "@/lib/admin/cartera";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { Island } from "@/components/admin/ui/Island";
import { ListRow } from "@/components/admin/ui/ListRow";
import { Skeleton } from "@/components/admin/ui/Skeleton";

async function fetchPagos(productoIds: string[]): Promise<Pago[]> {
  if (productoIds.length === 0) return [];
  const supabase = createSupabaseBrowser();
  const { data } = await supabase
    .from("pagos")
    .select("*")
    .in("producto_id", productoIds)
    .order("fecha", { ascending: false })
    .limit(20);
  return (data as Pago[]) ?? [];
}

type Props = {
  productos: ProductoContratado[];
  /** Cambia con cada pago registrado: se vuelven a leer. */
  version: number;
};

/** Los últimos 20 pagos del cliente, leídos desde el navegador. */
export function PagosRecientes({ productos, version }: Props) {
  const [pagos, setPagos] = useState<Pago[] | null>(null);
  const ids = productos.map((p) => p.id).join(",");

  useEffect(() => {
    let activo = true;
    fetchPagos(ids ? ids.split(",") : []).then((ps) => {
      if (activo) setPagos(ps);
    });
    return () => {
      activo = false;
    };
  }, [ids, version]);

  return (
    <Island className="bg-isla-alta/50" titulo="Pagos recientes" aria-label="Pagos recientes">
      {pagos === null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
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
