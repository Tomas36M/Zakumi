"use client";

import { fechaCorta, formatoUsd } from "@/lib/admin/formato";
import type { ResumenTerritorio, Territorio } from "@/lib/admin/territorios";
import { Card } from "@/components/admin/ui/Card";

type Props = {
  territorio: Territorio;
  resumen: ResumenTerritorio;
  /** El contorno se cruza a sí mismo: puede faltar censo. */
  cruzado: boolean;
  onAbrir: (id: string) => void;
};

/** Una tarjeta del grid de Territorios: lo que produjo y lo que costó. */
export function TarjetaTerritorioCard({ territorio: t, resumen, cruzado, onAbrir }: Props) {
  return (
    <Card onClick={() => onAbrir(t.id)} aria-label={`Abrir ${t.nombre}`}>
      <span className="truncate text-base font-semibold text-tinta">{t.nombre}</span>

      <span className="flex items-baseline gap-4">
        <span>
          <span className="font-editorial text-3xl italic text-tinta">{resumen.leads}</span>
          <span className="text-xs text-tinta-40"> {resumen.leads === 1 ? "lead" : "leads"}</span>
        </span>
        <span>
          <span className="font-editorial text-3xl italic text-acento">{resumen.sinWeb}</span>
          <span className="text-xs text-tinta-40"> sin web</span>
        </span>
      </span>

      <span className="text-xs text-tinta-40">
        {t.ultimo_barrido ? `barrido ${fechaCorta(t.ultimo_barrido)}` : "sin barrer"} ·{" "}
        {resumen.llamadas} {resumen.llamadas === 1 ? "consulta" : "consultas"} ≈{" "}
        {formatoUsd(resumen.costoUsd)}
      </span>

      {cruzado && (
        <span className="text-xs text-peligro">
          Contorno cruzado: la zona cubierta dos veces cuenta como «fuera» — puede faltar censo.
        </span>
      )}
    </Card>
  );
}
