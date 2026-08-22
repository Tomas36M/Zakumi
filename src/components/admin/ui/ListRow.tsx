import { cn } from "@/lib/cn";

type Props = React.ComponentProps<"div"> & {
  /** Fila seleccionada/abierta: fondo acento suave. */
  activa?: boolean;
  /** false para filas puramente informativas (sin hover ni cursor). */
  interactiva?: boolean;
};

export function ListRow({ activa, interactiva = true, className, ...props }: Props) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-fila px-3 py-2.5 transition-colors",
        interactiva && "cursor-pointer hover:bg-isla-alta",
        activa && "bg-acento-10 hover:bg-acento-10",
        className,
      )}
    />
  );
}
