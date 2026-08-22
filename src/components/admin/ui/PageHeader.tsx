type Props = {
  titulo: string;
  acciones?: React.ReactNode;
};

/** Cabecera de página dentro de la isla principal. */
export function PageHeader({ titulo, acciones }: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
      <h1 className="text-lg font-semibold text-tinta">{titulo}</h1>
      {acciones && <div className="flex items-center gap-2">{acciones}</div>}
    </header>
  );
}
