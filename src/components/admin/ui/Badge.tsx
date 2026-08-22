import { cn } from "@/lib/cn";

const TONOS = {
  nuevo: "bg-estado-nuevo/15 text-estado-nuevo",
  contactado: "bg-estado-contactado/15 text-estado-contactado",
  respondido: "bg-estado-respondido/15 text-estado-respondido",
  interesado: "bg-estado-interesado/15 text-estado-interesado",
  cliente: "bg-estado-cliente/15 text-estado-cliente",
  descartado: "bg-estado-descartado/40 text-tinta-60",
  vivo: "bg-vivo/15 text-vivo",
  peligro: "bg-peligro/15 text-peligro",
  neutro: "bg-isla-alta text-tinta-60",
} as const;

export type TonoBadge = keyof typeof TONOS;

type Props = {
  tono: TonoBadge;
  className?: string;
  children: React.ReactNode;
};

export function Badge({ tono, className, children }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONOS[tono],
        className,
      )}
    >
      {children}
    </span>
  );
}
