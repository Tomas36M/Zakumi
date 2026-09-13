import { cn } from "@/lib/cn";

/**
 * La rejilla de tarjetas del panel (territorios, clientes, solicitudes).
 * Columnas de al menos 260px que se reparten el ancho: en desktop ocupa la
 * pantalla entera, en móvil cae a una columna sola.
 */
export function GridCards({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "grid gap-aire [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]",
        className,
      )}
    />
  );
}
