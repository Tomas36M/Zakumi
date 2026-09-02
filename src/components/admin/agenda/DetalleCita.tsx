import Link from "next/link";
import { ExternalLink, Video } from "lucide-react";
import { fechaLegible } from "@/lib/solicitudes/mensaje";
import type { Cita360 } from "@/lib/agenda/consultas";
import { Island } from "@/components/admin/ui/Island";

// Mismas clases que Button.tsx genera para "primaria"/"fantasma": un <a> de
// verdad (target="_blank") no puede ser el <button> del kit, así que se
// calca su pinta — patrón ya usado en FichaNegocio.tsx ("Chat con Zak").
const BASE_BOTON =
  "inline-flex h-control items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors";
const BOTON_PRIMARIA = `${BASE_BOTON} bg-acento text-white hover:bg-acento-85`;
const BOTON_FANTASMA = `${BASE_BOTON} bg-isla-alta text-tinta-85 hover:bg-acento-10 hover:text-tinta`;

export function DetalleCita({ cita }: { cita: Cita360 }) {
  return (
    <Island titulo={cita.nombre ?? "Sin nombre"} className="flex flex-col gap-4">
      <p className="text-sm text-tinta-60">{fechaLegible(cita.inicio)}</p>

      <dl className="grid gap-3 sm:grid-cols-2">
        {cita.telefono && (
          <div>
            <dt className="text-xs text-tinta-40">Teléfono</dt>
            <dd className="text-sm text-tinta">{cita.telefono}</dd>
          </div>
        )}
        {cita.servicio && (
          <div>
            <dt className="text-xs text-tinta-40">Servicio</dt>
            <dd className="text-sm text-tinta">{cita.servicio}</dd>
          </div>
        )}
      </dl>

      {cita.detalle && (
        <p className="rounded-fila bg-isla-alta/40 p-3 text-sm text-tinta-85 italic">
          “{cita.detalle}”
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {cita.meetUrl ? (
          <a href={cita.meetUrl} target="_blank" rel="noreferrer" className={BOTON_PRIMARIA}>
            <Video className="h-4 w-4" /> Abrir Meet
          </a>
        ) : (
          <p className="text-sm text-tinta-60">Sin link de Meet — revisa el evento en Google</p>
        )}
        {cita.linkGoogle && (
          <a href={cita.linkGoogle} target="_blank" rel="noreferrer" className={BOTON_FANTASMA}>
            <ExternalLink className="h-4 w-4" /> Ver en Google
          </a>
        )}
        <Link href="/admin/solicitudes" className={BOTON_FANTASMA}>
          Ver solicitud
        </Link>
      </div>
    </Island>
  );
}
