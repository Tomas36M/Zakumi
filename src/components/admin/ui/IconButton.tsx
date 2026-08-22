import { cn } from "@/lib/cn";

type Props = React.ComponentProps<"button"> & {
  /** Nombre accesible: va a aria-label y title. */
  etiqueta: string;
};

export function IconButton({ etiqueta, className, type, ...props }: Props) {
  return (
    <button
      type={type ?? "button"}
      aria-label={etiqueta}
      title={etiqueta}
      {...props}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-tinta-60 transition-colors hover:bg-isla-alta hover:text-tinta disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    />
  );
}
