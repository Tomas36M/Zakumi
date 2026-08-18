"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { duplicarBot, editarBot } from "@/lib/admin/bots-actions";
import type {
  Instancia,
  PromptActivo,
  StatusInstancia,
  VersionPrompt,
} from "@/lib/bots/tipos";
import { Actividad } from "./Actividad";
import { Conversaciones } from "./Conversaciones";
import { LabsChat } from "./LabsChat";
import { PromptEditor } from "./PromptEditor";

export type Pestana = "prompt" | "labs" | "conversaciones" | "actividad";

const PESTANAS: readonly { valor: Pestana; label: string; lista: boolean }[] = [
  { valor: "prompt", label: "Prompt", lista: true },
  { valor: "labs", label: "Labs", lista: true },
  { valor: "conversaciones", label: "Conversaciones", lista: true },
  { valor: "actividad", label: "Actividad", lista: true },
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

  const uso = status?.uso_hoy;

  function alternarEncendido() {
    if (!instancia) return;
    const apagar = instancia.activo;
    if (
      apagar &&
      !window.confirm(
        `¿Apagar "${instancia.nombre}"? Deja de responder TODOS sus chats de inmediato.`,
      )
    ) {
      return;
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
    <section className="adm-seccion">
      <div className="adm-toolbar">
        <div>
          <h1 className="adm-titulo">
            <Link href="/admin/bots" className="adm-bot-volver">
              Bots
            </Link>{" "}
            / {instancia?.nombre ?? `#${id}`}
          </h1>
          {instancia && (
            <p className="adm-bot-meta">
              {instancia.canal === "voz" ? "Voz" : "WhatsApp"} ·{" "}
              {instancia.proveedor === "green" ? "Green API" : "Meta Cloud API"} · prompt v
              {instancia.prompt_version}
              {!instancia.activo && " · APAGADO"}
            </p>
          )}
        </div>
        {uso && (
          <span className="adm-toolbar-conteo">
            hoy: {uso.llamadas} llamadas · {uso.tokens_entrada + uso.tokens_salida} tokens ·{" "}
            {status?.conversaciones ?? 0} conversaciones
          </span>
        )}
        {instancia && (
          <div className="adm-ficha-acciones">
            <button
              type="button"
              className="adm-cta-ghost"
              disabled={operando}
              onClick={duplicar}
            >
              Duplicar
            </button>
            <button
              type="button"
              className="adm-cta-ghost"
              disabled={operando}
              onClick={alternarEncendido}
            >
              {instancia.activo ? "Apagar bot" : "Encender bot"}
            </button>
          </div>
        )}
      </div>

      {!instancia && (
        <p className="adm-aviso">
          Sin conexión con el bot: se muestra lo último conocido. Recarga en un momento.
        </p>
      )}
      {avisoOperacion && (
        <p className="adm-error" role="alert">
          {avisoOperacion}
        </p>
      )}

      <div className="adm-tabs" role="tablist">
        {PESTANAS.map((p) => (
          <button
            key={p.valor}
            type="button"
            role="tab"
            aria-selected={tab === p.valor}
            className={tab === p.valor ? "adm-tab adm-tab--activa" : "adm-tab"}
            onClick={() => setTab(p.valor)}
            disabled={!p.lista}
            title={p.lista ? undefined : "Próximamente"}
          >
            {p.label}
          </button>
        ))}
      </div>

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
    </section>
  );
}
