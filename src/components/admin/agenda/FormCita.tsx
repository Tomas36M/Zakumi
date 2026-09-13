"use client";

import { useState } from "react";
import type { Cita } from "@/lib/agenda/citas";
import { citaDesdeFormulario, DURACIONES_MIN, formularioDesdeCita } from "@/lib/agenda/semana";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input, Select } from "@/components/admin/ui/Field";

type Props = {
  /** La cita actual al reprogramar; nada al agendar por primera vez. */
  inicial?: Cita | null;
  etiquetaAccion: string;
  ocupado: boolean;
  onConfirmar: (cita: Cita) => void;
  onCancelar: () => void;
};

/** Fecha, hora (de Bogotá) y duración. Lo comparten la agenda y la bandeja. */
export function FormCita({ inicial, etiquetaAccion, ocupado, onConfirmar, onCancelar }: Props) {
  const base = inicial ? formularioDesdeCita(inicial) : { fecha: "", hora: "", duracionMin: 30 };
  const [fecha, setFecha] = useState(base.fecha);
  const [hora, setHora] = useState(base.hora);
  const [duracion, setDuracion] = useState(base.duracionMin);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-3 rounded-fila border border-hairline p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const cita = citaDesdeFormulario({ fecha, hora, duracionMin: duracion });
        if (!cita) {
          setError("Falta la fecha o la hora.");
          return;
        }
        setError(null);
        onConfirmar(cita);
      }}
    >
      <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-3">
        <Field label="Fecha">
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </Field>
        <Field label="Hora (Bogotá)">
          <Input type="time" step={900} value={hora} onChange={(e) => setHora(e.target.value)} required />
        </Field>
        <Field label="Duración">
          <Select value={duracion} onChange={(e) => setDuracion(Number(e.target.value))}>
            {DURACIONES_MIN.map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
            {!DURACIONES_MIN.includes(duracion as (typeof DURACIONES_MIN)[number]) && (
              <option value={duracion}>{duracion} min</option>
            )}
          </Select>
        </Field>
      </div>
      {error && <Banner variante="error">{error}</Banner>}
      <div className="flex flex-wrap gap-2">
        <Button variante="primaria" type="submit" disabled={ocupado}>
          {etiquetaAccion}
        </Button>
        <Button onClick={onCancelar} disabled={ocupado}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
