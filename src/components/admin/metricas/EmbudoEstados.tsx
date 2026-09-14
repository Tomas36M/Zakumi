import { ESTADOS, type EstadoNegocio } from "@/lib/admin/negocios";

type Props = {
  conteos: Record<EstadoNegocio, number>;
};

/** Cuántos negocios hay en cada paso del pipeline — reemplaza el viejo
 *  contador suelto de "interesados" del header de Zak. */
export function EmbudoEstados({ conteos }: Props) {
  return (
    <div className="grid grid-cols-2 gap-aire min-[720px]:grid-cols-3 min-[1100px]:grid-cols-6">
      {ESTADOS.map((e) => (
        <div key={e.valor} className="rounded-fila bg-isla-alta px-4 py-3">
          <span className="block text-2xl font-semibold text-tinta">{conteos[e.valor]}</span>
          <span className="text-xs text-tinta-60">{e.label}</span>
        </div>
      ))}
    </div>
  );
}
