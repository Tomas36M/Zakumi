"use client";

import { CalendarDays } from "lucide-react";
import { fechaCorta } from "@/lib/admin/formato";
import { formatearCOP } from "@/lib/admin/cartera";
import { servicioDelSlug } from "@/lib/catalogo";
import { fechaLegible } from "@/lib/solicitudes/mensaje";
import { labelEstado, type Solicitud } from "@/lib/portal/solicitudes";
import { Badge } from "@/components/admin/ui/Badge";
import { Card } from "@/components/admin/ui/Card";
import { CANAL_SOLICITUD, quienPide, TONO_SOLICITUD, type PerfilResumen } from "./solicitud-ui";

type Props = {
  solicitud: Solicitud;
  perfil: PerfilResumen | undefined;
  activa: boolean;
  onAbrir: (id: string) => void;
};

/** Una solicitud en el grid: qué piden, quién, por dónde, en qué va. */
export function TarjetaSolicitud({ solicitud: s, perfil, activa, onAbrir }: Props) {
  const servicio = servicioDelSlug(s.servicio_slug);
  return (
    <Card activa={activa} onClick={() => onAbrir(s.id)} aria-label={`Abrir solicitud de ${quienPide(s, perfil)}`}>
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-base font-semibold text-tinta">
            {servicio?.nombre ?? s.servicio_slug}
          </span>
          <span className="block truncate text-xs text-tinta-40">{quienPide(s, perfil)}</span>
        </span>
        <span className="text-xs whitespace-nowrap text-tinta-40">{fechaCorta(s.created_at)}</span>
      </span>

      <span className="flex flex-wrap items-center gap-1.5">
        {s.origen !== "portal" && (
          <Badge tono={CANAL_SOLICITUD[s.origen].tono}>{CANAL_SOLICITUD[s.origen].label}</Badge>
        )}
        <Badge tono={TONO_SOLICITUD[s.estado]}>{labelEstado(s.estado)}</Badge>
        {s.cotizacion_monto !== null && (
          <span className="text-xs text-tinta-60">{formatearCOP(Number(s.cotizacion_monto))}</span>
        )}
      </span>

      {s.mensaje && <span className="line-clamp-2 text-sm text-tinta-85 italic">“{s.mensaje}”</span>}

      {s.cita_inicio ? (
        <span className="flex items-center gap-1.5 text-xs text-tinta-60">
          <CalendarDays className="h-3.5 w-3.5 text-acento" />
          {fechaLegible(s.cita_inicio)}
        </span>
      ) : s.cita_texto_crudo ? (
        <span className="flex items-center gap-1.5 text-xs text-tinta-60">
          <CalendarDays className="h-3.5 w-3.5 text-tinta-40" />
          Quiere agendar: «{s.cita_texto_crudo}» — sin hora
        </span>
      ) : null}
    </Card>
  );
}
