"use client";

import { useState, useTransition } from "react";
import { Phone } from "lucide-react";
import { llamarConZak } from "@/lib/admin/voz-actions";
import { Button } from "@/components/admin/ui/Button";

/** Qué tan lista está la voz de Zak — lo calcula el server (zak/page.tsx). */
export type EstadoVozZak = "lista" | "sin_numero" | "apagada" | "sin_sincronizar" | "sin_agente";

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
}: {
  vozZak: EstadoVozZak;
  /** E.164 (+57…) — la ficha del CRM ya lo trae así. */
  telefono: string;
  nombre?: string | null;
  negocioId?: string | null;
  /** true mientras el caller resuelve la ficha del CRM: no despachar aún. */
  cargando?: boolean;
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

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        disabled={pendiente || llamando || cargando || vozZak !== "lista"}
        title={
          vozZak !== "lista"
            ? MOTIVO[vozZak]
            : cargando
              ? "Cargando la ficha del CRM…"
              : undefined
        }
        onClick={llamar}
      >
        <Phone className="h-4 w-4" />
        {llamando ? "Zak está llamando 📞" : pendiente ? "Marcando…" : "Llamar con IA"}
      </Button>
      {error && <span className="text-xs text-peligro">{error}</span>}
    </span>
  );
}
