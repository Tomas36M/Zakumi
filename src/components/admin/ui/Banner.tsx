import { cn } from "@/lib/cn";

type Props = {
  variante?: "aviso" | "error";
  className?: string;
  children: React.ReactNode;
};

/** Estados degradados ("sin conexión con el bot desde las 10:30") y errores. */
export function Banner({ variante = "aviso", className, children }: Props) {
  return (
    <div
      role={variante === "error" ? "alert" : "status"}
      className={cn(
        "rounded-fila border px-4 py-2.5 text-sm",
        variante === "aviso" && "border-hairline bg-isla-alta text-tinta-60",
        variante === "error" && "border-peligro/30 bg-peligro/10 text-peligro",
        className,
      )}
    >
      {children}
    </div>
  );
}
