"use client";

import { useRouter } from "next/navigation";
import { esTerminal, type Solicitud } from "@/lib/portal/solicitudes";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { GridCards } from "@/components/admin/ui/GridCards";
import { useParametroUrl } from "@/components/admin/ui/useParametroUrl";
import { SolicitudModal } from "./SolicitudModal";
import { TarjetaSolicitud } from "./TarjetaSolicitud";
import type { PerfilResumen } from "./solicitud-ui";

export type { PerfilResumen } from "./solicitud-ui";

type Props = {
  solicitudes: Solicitud[];
  perfiles: Record<string, PerfilResumen>;
  /** A qué número avisar un cambio de cita, por solicitud (E.164 o null). */
  telefonosAviso: Record<string, string | null>;
};

/** La bandeja: las abiertas en un grid, las cerradas recientes debajo, y
 * una sola ficha (modal, `?solicitud=<id>`) para trabajar cada una. */
export function BandejaSolicitudes({ solicitudes, perfiles, telefonosAviso }: Props) {
  const router = useRouter();
  const [solicitudId, abrir] = useParametroUrl("solicitud");
  const abiertas = solicitudes.filter((s) => !esTerminal(s.estado));
  const cerradas = solicitudes.filter((s) => esTerminal(s.estado)).slice(0, 20);
  const abierta = solicitudId ? (solicitudes.find((s) => s.id === solicitudId) ?? null) : null;

  const perfilDe = (s: Solicitud) => (s.user_id ? perfiles[s.user_id] : undefined);

  return (
    <>
      {solicitudes.length === 0 ? (
        <EmptyState
          titulo="Nada por ahora."
          detalle="Cuando alguien pida un servicio —en la tienda, por llamada o por WhatsApp— aparece aquí y te llega el aviso."
        />
      ) : (
        <>
          {abiertas.length === 0 ? (
            <p className="text-sm text-tinta-40">Sin solicitudes por atender.</p>
          ) : (
            <GridCards>
              {abiertas.map((s) => (
                <TarjetaSolicitud
                  key={s.id}
                  solicitud={s}
                  perfil={perfilDe(s)}
                  activa={s.id === solicitudId}
                  onAbrir={abrir}
                />
              ))}
            </GridCards>
          )}

          {cerradas.length > 0 && (
            <>
              <h2 className="mt-4 text-xs font-semibold tracking-wide text-tinta-60 uppercase">
                Cerradas recientes
              </h2>
              <GridCards>
                {cerradas.map((s) => (
                  <TarjetaSolicitud
                    key={s.id}
                    solicitud={s}
                    perfil={perfilDe(s)}
                    activa={s.id === solicitudId}
                    onAbrir={abrir}
                  />
                ))}
              </GridCards>
            </>
          )}
        </>
      )}

      <SolicitudModal
        solicitudId={solicitudId}
        solicitud={abierta}
        perfil={abierta ? perfilDe(abierta) : undefined}
        telefonoAviso={abierta ? (telefonosAviso[abierta.id] ?? null) : null}
        onCerrar={() => abrir(null)}
        onCambio={() => router.refresh()}
      />
    </>
  );
}
