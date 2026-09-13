"use client";

import { horaDeIso } from "@/lib/admin/formato";
import type { Cita360 } from "@/lib/agenda/consultas";
import type { Carril, PosicionGrilla } from "@/lib/agenda/semana";
import { fechaLegible } from "@/lib/solicitudes/mensaje";
import { cn } from "@/lib/cn";
import { LABEL_ORIGEN } from "../origen";
import { PX_POR_MIN } from "./grilla";

type Props = {
  cita: Cita360;
  posicion: PosicionGrilla;
  carril: Carril;
  activa: boolean;
  onAbrir: (id: string) => void;
};

/** Una cita en su columna: colocada por minutos, repartida en carriles si
 * se pisa con otra. Es un <button>: se abre con teclado. */
export function BloqueCita({ cita, posicion, carril, activa, onAbrir }: Props) {
  return (
    <button
      type="button"
      onClick={() => onAbrir(cita.id)}
      aria-label={`${cita.nombre ?? "Sin nombre"}, ${fechaLegible(cita.inicio)}, ${LABEL_ORIGEN[cita.origen]}`}
      title={cita.nombre ?? "Sin nombre"}
      className={cn(
        "absolute flex flex-col overflow-hidden rounded-fila border px-2 py-1 text-left transition-colors",
        activa
          ? "z-20 border-acento bg-acento text-white"
          : "z-10 border-acento/40 bg-acento-10 text-tinta hover:bg-acento-25",
        posicion.recortada && "border-dashed",
      )}
      style={{
        top: posicion.desdeMin * PX_POR_MIN,
        height: posicion.duracionMin * PX_POR_MIN,
        left: `calc(${(carril.carril / carril.total) * 100}% + 2px)`,
        width: `calc(${100 / carril.total}% - 4px)`,
      }}
    >
      <span className={cn("text-[11px] tabular-nums", activa ? "text-white/80" : "text-tinta-60")}>
        {horaDeIso(cita.inicio) ?? "—"}
        {posicion.recortada && " · fuera de horario"}
      </span>
      <span className="truncate text-xs font-medium">{cita.nombre ?? "Sin nombre"}</span>
      {posicion.duracionMin >= 45 && (
        <span className={cn("truncate text-[11px]", activa ? "text-white/80" : "text-tinta-40")}>
          {cita.servicio ?? LABEL_ORIGEN[cita.origen]}
        </span>
      )}
    </button>
  );
}
