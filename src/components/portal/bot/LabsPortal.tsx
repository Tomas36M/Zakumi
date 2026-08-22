"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MensajeChat } from "@/lib/bots/tipos";

type Props = { instanciaId: string };

function nuevaSession(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * Prueba del agente contra su pipeline REAL, sin WhatsApp (mismo Labs del
 * panel, vía /app/api/bot con el check de propiedad). La sesión persiste en
 * localStorage para probar también la memoria del agente.
 */
export function LabsPortal({ instanciaId }: Props) {
  const claveStorage = `zk-portal-labs-${instanciaId}`;
  const [session, setSession] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [pausado, setPausado] = useState(false);
  const [texto, setTexto] = useState("");
  const [escribiendo, setEscribiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const guardada = window.localStorage.getItem(claveStorage);
    const s = guardada && /^[a-z0-9-]{4,40}$/.test(guardada) ? guardada : nuevaSession();
    window.localStorage.setItem(claveStorage, s);

    // Todo setState va DESPUÉS del fetch (nada síncrono dentro del effect):
    // la sesión se habilita junto con el historial previo, si lo hay.
    let activo = true;
    void (async () => {
      let mensajesPrevios: MensajeChat[] = [];
      let pausadoPrevio = false;
      try {
        const res = await fetch(`/app/api/bot/${instanciaId}/labs?session=${s}`);
        if (res.ok) {
          const data = (await res.json()) as { messages: MensajeChat[]; paused: boolean };
          mensajesPrevios = data.messages;
          pausadoPrevio = data.paused;
        }
      } catch {
        // sin historial previo no pasa nada: se arranca en limpio
      }
      if (!activo) return;
      setSession(s);
      setMensajes(mensajesPrevios);
      setPausado(pausadoPrevio);
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
      const res = await fetch(`/app/api/bot/${instanciaId}/labs`, {
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
      setError("Tu agente no respondió. Reintenta — el mensaje ya quedó en su memoria.");
    } finally {
      setEscribiendo(false);
    }
  }, [texto, session, escribiendo, pausado, instanciaId]);

  async function reiniciar() {
    if (!session) return;
    setError(null);
    try {
      await fetch(`/app/api/bot/${instanciaId}/labs?session=${session}`, {
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
    <div>
      <div className="app-solicitud-cabecera">
        <p className="app-field-ayuda" style={{ paddingLeft: 0 }}>
          Escríbele como si fueras tu cliente — responde con lo último que guardaste.
        </p>
        <button type="button" className="app-btn-ghost" onClick={() => void reiniciar()}>
          Reiniciar conversación
        </button>
      </div>

      {pausado && (
        <p className="app-aviso">
          Tu agente pasó la conversación a un humano y se silenció — así se
          comporta en la vida real. Reinicia para seguir probando.
        </p>
      )}

      <div className="app-chat">
        {mensajes.length === 0 && !escribiendo && (
          <p className="app-vacio">Di “hola” para empezar.</p>
        )}
        {mensajes.map((m, i) => (
          <p
            key={i}
            className={
              m.role === "assistant"
                ? "app-chat-burbuja app-chat-burbuja--bot"
                : "app-chat-burbuja app-chat-burbuja--persona"
            }
          >
            {m.content}
          </p>
        ))}
        {escribiendo && (
          <p className="app-chat-burbuja app-chat-burbuja--bot app-escribiendo">
            escribiendo…
          </p>
        )}
        <div ref={finRef} />
      </div>

      {error && (
        <p className="app-error" role="alert">
          {error}
        </p>
      )}

      <form
        className="app-chat-envio"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
      >
        <input
          className="app-input"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={pausado ? "Conversación silenciada" : "Escribe como cliente…"}
          disabled={escribiendo || pausado || !session}
        />
        <button
          className="app-btn"
          type="submit"
          disabled={escribiendo || pausado || !texto.trim()}
        >
          {escribiendo ? "…" : "Enviar"}
        </button>
      </form>
    </div>
  );
}
