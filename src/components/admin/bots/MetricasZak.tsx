"use client";

import { ID_ZAK } from "@/lib/bots/tipos";
import { Actividad } from "./Actividad";

type Props = {
  /** Mensajes que salieron de verdad (los fallidos no cuentan). */
  enviados: number;
  respondidos: number;
  interesados: number;
  tandas: number;
};

/** Cómo va la prospección de Zak, en cuatro números y su actividad reciente. */
export function MetricasZak({ enviados, respondidos, interesados, tandas }: Props) {
  const cifras: { valor: string; label: string }[] = [
    {
      valor: enviados > 0 ? `${Math.round((respondidos / enviados) * 100)}%` : "—",
      label: `tasa de respuesta de la prospección (${respondidos}/${enviados})`,
    },
    { valor: String(interesados), label: "interesados en total" },
    { valor: String(tandas), label: "tandas enviadas" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-aire">
        {cifras.map((c) => (
          <div key={c.label} className="flex flex-col gap-0.5 rounded-fila bg-isla-alta p-4">
            <span className="text-2xl font-semibold text-tinta">{c.valor}</span>
            <span className="text-xs text-tinta-60">{c.label}</span>
          </div>
        ))}
      </div>
      <Actividad instanciaId={ID_ZAK} />
    </div>
  );
}
