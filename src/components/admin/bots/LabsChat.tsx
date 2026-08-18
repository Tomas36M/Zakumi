"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MensajeChat, PromptActivo } from "@/lib/bots/tipos";

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
  const finRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [mensajes, escribiendo]);

  const enviar = useCallback(async () => {
    const mensaje = texto.trim();
    if (!mensaje || !session || escribiendo || pausado) return;
    setError(null);
    setTexto("");
    setMensajes((m) => [...m, { role: "user", content: mensaje }]);
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
        setMensajes((m) => [...m, { role: "assistant", content: data.reply as string }]);
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
    <div className="adm-labs-layout">
      <div className="adm-conv-detalle">
        <div className="adm-conv-cabecera">
          <p className="adm-ficha-meta">
            Consume tokens reales · los leads de prueba salen marcados
          </p>
          <button type="button" className="adm-cta-ghost" onClick={() => void reiniciar()}>
            Reiniciar conversación
          </button>
        </div>

        {pausado && (
          <p className="adm-aviso">
            El bot escaló a humano y se silenció — comportamiento real. Reinicia la
            conversación para seguir probando.
          </p>
        )}

        <div className="adm-chat">
          {mensajes.length === 0 && !escribiendo && (
            <p className="adm-ficha-sin">
              Escríbele como si fueras un cliente. El bot responde con su prompt activo.
            </p>
          )}
          {mensajes.map((m, i) => (
            <p
              key={i}
              className={
                m.role === "assistant"
                  ? "adm-chat-burbuja adm-chat-burbuja--bot"
                  : "adm-chat-burbuja adm-chat-burbuja--persona"
              }
            >
              {m.content}
            </p>
          ))}
          {escribiendo && (
            <p className="adm-chat-burbuja adm-chat-burbuja--bot adm-labs-escribiendo">
              escribiendo…
            </p>
          )}
          <div ref={finRef} />
        </div>

        {error && (
          <p className="adm-error" role="alert">
            {error}
          </p>
        )}

        <form
          className="adm-chat-envio"
          onSubmit={(e) => {
            e.preventDefault();
            void enviar();
          }}
        >
          <input
            className="adm-input"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={pausado ? "Chat silenciado por escalado" : "Escribe como cliente…"}
            disabled={escribiendo || pausado || !session}
          />
          <button
            className="adm-cta"
            type="submit"
            disabled={escribiendo || pausado || !texto.trim()}
          >
            {escribiendo ? "…" : "Enviar"}
          </button>
        </form>
      </div>

      <aside className="adm-labs-prompt">
        <div className="adm-conv-cabecera">
          <h2 className="adm-field-label">
            Prompt activo {prompt ? `(v${prompt.version})` : ""}
          </h2>
          <button
            type="button"
            className="adm-cta-ghost"
            onClick={() => setVerPrompt((v) => !v)}
          >
            {verPrompt ? "Ocultar" : "Ver"}
          </button>
        </div>
        {verPrompt &&
          (prompt ? (
            <pre className="adm-editor-pre adm-labs-pre">
              {prompt.system_prompt}
              {"\n\n---\n\n"}
              {prompt.knowledge}
            </pre>
          ) : (
            <p className="adm-ficha-sin">Este bot aún no tiene prompt.</p>
          ))}
        <button type="button" className="adm-cta-ghost" onClick={onEditarPrompt}>
          Editar prompt →
        </button>
      </aside>
    </div>
  );
}
