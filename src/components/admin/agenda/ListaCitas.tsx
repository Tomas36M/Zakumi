import { horaDeIso } from "@/lib/admin/formato";
import type { Cita360, GrupoAgenda } from "@/lib/agenda/consultas";
import type { OrigenSolicitud } from "@/lib/portal/solicitudes";
import { Badge, type TonoBadge } from "@/components/admin/ui/Badge";
import { ListRow } from "@/components/admin/ui/ListRow";
import { cn } from "@/lib/cn";

// Mismo criterio de color que el resto del panel: voz/whatsapp comparten la
// paleta del pipeline de negocios (TONO_DIRECCION en LlamadasVoz.tsx).
const TONO_ORIGEN: Record<OrigenSolicitud, TonoBadge> = {
  voz: "contactado",
  whatsapp: "respondido",
  portal: "neutro",
};

const LABEL_ORIGEN: Record<OrigenSolicitud, string> = {
  voz: "Voz",
  whatsapp: "WhatsApp",
  portal: "Portal",
};

type Props = {
  grupos: GrupoAgenda[];
  seleccionadaId: string | null;
  onElegir: (cita: Cita360) => void;
};

export function ListaCitas({ grupos, seleccionadaId, onElegir }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {grupos.map((grupo) => (
        <div key={grupo.titulo} className="flex flex-col gap-1">
          <h2 className="px-3 text-xs font-semibold tracking-wide text-tinta-60 uppercase">
            {grupo.titulo}
          </h2>
          {grupo.citas.map((cita) => {
            const activa = cita.id === seleccionadaId;
            return (
              <ListRow
                key={cita.id}
                activa={activa}
                onClick={() => onElegir(cita)}
                className={cn("flex items-center gap-3", activa && "text-acento")}
              >
                <span className="w-11 shrink-0 text-xs tabular-nums text-tinta-40">
                  {horaDeIso(cita.inicio) ?? "—"}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {cita.nombre ?? "Sin nombre"}
                </span>
                <Badge tono={TONO_ORIGEN[cita.origen]}>{LABEL_ORIGEN[cita.origen]}</Badge>
              </ListRow>
            );
          })}
        </div>
      ))}
    </div>
  );
}
