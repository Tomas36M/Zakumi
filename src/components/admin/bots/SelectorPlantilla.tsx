"use client";

import Image from "next/image";
import {
  TODOS_LOS_VERTICALES,
  srcFolleto,
  verticalPorSlug,
  type VerticalProspeccion,
} from "@/lib/admin/zak";
import { Select } from "@/components/admin/ui/Field";

type Props = {
  valor: string;
  onCambiar: (slug: string) => void;
  disabled?: boolean;
  /** El catálogo VIVO (props desde el server). Sin él, el estático de zak.ts. */
  opciones?: readonly VerticalProspeccion[];
};

/**
 * El selector de plantilla de saludo (una por vertical) con vista previa de
 * lo que va a salir: el folleto del nicho como header + el texto aprobado.
 * Una plantilla con edición en revisión en Meta se deshabilita: enviarla
 * durante la revisión puede fallar.
 */
export function SelectorPlantilla({
  valor,
  onCambiar,
  disabled = false,
  opciones = TODOS_LOS_VERTICALES,
}: Props) {
  const generico = opciones.find((v) => v.slug === "generico") ?? opciones[0];
  const vertical = verticalPorSlug(valor, opciones, generico);
  return (
    <div className="flex flex-col gap-2">
      <Select
        aria-label="Plantilla de saludo"
        value={vertical.slug}
        onChange={(e) => onCambiar(e.target.value)}
        disabled={disabled}
      >
        {opciones.map((v) => (
          <option key={v.slug} value={v.slug} disabled={v.enRevision === true}>
            {v.label}
            {v.enRevision ? " (en revisión en Meta)" : ""}
          </option>
        ))}
      </Select>
      <div className="flex items-start gap-3 rounded-fila bg-isla-alta p-3">
        <Image
          key={vertical.slug}
          src={srcFolleto(vertical)}
          alt={`Folleto de ${vertical.label}`}
          width={56}
          height={70}
          className="h-[70px] w-14 shrink-0 rounded-fila object-cover object-top"
        />
        <p className="text-xs leading-relaxed text-tinta-60">{vertical.texto}</p>
      </div>
    </div>
  );
}
