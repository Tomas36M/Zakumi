"use client";

import { useState } from "react";
import { CICLOS, type Ciclo } from "@/lib/admin/cartera";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input, Select } from "@/components/admin/ui/Field";
import { BotonRechazar } from "./BotonRechazar";

type Props = {
  ocupado: boolean;
  sugerida: number;
  cicloSugerido: Ciclo;
  onCotizar: (monto: number, ciclo: Ciclo, nota: string) => void;
  onRechazar: (motivo: string) => void;
};

/** Ponerle precio: monto, ciclo y una nota que el cliente ve. */
export function FormCotizar({ ocupado, sugerida, cicloSugerido, onCotizar, onRechazar }: Props) {
  const [monto, setMonto] = useState(sugerida > 0 ? String(sugerida) : "");
  const [ciclo, setCiclo] = useState<Ciclo>(cicloSugerido);
  const [nota, setNota] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Monto (COP)">
          <Input inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </Field>
        <Field label="Ciclo">
          <Select value={ciclo} onChange={(e) => setCiclo(e.target.value as Ciclo)}>
            {CICLOS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Nota para el cliente (opcional)">
        <Input
          value={nota}
          maxLength={2000}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Qué incluye, tiempos, condiciones…"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variante="primaria"
          disabled={ocupado || !Number.isFinite(Number(monto)) || Number(monto) <= 0}
          onClick={() => onCotizar(Number(monto), ciclo, nota)}
        >
          {ocupado ? "Guardando…" : "Cotizar"}
        </Button>
        <BotonRechazar ocupado={ocupado} onRechazar={onRechazar} />
      </div>
    </div>
  );
}
