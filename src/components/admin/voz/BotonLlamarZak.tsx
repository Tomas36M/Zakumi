"use client";

import { useState, useTransition } from "react";
import { Phone } from "lucide-react";
import { llamarConZak } from "@/lib/admin/voz-actions";
import type { EstadoVozZak } from "@/lib/admin/voz-estado";
import { Button } from "@/components/admin/ui/Button";
import { IconButton } from "@/components/admin/ui/IconButton";

/** Qué tan lista está la voz de Zak — lo calcula el server con `estadoVozZak`.
 * Re-exportado para que los consumidores viejos sigan importándolo de aquí. */
export type { EstadoVozZak };

const MOTIVO: Record<Exclude<EstadoVozZak, "lista">, string> = {
  sin_agente: "Zak no tiene voz todavía — créala en /admin/voz",
  sin_sincronizar: "La voz de Zak está sin sincronizar — usa Sincronizar en su ficha (/admin/voz)",
  apagada: "La voz de Zak está apagada — enciéndela en su ficha (/admin/voz)",
  sin_numero: "Falta el número saliente (ELEVENLABS_PHONE_NUMBER_ID, paso 7 del runbook)",
};

/**
 * "Llamar con IA": Zak marca al prospecto con su agente de voz. Vive en la
 * bandeja del cockpit y en Interesados; el resultado (transcript, datos)
 * aterriza en /admin/voz vía el webhook post-call.
 */
export function BotonLlamarZak({
  vozZak,
  telefono,
  nombre,
  negocioId,
  cargando = false,
  compacto = false,
}: {
  vozZak: EstadoVozZak;
  /** E.164 (+57…) — la ficha del CRM ya lo trae así. */
  telefono: string;
  nombre?: string | null;
  negocioId?: string | null;
  /** true mientras el caller resuelve la ficha del CRM: no despachar aún. */
  cargando?: boolean;
  /** true = solo el ícono (con tooltip), para headers angostos como el del
   *  chat de Zak. Sin este prop, botón con texto (comportamiento de hoy). */
  compacto?: boolean;
}) {
  const [pendiente, startTransition] = useTransition();
  const [llamando, setLlamando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function llamar() {
    setError(null);
    startTransition(async () => {
      try {
        const r = await llamarConZak({
          telefono,
          nombreContacto: nombre ?? undefined,
          negocioId: negocioId ?? undefined,
        });
        if ("error" in r) {
          setError(r.error);
          return;
        }
        setLlamando(true);
      } catch {
        setError("Se perdió la conexión — revisa Llamadas en /admin/voz antes de reintentar.");
      }
    });
  }

  const texto = llamando ? "Zak está llamando 📞" : pendiente ? "Marcando…" : "Llamar con IA";
  const deshabilitado = pendiente || llamando || cargando || vozZak !== "lista";
  const motivo = vozZak !== "lista" ? MOTIVO[vozZak] : cargando ? "Cargando la ficha del CRM…" : undefined;

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {compacto ? (
        <IconButton etiqueta={motivo ?? texto} disabled={deshabilitado} onClick={llamar}>
          <Phone className="h-4 w-4" />
        </IconButton>
      ) : (
        <Button disabled={deshabilitado} title={motivo} onClick={llamar}>
          <Phone className="h-4 w-4" />
          {texto}
        </Button>
      )}
      {error && <span className="text-xs text-peligro">{error}</span>}
    </span>
  );
}
