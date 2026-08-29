"use client";

import Image from "next/image";
import {
  VERTICAL_GENERICO,
  VERTICALES_PROSPECCION,
  verticalPorSlug,
} from "@/lib/admin/zak";
import { Select } from "@/components/admin/ui/Field";

const OPCIONES = [...VERTICALES_PROSPECCION, VERTICAL_GENERICO];

type Props = {
  valor: string;
  onCambiar: (slug: string) => void;
  disabled?: boolean;
};

/**
 * El selector de plantilla de saludo (una por vertical) con vista previa de
 * lo que va a salir: el folleto del nicho como header + el texto aprobado.
 */
export function SelectorPlantilla({ valor, onCambiar, disabled = false }: Props) {
  const vertical = verticalPorSlug(valor);
  return (
    <div className="flex flex-col gap-2">
      <Select
        aria-label="Plantilla de saludo"
        value={vertical.slug}
        onChange={(e) => onCambiar(e.target.value)}
        disabled={disabled}
      >
        {OPCIONES.map((v) => (
          <option key={v.slug} value={v.slug}>
            {v.label}
          </option>
        ))}
      </Select>
      <div className="flex items-start gap-3 rounded-fila bg-isla-alta p-3">
        <Image
          key={vertical.slug}
          src={`/folletos/${vertical.folleto}`}
          alt={`Folleto de ${vertical.label}`}
          width={56}
          height={56}
          className="h-14 w-14 shrink-0 rounded-fila object-cover object-top"
        />
        <p className="text-xs leading-relaxed text-tinta-60">{vertical.texto}</p>
      </div>
    </div>
  );
}
