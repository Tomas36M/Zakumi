"use client";

import { useState, useTransition } from "react";
import {
  activarSolicitud,
  cotizarSolicitud,
  marcarLinkEnviado,
  rechazarSolicitud,
} from "@/lib/admin/solicitudes-actions";
import { servicioDelSlug } from "@/lib/catalogo";
import type { Solicitud } from "@/lib/portal/solicitudes";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import { BotonRechazar } from "./BotonRechazar";
import { FormCotizar } from "./FormCotizar";
import { FormLink } from "./FormLink";

type Props = {
  solicitud: Solicitud;
  onCambio: () => void;
};

/** Lo que toca hacer según el estado: cotizar, publicar el link, confirmar
 * el pago y activar, o rechazar. El ciclo de venta v1, tal cual. */
export function AccionesEstado({ solicitud: s, onCambio }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, startTransition] = useTransition();
  const { confirmar, dialogo } = useConfirmar();
  const servicio = servicioDelSlug(s.servicio_slug);

  function correr(accion: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const r = await accion();
      if (r.error) {
        setError(r.error);
        return;
      }
      onCambio();
    });
  }

  const rechazar = (motivo: string) => correr(() => rechazarSolicitud(s.id, motivo));

  return (
    <div className="flex flex-col gap-3 border-t border-hairline pt-4">
      {dialogo}
      {error && <Banner variante="error">{error}</Banner>}

      {s.estado === "nueva" && (
        <FormCotizar
          ocupado={ocupado}
          sugerida={servicio?.tarifaSugerida ?? 0}
          cicloSugerido={servicio?.cicloSugerido ?? "mensual"}
          onCotizar={(monto, ciclo, nota) => correr(() => cotizarSolicitud(s.id, { monto, ciclo, nota }))}
          onRechazar={rechazar}
        />
      )}

      {s.estado === "cotizada" && (
        <FormLink
          ocupado={ocupado}
          onEnviar={(link) => correr(() => marcarLinkEnviado(s.id, link))}
          onRechazar={rechazar}
        />
      )}

      {(s.estado === "link_enviado" || s.estado === "pagada") && (
        <div className="flex flex-wrap items-center gap-2">
          {s.user_id === null ? (
            // activarSolicitud busca el perfil por user_id: en una solicitud
            // de voz o WhatsApp no hay cuenta que buscar, así que el botón
            // fallaría siempre. Crear el cliente y darle acceso al portal es
            // un paso aparte que hoy no hace esta pantalla.
            <p className="text-xs text-tinta-60">
              Para activar, primero crea el cliente y dale acceso al portal — esta solicitud no
              tiene cuenta que vincular.
            </p>
          ) : (
            <Button
              variante="primaria"
              disabled={ocupado}
              onClick={async () => {
                const ok = await confirmar({
                  titulo: "¿Confirmas que el pago llegó?",
                  mensaje:
                    "Esto crea el cliente y su producto, registra el primer pago y activa el servicio.",
                  accion: "Confirmar y activar",
                });
                if (ok) correr(() => activarSolicitud(s.id));
              }}
            >
              {ocupado ? "Activando…" : "Confirmar pago y activar"}
            </Button>
          )}
          <BotonRechazar ocupado={ocupado} onRechazar={rechazar} />
        </div>
      )}
    </div>
  );
}
