import { cn } from "@/lib/cn";

type Variante = "primaria" | "fantasma" | "peligro";

const VARIANTES: Record<Variante, string> = {
  primaria: "bg-acento text-white hover:bg-acento-85",
  fantasma: "bg-isla-alta text-tinta-85 hover:bg-acento-10 hover:text-tinta",
  peligro: "bg-peligro/10 text-peligro hover:bg-peligro/20",
};

type Props = React.ComponentProps<"button"> & { variante?: Variante };

/** Botón-píldora del panel. Default fantasma; type="button" salvo que se pida submit. */
export function Button({ variante = "fantasma", className, type, ...props }: Props) {
  return (
    <button
      type={type ?? "button"}
      {...props}
      className={cn(
        "inline-flex h-control items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        VARIANTES[variante],
        className,
      )}
    />
  );
}
