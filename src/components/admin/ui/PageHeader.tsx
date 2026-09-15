import { cn } from "@/lib/cn";

type Props = {
  titulo: string;
  /** La coletilla editorial en cursiva naranja («el censo de la calle»). */
  coletilla?: string;
  /** Línea pequeña bajo el título (la instancia de Zak, qué es esta pantalla). */
  subtitulo?: React.ReactNode;
  /** Dónde está parado el usuario, ej. ["Zak", "Bandeja"]. Sin links: para
   *  navegar ya está el Sidebar, esto solo dice dónde se está. */
  migas?: string[];
  /** Cifras a la derecha («75 negocios · 40 sin web»). */
  contador?: React.ReactNode;
  /** El nivel de navegación de la pantalla: <Caras>, <Tabs> o la semana. */
  navegacion?: React.ReactNode;
  acciones?: React.ReactNode;
};

/**
 * Cabecera de página dentro de la isla principal. Una sola fila que aprovecha
 * el ancho: título a la izquierda, navegación en medio, cifras y acciones a
 * la derecha. Antes cada pantalla copiaba este markup a mano y la navegación
 * ocupaba una fila entera debajo.
 */
export function PageHeader({
  titulo,
  coletilla,
  subtitulo,
  migas,
  contador,
  navegacion,
  acciones,
}: Props) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline px-5 py-3">
      <div className="min-w-0">
        {migas && migas.length > 0 && (
          <p className="truncate text-xs text-tinta-40">{migas.join(" / ")}</p>
        )}
        <h1 className="text-lg font-semibold text-tinta">
          {titulo}
          {coletilla && (
            <>
              {" "}
              <span className="font-editorial text-base font-normal italic text-acento">
                {coletilla}
              </span>
            </>
          )}
        </h1>
        {subtitulo && <p className="text-xs text-tinta-60">{subtitulo}</p>}
      </div>

      {navegacion && <div className="min-[900px]:ml-auto">{navegacion}</div>}

      {(contador || acciones) && (
        <div className={cn("flex items-center gap-3", !navegacion && "ml-auto")}>
          {contador && <span className="text-xs text-tinta-40">{contador}</span>}
          {acciones && <div className="flex items-center gap-2">{acciones}</div>}
        </div>
      )}
    </header>
  );
}
