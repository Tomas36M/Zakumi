"use client";

import { useMemo, useState } from "react";
import type { Cita360 } from "@/lib/agenda/consultas";
import { carriles, diaBogotaDe, posicionEnGrilla, type RangoSemana } from "@/lib/agenda/semana";
import { cn } from "@/lib/cn";
import { ColumnaDia, type CitaColocada } from "./ColumnaDia";
import { HORAS, PX_POR_HORA } from "./grilla";

type Props = {
  citas: Cita360[];
  rango: RangoSemana;
  ahoraIso: string;
  citaAbierta: string | null;
  onAbrir: (id: string) => void;
};

/** Minutos desde medianoche de Bogotá de un instante. */
function minutosBogota(iso: string): number {
  const d = new Date(new Date(iso).getTime() - 5 * 3_600_000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/**
 * La semana: 7 columnas × 16 horas (6:00–22:00) en desktop; en móvil un día
 * a la vez con un selector arriba. Las citas se colocan por minutos y se
 * reparten en carriles cuando se pisan (`semana.ts`, puro y probado).
 */
export function Semana({ citas, rango, ahoraIso, citaAbierta, onAbrir }: Props) {
  const hoy = rango.dias.find((d) => d.esHoy)?.fecha ?? null;
  const [diaMovil, setDiaMovil] = useState(hoy ?? rango.lunes);

  const porColumna = useMemo(() => {
    const carr = carriles(citas);
    const columnas: CitaColocada[][] = rango.dias.map(() => []);
    for (const cita of citas) {
      const posicion = posicionEnGrilla(cita, rango);
      if (!posicion) continue;
      columnas[posicion.columna].push({
        cita,
        posicion,
        carril: carr.get(cita.id) ?? { carril: 0, total: 1 },
      });
    }
    return columnas;
  }, [citas, rango]);

  const diaDeAhora = diaBogotaDe(ahoraIso);
  const ahoraMin = minutosBogota(ahoraIso);
  const columnaMovil = Math.max(0, rango.dias.findIndex((d) => d.fecha === diaMovil));

  return (
    <div className="flex flex-col">
      {/* Móvil: un día a la vez. */}
      <div role="tablist" aria-label="Día" className="mb-3 flex gap-1 min-[900px]:hidden">
        {rango.dias.map((d) => (
          <button
            key={d.fecha}
            type="button"
            role="tab"
            aria-selected={d.fecha === diaMovil}
            onClick={() => setDiaMovil(d.fecha)}
            className={cn(
              "flex-1 rounded-full py-1.5 text-xs transition-colors",
              d.fecha === diaMovil ? "bg-acento text-white" : "bg-isla-alta text-tinta-60",
              d.esHoy && d.fecha !== diaMovil && "text-acento",
            )}
          >
            {d.etiqueta}
          </button>
        ))}
      </div>

      {/* Cabecera de días: pegada arriba mientras la grilla scrollea. */}
      <div className="sticky top-0 z-40 hidden grid-cols-[3rem_repeat(7,minmax(0,1fr))] bg-isla min-[900px]:grid">
        <span />
        {rango.dias.map((d) => (
          <span
            key={d.fecha}
            className={cn(
              "border-b border-l border-hairline px-2 py-2 text-xs font-medium",
              d.esHoy ? "text-acento" : "text-tinta-60",
            )}
          >
            {d.etiqueta}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-[3rem_minmax(0,1fr)] min-[900px]:grid-cols-[3rem_repeat(7,minmax(0,1fr))]">
        {/* Columna de horas. */}
        <div className="relative" style={{ height: HORAS.length * PX_POR_HORA }}>
          {HORAS.map((h, i) => (
            <span
              key={h}
              className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-tinta-40"
              style={{ top: i * PX_POR_HORA }}
            >
              {h}:00
            </span>
          ))}
        </div>

        {rango.dias.map((d, i) => (
          <div
            key={d.fecha}
            className={cn(i !== columnaMovil && "hidden min-[900px]:block")}
          >
            <ColumnaDia
              citas={porColumna[i]}
              esHoy={d.esHoy}
              ahoraMin={d.fecha === diaDeAhora ? ahoraMin : null}
              citaAbierta={citaAbierta}
              onAbrir={onAbrir}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
