import Link from "next/link";
import { cn } from "@/lib/cn";

type Props = {
  pagina: number;
  totalPaginas: number;
} & (
  | {
      /** Links reales: la pantalla vuelve al servidor por cada página (Territorios). */
      hrefDePagina: (pagina: number) => string;
      onPagina?: never;
    }
  | {
      /** Botones: quien pagina pide la página por su cuenta, sin re-renderizar
       * la page (la lista de Leads, que vive junto al mapa). */
      onPagina: (pagina: number) => void;
      hrefDePagina?: never;
    }
);

const ESTILO_BASE =
  "inline-flex h-control items-center justify-center rounded-full px-4 text-sm font-medium transition-colors";
const ESTILO_ACTIVO = "bg-isla-alta text-tinta-85 hover:bg-acento-10 hover:text-tinta";

/**
 * Paginador simple: Anterior / Página X de Y / Siguiente. Con `hrefDePagina`
 * son links de verdad; con `onPagina`, botones. No se pinta con una sola
 * página.
 */
export function Paginador({ pagina, totalPaginas, hrefDePagina, onPagina }: Props) {
  if (totalPaginas <= 1) return null;

  function paso(destino: number, habilitado: boolean, texto: string) {
    if (!habilitado) {
      return (
        <span className={cn(ESTILO_BASE, "text-tinta-40")} aria-disabled="true">
          {texto}
        </span>
      );
    }
    if (hrefDePagina) {
      return (
        <Link href={hrefDePagina(destino)} className={cn(ESTILO_BASE, ESTILO_ACTIVO)}>
          {texto}
        </Link>
      );
    }
    return (
      <button type="button" onClick={() => onPagina?.(destino)} className={cn(ESTILO_BASE, ESTILO_ACTIVO)}>
        {texto}
      </button>
    );
  }

  return (
    <nav className="flex items-center justify-center gap-3 py-2" aria-label="Paginación">
      {paso(pagina - 1, pagina > 1, "Anterior")}
      <span className="text-xs text-tinta-40">
        Página {pagina} de {totalPaginas}
      </span>
      {paso(pagina + 1, pagina < totalPaginas, "Siguiente")}
    </nav>
  );
}
