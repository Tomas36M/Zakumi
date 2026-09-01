"use client";

// `Map` sin alias sombrearía el Map global del lenguaje.
import { Contact, Map as IconoMapa } from "lucide-react";
import type { CaraProspeccion } from "@/lib/admin/prospeccion-caras";
import { cn } from "@/lib/cn";

type Props = {
  activa: CaraProspeccion;
  onCambiar: (cara: CaraProspeccion) => void;
  /** Subtítulo vivo de cada tarjeta: el dato manda sobre la etiqueta. */
  territorios: number;
  leads: number;
  sinWeb: number;
  /** Hay un barrido abierto: se marca la cara de Territorio con un punto para
   * que desde Leads se vea que se está gastando plata al otro lado. */
  barriendo?: boolean;
};

/**
 * Las dos caras de "Encontrar clientes". Deliberadamente NO son <Tabs>: viven
 * un nivel POR ENCIMA de las pestañas, y si se vieran iguales los dos niveles
 * se leerían como uno. Mismo criterio (y mismo aspecto) que CarasZak.
 */
export function CarasProspeccion({
  activa,
  onCambiar,
  territorios,
  leads,
  sinWeb,
  barriendo = false,
}: Props) {
  const caras = [
    {
      id: "territorio" as const,
      Icono: IconoMapa,
      label: "Territorio",
      detalle: `${territorios} ${territorios === 1 ? "territorio" : "territorios"} · ${leads} leads`,
    },
    {
      id: "leads" as const,
      Icono: Contact,
      label: "Leads",
      detalle: `${leads} leads · ${sinWeb} sin web`,
    },
  ];

  return (
    <div
      role="tablist"
      aria-label="Las dos caras de Encontrar clientes"
      className="flex flex-wrap gap-2"
    >
      {caras.map(({ id, Icono, label, detalle }) => {
        const esActiva = id === activa;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={esActiva}
            onClick={() => onCambiar(id)}
            className={cn(
              "flex items-center gap-3 rounded-fila border px-4 py-2.5 text-left transition-colors",
              esActiva
                ? "border-acento bg-acento-10"
                : "border-hairline hover:border-acento/40 hover:bg-acento-10/40",
            )}
          >
            <Icono
              className={cn("h-5 w-5 shrink-0", esActiva ? "text-acento" : "text-tinta-40")}
            />
            <span className="flex flex-col">
              <span
                className={cn(
                  "flex items-center gap-1.5 text-sm font-semibold",
                  esActiva ? "text-tinta" : "text-tinta-60",
                )}
              >
                {label}
                {id === "territorio" && barriendo && (
                  <span
                    aria-label="barrido en curso"
                    title="Hay un barrido en curso"
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-acento"
                  />
                )}
              </span>
              <span className="text-xs text-tinta-40">{detalle}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
