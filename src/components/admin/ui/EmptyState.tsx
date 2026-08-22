type Props = {
  titulo: string;
  detalle?: string;
  accion?: React.ReactNode;
};

/** Estado vacío centrado, dos niveles de texto (patrón Scribe). */
export function EmptyState({ titulo, detalle, accion }: Props) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-1 text-center select-none">
      <p className="text-base font-medium text-tinta-85">{titulo}</p>
      {detalle && <p className="max-w-sm text-sm text-tinta-60">{detalle}</p>}
      {accion && <div className="mt-3">{accion}</div>}
    </div>
  );
}
