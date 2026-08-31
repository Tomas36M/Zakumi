"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import { duplicarBot, editarBot } from "@/lib/admin/bots-actions";
import type {
  Instancia,
  PromptActivo,
  StatusInstancia,
  VersionPrompt,
} from "@/lib/bots/tipos";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Tabs } from "@/components/admin/ui/Tabs";
import { Actividad } from "./Actividad";
import { AjustesBot } from "./AjustesBot";
import { Conversaciones } from "./Conversaciones";
import { LabsChat } from "./LabsChat";
import { PromptEditor } from "./PromptEditor";

export type Pestana = "prompt" | "labs" | "conversaciones" | "actividad" | "ajustes";

const PESTANAS: readonly { id: Pestana; label: string }[] = [
  { id: "prompt", label: "Prompt" },
  { id: "labs", label: "Labs" },
  { id: "conversaciones", label: "Conversaciones" },
  { id: "actividad", label: "Actividad" },
  { id: "ajustes", label: "Ajustes" },
] as const;

type Props = {
  id: number;
  instancia: Instancia | null;
  prompt: PromptActivo | null;
  versiones: VersionPrompt[];
  status: StatusInstancia | null;
  tabInicial: Pestana;
};

/**
 * Ficha de un agente: shell con pestañas. `instancia` null = Railway caído
 * al cargar — se muestra lo que haya y un aviso, nunca pantalla rota.
 */
export function AgenteView({ id, instancia, prompt, versiones, status, tabInicial }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Pestana>(tabInicial);
  const [operando, startOperar] = useTransition();
  const [avisoOperacion, setAvisoOperacion] = useState<string | null>(null);
  const { confirmar, dialogo } = useConfirmar();

  const uso = status?.uso_hoy;

  async function alternarEncendido() {
    if (!instancia) return;
    const apagar = instancia.activo;
    if (apagar) {
      const ok = await confirmar({
        titulo: `¿Apagar "${instancia.nombre}"?`,
        mensaje: "Deja de responder TODOS sus chats de inmediato.",
        accion: "Apagar",
        peligro: true,
      });
      if (!ok) return;
    }
    setAvisoOperacion(null);
    startOperar(async () => {
      const res = await editarBot(id, { activo: !apagar });
      if (res.error) {
        setAvisoOperacion(res.error);
        return;
      }
      router.refresh();
    });
  }

  function duplicar() {
    setAvisoOperacion(null);
    startOperar(async () => {
      const res = await duplicarBot(id);
      if ("error" in res) {
        setAvisoOperacion(res.error);
        return;
      }
      router.push(`/admin/bots/${res.id}`);
    });
  }

  return (
    <section>
      {dialogo}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <div>
          <h1 className="text-lg font-semibold text-tinta">
            <Link href="/admin/bots" className="text-tinta-60 hover:text-tinta">
              Bots
            </Link>{" "}
            / {instancia?.nombre ?? `#${id}`}
          </h1>
          {instancia && (
            <p className="text-xs text-tinta-60">
              {instancia.canal === "voz" ? "Voz" : "WhatsApp"} ·{" "}
              {instancia.proveedor === "green" ? "Green API" : "Meta Cloud API"} · prompt v
              {instancia.prompt_version}
              {!instancia.activo && " · APAGADO"}
            </p>
          )}
        </div>
        {uso && (
          <span className="text-xs text-tinta-40">
            hoy: {uso.llamadas} llamadas · {uso.tokens_entrada + uso.tokens_salida} tokens ·{" "}
            {status?.conversaciones ?? 0} conversaciones
          </span>
        )}
        {instancia && (
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={operando} onClick={duplicar}>
              Duplicar
            </Button>
            <Button
              variante={instancia.activo ? "peligro" : "fantasma"}
              disabled={operando}
              onClick={() => void alternarEncendido()}
            >
              {instancia.activo ? "Apagar bot" : "Encender bot"}
            </Button>
          </div>
        )}
      </header>

      <div className="flex flex-col gap-4 px-5 py-4">
        {!instancia && (
          <Banner>
            Sin conexión con el bot: se muestra lo último conocido. Recarga en un momento.
          </Banner>
        )}
        {avisoOperacion && <Banner variante="error">{avisoOperacion}</Banner>}

        <Tabs pestanas={PESTANAS} activa={tab} onCambiar={setTab} />

        {tab === "prompt" && (
          <PromptEditor
            instanciaId={id}
            prompt={prompt}
            versiones={versiones}
            onProbarEnLabs={() => setTab("labs")}
          />
        )}
        {tab === "labs" && (
          <LabsChat instanciaId={id} prompt={prompt} onEditarPrompt={() => setTab("prompt")} />
        )}
        {tab === "conversaciones" && <Conversaciones instanciaId={id} />}
        {tab === "actividad" && <Actividad instanciaId={id} />}
        {tab === "ajustes" &&
          (instancia ? (
            <AjustesBot instancia={instancia} />
          ) : (
            <Banner>Sin conexión con el bot: los ajustes necesitan la instancia viva.</Banner>
          ))}
      </div>
    </section>
  );
}
