import Link from "next/link";
import { cn } from "@/lib/cn";

type Props = {
  pagina: number;
  totalPaginas: number;
  /** Arma el href de una página dada — cada pantalla decide su propio querystring. */
  hrefDePagina: (pagina: number) => string;
};

const ESTILO_BASE =
  "inline-flex h-control items-center justify-center rounded-full px-4 text-sm font-medium transition-colors";

/**
 * Paginador simple: Anterior / Página X de Y / Siguiente. Links reales
 * (navegación de servidor) — no hay nada que paginar en el cliente cuando
 * la lista vive en la base de datos. No se pinta con una sola página.
 */
export function Paginador({ pagina, totalPaginas, hrefDePagina }: Props) {
  if (totalPaginas <= 1) return null;

  return (
    <nav className="flex items-center justify-center gap-3 py-2" aria-label="Paginación">
      {pagina > 1 ? (
        <Link
          href={hrefDePagina(pagina - 1)}
          className={cn(ESTILO_BASE, "bg-isla-alta text-tinta-85 hover:bg-acento-10 hover:text-tinta")}
        >
          Anterior
        </Link>
      ) : (
        <span className={cn(ESTILO_BASE, "text-tinta-40")} aria-disabled="true">
          Anterior
        </span>
      )}

      <span className="text-xs text-tinta-40">
        Página {pagina} de {totalPaginas}
      </span>

      {pagina < totalPaginas ? (
        <Link
          href={hrefDePagina(pagina + 1)}
          className={cn(ESTILO_BASE, "bg-isla-alta text-tinta-85 hover:bg-acento-10 hover:text-tinta")}
        >
          Siguiente
        </Link>
      ) : (
        <span className={cn(ESTILO_BASE, "text-tinta-40")} aria-disabled="true">
          Siguiente
        </span>
      )}
    </nav>
  );
}
