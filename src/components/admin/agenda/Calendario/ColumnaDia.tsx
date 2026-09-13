"use client";

import type { Cita360 } from "@/lib/agenda/consultas";
import { HORA_INICIO, MINUTOS_GRILLA, type Carril, type PosicionGrilla } from "@/lib/agenda/semana";
import { cn } from "@/lib/cn";
import { BloqueCita } from "./BloqueCita";
import { ALTO_GRILLA, FONDO_HORAS, PX_POR_MIN } from "./grilla";

export type CitaColocada = { cita: Cita360; posicion: PosicionGrilla; carril: Carril };

type Props = {
  citas: CitaColocada[];
  esHoy: boolean;
  /** Minutos desde medianoche de Bogotá, o null si «ahora» no es este día. */
  ahoraMin: number | null;
  citaAbierta: string | null;
  onAbrir: (id: string) => void;
};

/** Un día de la grilla: las líneas de hora, sus citas y la raya de «ahora». */
export function ColumnaDia({ citas, esHoy, ahoraMin, citaAbierta, onAbrir }: Props) {
  const ahoraEnGrilla = ahoraMin === null ? null : ahoraMin - HORA_INICIO * 60;
  const pintarAhora =
    ahoraEnGrilla !== null && ahoraEnGrilla >= 0 && ahoraEnGrilla <= MINUTOS_GRILLA;

  return (
    <div
      className={cn("relative border-l border-hairline", esHoy && "bg-acento-10/20")}
      style={{ height: ALTO_GRILLA, ...FONDO_HORAS }}
    >
      {citas.map(({ cita, posicion, carril }) => (
        <BloqueCita
          key={cita.id}
          cita={cita}
          posicion={posicion}
          carril={carril}
          activa={cita.id === citaAbierta}
          onAbrir={onAbrir}
        />
      ))}
      {pintarAhora && (
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 left-0 z-30 h-px bg-acento"
          style={{ top: ahoraEnGrilla * PX_POR_MIN }}
        >
          <span className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-acento" />
        </div>
      )}
    </div>
  );
}
