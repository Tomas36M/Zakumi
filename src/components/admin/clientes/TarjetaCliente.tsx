"use client";

import { descripcionVencimiento, formatearCOP, type Cliente, type ResumenCliente } from "@/lib/admin/cartera";
import { cn } from "@/lib/cn";
import { Card } from "@/components/admin/ui/Card";
import { COLOR_SEMAFORO } from "./semaforo";

type Props = {
  cliente: Cliente;
  resumen: ResumenCliente;
  hoy: string;
  activa: boolean;
  onAbrir: (id: string) => void;
};

/** Una tarjeta del grid de Clientes: quién es, qué tiene y cuándo se le cobra. */
export function TarjetaCliente({ cliente: c, resumen, hoy, activa, onAbrir }: Props) {
  return (
    <Card activa={activa} onClick={() => onAbrir(c.id)} aria-label={`Abrir ${c.nombre}`}>
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className={cn("block truncate text-base font-semibold", c.activo ? "text-tinta" : "text-tinta-40")}>
            {c.nombre}
            {!c.activo && " · inactivo"}
          </span>
          <span className="block truncate text-xs text-tinta-40">
            {[c.telefono, c.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
          </span>
        </span>
        <span
          className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", COLOR_SEMAFORO[resumen.semaforo])}
          title={resumen.semaforo.replaceAll("_", " ")}
        />
      </span>

      <span className="flex items-baseline gap-4">
        <span>
          <span className="font-editorial text-3xl italic text-tinta">{resumen.activos}</span>
          <span className="text-xs text-tinta-40">
            {" "}
            {resumen.activos === 1 ? "producto activo" : "productos activos"}
          </span>
        </span>
        {resumen.mrr > 0 && (
          <span>
            <span className="font-editorial text-xl italic text-acento">{formatearCOP(resumen.mrr)}</span>
            <span className="text-xs text-tinta-40"> al mes</span>
          </span>
        )}
      </span>

      <span
        className={cn(
          "text-xs",
          resumen.semaforo === "vencido" ? "font-medium text-peligro" : "text-tinta-40",
        )}
      >
        {resumen.proximaFecha
          ? `próximo cobro ${descripcionVencimiento(resumen.proximaFecha, hoy)}`
          : "sin cobro programado"}
      </span>
    </Card>
  );
}
