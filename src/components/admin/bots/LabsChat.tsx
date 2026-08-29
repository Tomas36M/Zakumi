"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { horaDeIso } from "@/lib/admin/formato";
import type { MensajeChat, PromptActivo } from "@/lib/bots/tipos";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { ChatBubble } from "@/components/admin/ui/ChatBubble";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Input } from "@/components/admin/ui/Field";
import { Island } from "@/components/admin/ui/Island";

type Props = {
  instanciaId: number;
  prompt: PromptActivo | null;
  onEditarPrompt: () => void;
};

function nuevaSession(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * Chat de prueba contra el pipeline REAL del bot, sin WhatsApp. La sesión vive
 * en localStorage por instancia (Tomás y Paula no chocan) y es persistente a
 * propósito: así se prueba la memoria del bot y el recorte de historial.
 * Consume tokens reales y sus tools se ejecutan de verdad (escalar pausa).
 */
export function LabsChat({ instanciaId, prompt, onEditarPrompt }: Props) {
  const claveStorage = `zk-labs-${instanciaId}`;
  const [session, setSession] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [pausado, setPausado] = useState(false);
  const [texto, setTexto] = useState("");
  const [escribiendo, setEscribiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verPrompt, setVerPrompt] = useState(false);
  const contRef = useRef<HTMLDivElement>(null);

  // Sesión estable por instancia + carga del historial previo.
  useEffect(() => {
    const guardada = window.localStorage.getItem(claveStorage);
    const s = guardada && /^[a-z0-9-]{4,40}$/.test(guardada) ? guardada : nuevaSession();
    window.localStorage.setItem(claveStorage, s);
    setSession(s);

    let activo = true;
    void (async () => {
      try {
        const res = await fetch(`/admin/api/bots/${instanciaId}/labs?session=${s}`);
        if (!res.ok || !activo) return;
        const data = (await res.json()) as { messages: MensajeChat[]; paused: boolean };
        setMensajes(data.messages);
        setPausado(data.paused);
      } catch {
        // sin historial previo no pasa nada: se arranca en limpio
      }
    })();
    return () => {
      activo = false;
    };
  }, [claveStorage, instanciaId]);

  // scrollTop directo sobre la caja del chat: scrollIntoView movería también
  // el scroller del documento y saltaría la página entera.
  useEffect(() => {
    const c = contRef.current;
    if (c) c.scrollTop = c.scrollHeight;
  }, [mensajes, escribiendo]);

  const enviar = useCallback(async () => {
    const mensaje = texto.trim();
    if (!mensaje || !session || escribiendo || pausado) return;
    setError(null);
    setTexto("");
    setMensajes((m) => [
      ...m,
      { role: "user", content: mensaje, creado_en: new Date().toISOString() },
    ]);
    setEscribiendo(true);
    try {
      const res = await fetch(`/admin/api/bots/${instanciaId}/labs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session, mensaje }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { reply: string | null; paused: boolean };
      if (data.reply !== null) {
        setMensajes((m) => [
          ...m,
          {
            role: "assistant",
            content: data.reply as string,
            creado_en: new Date().toISOString(),
          },
        ]);
      }
      setPausado(data.paused);
    } catch {
      setError("El agente no respondió. Reintenta — el mensaje ya quedó en su memoria.");
    } finally {
      setEscribiendo(false);
    }
  }, [texto, session, escribiendo, pausado, instanciaId]);

  async function reiniciar() {
    if (!session) return;
    setError(null);
    try {
      await fetch(`/admin/api/bots/${instanciaId}/labs?session=${session}`, {
        method: "DELETE",
      });
    } catch {
      // igual arrancamos sesión nueva: el historial viejo queda huérfano
    }
    const s = nuevaSession();
    window.localStorage.setItem(claveStorage, s);
    setSession(s);
    setMensajes([]);
    setPausado(false);
  }

  return (
    <div className="grid items-start gap-aire min-[900px]:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-tinta-40">
            Consume tokens reales · los leads de prueba salen marcados
          </p>
          <Button onClick={() => void reiniciar()}>Reiniciar conversación</Button>
        </div>

        {pausado && (
          <Banner>
            El bot escaló a humano y se silenció — comportamiento real. Reinicia la
            conversación para seguir probando.
          </Banner>
        )}

        <div
          ref={contRef}
          className="barra-fina flex max-h-[65vh] min-h-40 flex-col gap-4 overflow-y-auto rounded-fila border border-hairline p-4"
        >
          {mensajes.length === 0 && !escribiendo && (
            <EmptyState
              titulo="Escríbele como si fueras un cliente."
              detalle="El bot responde con su prompt activo."
            />
          )}
          {mensajes.map((m, i) => (
            <ChatBubble
              key={i}
              lado={m.role === "assistant" ? "agente" : "cliente"}
              autor={m.role === "assistant" ? "Agente" : "Tú (cliente)"}
              hora={horaDeIso(m.creado_en)}
            >
              {m.content}
            </ChatBubble>
          ))}
          {escribiendo && (
            <p className="text-sm text-tinta-40 italic">escribiendo…</p>
          )}
        </div>

        {error && <Banner variante="error">{error}</Banner>}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void enviar();
          }}
        >
          <Input
            className="flex-1"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={pausado ? "Chat silenciado por escalado" : "Escribe como cliente…"}
            disabled={escribiendo || pausado || !session}
          />
          <Button
            variante="primaria"
            type="submit"
            disabled={escribiendo || pausado || !texto.trim()}
          >
            {escribiendo ? "…" : "Enviar"}
          </Button>
        </form>
      </div>

      <Island
        className="bg-isla-alta/50"
        titulo={`Prompt activo ${prompt ? `(v${prompt.version})` : ""}`}
        acciones={
          <Button onClick={() => setVerPrompt((v) => !v)}>
            {verPrompt ? "Ocultar" : "Ver"}
          </Button>
        }
      >
        {verPrompt &&
          (prompt ? (
            <pre className="barra-fina mb-3 max-h-96 overflow-auto rounded-fila bg-isla-alta p-3 text-xs leading-relaxed whitespace-pre-wrap text-tinta-60">
              {prompt.system_prompt}
              {"\n\n---\n\n"}
              {prompt.knowledge}
            </pre>
          ) : (
            <p className="mb-3 text-sm text-tinta-40">Este bot aún no tiene prompt.</p>
          ))}
        <Button onClick={onEditarPrompt}>Editar prompt →</Button>
      </Island>
    </div>
  );
}
