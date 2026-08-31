import { cn } from "@/lib/cn";

/**
 * El shell estándar de una pantalla del panel: la PÁGINA nunca scrollea, el
 * contenido scrollea por dentro.
 *
 *   <Cockpit>
 *     <PageHeader … />           ← alto natural
 *     <CockpitBody>…</CockpitBody>  ← se come el resto y scrollea
 *   </Cockpit>
 *
 * Sin números mágicos: `h-full` + `flex-1 min-h-0` dejan que cabeceras,
 * pestañas o banners de error cambien de alto sin empujar la página (el bug
 * clásico de `h-[calc(100dvh-Xrem)]`, que se rompe al aparecer un aviso).
 * Bajo 900px vuelve el flujo normal: en móvil el scroll de página es lo
 * natural y el teclado virtual pelea con las alturas fijas.
 */
export function Cockpit({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      {...props}
      className={cn(
        "flex flex-col",
        // El único número es el padding del propio shell (layout.tsx: p-aire
        // arriba y abajo). Todo lo demás lo reparte flex.
        "min-[900px]:h-[calc(100dvh-2*var(--spacing-aire))] min-[900px]:min-h-0",
        className,
      )}
    />
  );
}

/** La zona scrolleable del cockpit. Va DENTRO de <Cockpit>. */
export function CockpitBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "barra-fina flex flex-col gap-4 px-5 py-4",
        "min-[900px]:min-h-0 min-[900px]:flex-1 min-[900px]:overflow-y-auto",
        className,
      )}
    />
  );
}
