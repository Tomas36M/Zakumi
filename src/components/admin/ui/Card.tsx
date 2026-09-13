import { cn } from "@/lib/cn";

type Props = React.ComponentProps<"button"> & {
  /** Tarjeta abierta (su modal está en pantalla): borde acento. */
  activa?: boolean;
};

/**
 * La unidad de un <GridCards>: una tarjeta entera clicable que abre su ficha.
 * Es un <button> y no un <div onClick> para que el teclado y el lector de
 * pantalla la vean como lo que es. Contenido en columna, alineado arriba.
 */
export function Card({ activa, className, type, ...props }: Props) {
  return (
    <button
      type={type ?? "button"}
      {...props}
      className={cn(
        "flex w-full flex-col items-stretch gap-2 rounded-fila border bg-isla-alta/50 p-4 text-left transition-colors hover:bg-acento-10/40",
        activa ? "border-acento" : "border-transparent hover:border-acento/40",
        className,
      )}
    />
  );
}
