"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { editarBot, eliminarBot } from "@/lib/admin/bots-actions";
import type { Instancia } from "@/lib/bots/tipos";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import { Field, Input, TextArea } from "@/components/admin/ui/Field";
import { Island } from "@/components/admin/ui/Island";

/**
 * Ajustes del bot: identidad, textos y credenciales del proveedor. Las
 * credenciales llegan REDACTADAS del API (•••XXXX): los inputs empiezan
 * vacíos con la redacción de placeholder y solo se envía lo que se escriba.
 * Abajo, la zona peligrosa: eliminar el bot completo.
 */
export function AjustesBot({ instancia }: { instancia: Instancia }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { confirmar, dialogo } = useConfirmar();

  const [nombre, setNombre] = useState(instancia.nombre);
  const [notificarA, setNotificarA] = useState(instancia.escalation_notify_to ?? "");
  const [acuse, setAcuse] = useState(instancia.acuse_escalado);
  const [fallback, setFallback] = useState(instancia.fallback_reply);
  const [credenciales, setCredenciales] = useState<Record<string, string>>({});

  const esGreen = instancia.proveedor === "green";
  const camposCred: readonly { campo: string; label: string; actual: string | null }[] = esGreen
    ? [
        { campo: "green_api_url", label: "Green API — URL", actual: instancia.green_api_url },
        { campo: "green_instance_id", label: "Green API — Instance ID", actual: instancia.green_instance_id },
        { campo: "green_api_token", label: "Green API — Token", actual: instancia.green_api_token },
        { campo: "green_webhook_token", label: "Green API — Token del webhook", actual: instancia.green_webhook_token },
      ]
    : [
        { campo: "meta_phone_number_id", label: "Meta — Phone Number ID", actual: instancia.meta_phone_number_id },
        { campo: "meta_waba_id", label: "Meta — WABA ID", actual: instancia.meta_waba_id },
        { campo: "meta_access_token", label: "Meta — Access token", actual: instancia.meta_access_token },
      ];

  function guardar() {
    setMensaje(null);
    setError(null);
    startTransition(async () => {
      try {
        // Solo viaja lo que cambió; las credenciales vacías NO se mandan
        // (mandar la redacción ••• rompería el proveedor).
        const escritas = Object.fromEntries(
          Object.entries(credenciales).filter(([, v]) => v.trim() !== ""),
        );
        const r = await editarBot(instancia.id, {
          nombre,
          escalation_notify_to: notificarA,
          acuse_escalado: acuse,
          fallback_reply: fallback,
          ...escritas,
        });
        if (r.error) {
          setError(r.error);
          return;
        }
        setCredenciales({});
        setMensaje("Ajustes guardados.");
        router.refresh();
      } catch {
        setError("Se perdió la conexión — revisa si el guardado llegó antes de reintentar.");
      }
    });
  }

  async function eliminar() {
    const ok = await confirmar({
      titulo: `¿Eliminar "${instancia.nombre}"?`,
      mensaje:
        "Se borra el bot COMPLETO: conversaciones, leads, tandas, prompts y su historial. No hay vuelta atrás.",
      accion: "Eliminar bot",
      peligro: true,
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      try {
        const r = await eliminarBot(instancia.id);
        if (r.error) {
          setError(r.error);
          return;
        }
        router.push("/admin/bots");
      } catch {
        setError("Se perdió la conexión — recarga y mira si el bot sigue en la lista.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {dialogo}
      <Island titulo="Identidad y textos" className="flex flex-col gap-3 bg-isla-alta/50">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Nombre *">
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} />
          </Field>
          <Field label="Avisar escalados a (WhatsApp)">
            <Input
              type="tel"
              value={notificarA}
              onChange={(e) => setNotificarA(e.target.value)}
              placeholder="573001234567"
            />
          </Field>
        </div>
        <Field label="Acuse cuando escala a humano">
          <TextArea value={acuse} onChange={(e) => setAcuse(e.target.value)} rows={2} />
        </Field>
        <Field label="Respuesta de respaldo (si el agente falla)">
          <TextArea value={fallback} onChange={(e) => setFallback(e.target.value)} rows={2} />
        </Field>
      </Island>

      <Island
        titulo={`Credenciales (${esGreen ? "Green API" : "Meta Cloud API"})`}
        acciones={
          <span className="text-xs text-tinta-40">
            se muestran redactadas; escribe solo lo que quieras reemplazar
          </span>
        }
        className="flex flex-col gap-3 bg-isla-alta/50"
      >
        <div className="grid gap-3 md:grid-cols-2">
          {camposCred.map(({ campo, label, actual }) => (
            <Field key={campo} label={label}>
              <Input
                value={credenciales[campo] ?? ""}
                onChange={(e) =>
                  setCredenciales((c) => ({ ...c, [campo]: e.target.value }))
                }
                placeholder={actual ?? "sin configurar"}
              />
            </Field>
          ))}
        </div>
      </Island>

      {error && <Banner variante="error">{error}</Banner>}
      {mensaje && <Banner>{mensaje}</Banner>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variante="primaria" onClick={guardar} disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar ajustes"}
        </Button>
        <Button variante="peligro" disabled={pendiente} onClick={() => void eliminar()}>
          <Trash2 className="h-4 w-4" /> Eliminar bot
        </Button>
      </div>
    </div>
  );
}
