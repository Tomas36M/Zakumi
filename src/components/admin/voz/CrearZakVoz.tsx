"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearAgenteZakVoz } from "@/lib/admin/voz-actions";
import type { VozEleven } from "@/lib/voz/api";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Field } from "@/components/admin/ui/Field";
import { Island } from "@/components/admin/ui/Island";
import { SelectorVoz } from "./VozView";

/**
 * Le da voz a Zak. Vive en la cara de Voz de /admin/zak — antes estaba en
 * /admin/voz, que ahora es solo para los agentes que se le venden a clientes.
 */
export function CrearZakVoz({ voces }: { voces: VozEleven[] }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState("");

  return (
    <Island
      titulo="Zak todavía no tiene voz"
      className="flex max-w-2xl flex-col gap-3 bg-acento-10"
    >
      <p className="text-xs text-tinta-60">
        Se crea con su prompt completo (quién es, catálogo con precios, guion de
        llamada, horarios y límites) y la extracción de leads. Solo falta
        elegirle la voz — en español, que es el idioma de las llamadas.
      </p>
      <Field label="Voz de Zak *">
        <SelectorVoz voces={voces} valor={voiceId} onCambio={setVoiceId} />
      </Field>
      {error && <Banner variante="error">{error}</Banner>}
      <Button
        variante="primaria"
        className="self-start"
        disabled={pendiente || !voiceId}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const r = await crearAgenteZakVoz(voiceId);
              if ("error" in r) {
                setError(r.error);
                return;
              }
              if (r.aviso) {
                // Fallo parcial (ElevenLabs caído, o es_zak sin marcar): se
                // muestra tal cual y NO se navega como si fuera éxito total.
                setError(r.aviso);
                router.refresh();
                return;
              }
              // Zak vive aquí mismo: basta con recargar para que aparezca su
              // ficha de voz en esta pestaña.
              router.refresh();
            } catch {
              setError("Se perdió la conexión — recarga antes de reintentar (pudo crearse).");
            }
          });
        }}
      >
        {pendiente ? "Creando a Zak…" : "Crear a Zak"}
      </Button>
    </Island>
  );
}
