"use client";

import { useState, useTransition } from "react";
import { lanzarTandaVoz } from "@/lib/admin/voz-actions";
import type { AgenteVozFila } from "@/lib/admin/voz";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import { TextArea } from "@/components/admin/ui/Field";
import { Island } from "@/components/admin/ui/Island";

/** Tanda saliente: pegar teléfonos y lanzar. El cap diario corta el exceso. */
export function TandaVoz({
  agente,
  llamadasHoy,
  telefoniaLista,
}: {
  agente: AgenteVozFila;
  llamadasHoy: number;
  telefoniaLista: boolean;
}) {
  const [pendiente, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [telefonos, setTelefonos] = useState("");
  const { confirmar, dialogo } = useConfirmar();

  async function lanzar() {
    const n = telefonos.split(/[\n,]/).filter((t) => t.trim()).length;
    const ok = await confirmar({
      titulo: "¿Lanzar la tanda ahora?",
      mensaje: `${n} ${n === 1 ? "teléfono" : "teléfonos"}; se llama de a uno y el cap corta lo que no quepa hoy.`,
      accion: "Lanzar",
    });
    if (!ok) return;
    setMensaje(null);
    setError(null);
    startTransition(async () => {
      try {
        const r = await lanzarTandaVoz(agente.id, telefonos);
        if ("error" in r) {
          setError(r.error);
          return;
        }
        setTelefonos("");
        setMensaje(
          `Tanda enviada: ${r.enviadas} llamadas.` +
            (r.invalidos.length > 0
              ? ` Ignorados por formato: ${r.invalidos.join(", ")}.`
              : ""),
        );
      } catch {
        setError("Se perdió la conexión — revisa Llamadas antes de reintentar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {dialogo}
      {!telefoniaLista && (
        <Banner>
          Sin número saliente: falta ELEVENLABS_PHONE_NUMBER_ID (es el interruptor del
          piloto — paso 7 del runbook). El widget funciona igual.
        </Banner>
      )}
      <Island titulo="Tanda saliente" className="flex flex-col gap-3 bg-isla-alta/50">
        <p className="text-xs text-tinta-60">
          Un teléfono por línea (o separados por coma). Se llama de a uno; hoy van{" "}
          {llamadasHoy}/{agente.cap_diario}.
        </p>
        <TextArea
          rows={5}
          value={telefonos}
          onChange={(e) => setTelefonos(e.target.value)}
          placeholder={"+573001234567\n+573007654321"}
        />
        <Button
          variante="primaria"
          className="self-start"
          disabled={pendiente || !telefoniaLista}
          onClick={() => void lanzar()}
        >
          {pendiente ? "Lanzando…" : "Lanzar tanda"}
        </Button>
        {error && <Banner variante="error">{error}</Banner>}
        {mensaje && <Banner>{mensaje}</Banner>}
      </Island>
    </div>
  );
}
