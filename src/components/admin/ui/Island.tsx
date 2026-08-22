import { cn } from "@/lib/cn";

type Props = React.ComponentProps<"section"> & {
  titulo?: React.ReactNode;
  acciones?: React.ReactNode;
};

/** La card-región del panel: superficie isla, radio isla. Base de toda página. */
export function Island({ titulo, acciones, className, children, ...props }: Props) {
  return (
    <section {...props} className={cn("rounded-isla bg-isla p-4", className)}>
      {(titulo != null || acciones != null) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {titulo != null ? (
            <h2 className="text-sm font-semibold text-tinta-85">{titulo}</h2>
          ) : (
            <span />
          )}
          {acciones}
        </header>
      )}
      {children}
    </section>
  );
}
