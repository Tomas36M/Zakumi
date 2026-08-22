"use client";

import { useEffect, useState } from "react";
import type { Conversacion, MensajeChat } from "@/lib/bots/tipos";

type Props = { instanciaId: string };

/**
 * Conversaciones del agente en SOLO LECTURA: lista + burbujas. Pausar,
 * responder a mano o borrar historial son operaciones del panel de Zakumi,
 * no del cliente — por eso esta vista no las tiene.
 */
export function ConversacionesCliente({ instanciaId }: Props) {
  const [conversaciones, setConversaciones] = useState<Conversacion[] | null>(null);
  const [sinConexion, setSinConexion] = useState(false);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<MensajeChat[] | null>(null);
  const [cargandoChat, setCargandoChat] = useState(false);

  useEffect(() => {
    let activo = true;
    void (async () => {
      try {
        const res = await fetch(`/app/api/bot/${instanciaId}/conversaciones`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { conversaciones: Conversacion[] };
        if (activo) setConversaciones(data.conversaciones);
      } catch {
        if (activo) setSinConexion(true);
      }
    })();
    return () => {
      activo = false;
    };
  }, [instanciaId]);

  async function abrir(telefono: string) {
    setSeleccion(telefono);
    setMensajes(null);
    setCargandoChat(true);
    try {
      const res = await fetch(
        `/app/api/bot/${instanciaId}/historial?telefono=${encodeURIComponent(telefono)}`,
      );
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { messages: MensajeChat[] };
      setMensajes(data.messages);
    } catch {
      setMensajes(null);
      setSinConexion(true);
    } finally {
      setCargandoChat(false);
    }
  }

  if (sinConexion && conversaciones === null) {
    return (
      <p className="app-aviso">
        No pudimos cargar las conversaciones ahora mismo. Vuelve a intentar en un
        momento.
      </p>
    );
  }

  if (conversaciones !== null && conversaciones.length === 0) {
    return (
      <div className="app-vacio app-card">
        <p>
          Cuando alguien le escriba a tu agente por WhatsApp, la conversación
          aparecerá aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="app-conv-layout">
      <div className="app-conv-lista">
        {conversaciones === null ? (
          <p className="app-vacio">Cargando…</p>
        ) : (
          conversaciones.map((c) => (
            <button
              key={c.phone}
              type="button"
              className={
                seleccion === c.phone
                  ? "app-conv-item app-conv-item--activa"
                  : "app-conv-item"
              }
              onClick={() => void abrir(c.phone)}
              title={c.last}
            >
              {c.phone} · {c.messages}
            </button>
          ))
        )}
      </div>
      <div className="app-chat">
        {seleccion === null ? (
          <p className="app-vacio">Elige una conversación para leerla.</p>
        ) : cargandoChat ? (
          <p className="app-vacio">Cargando…</p>
        ) : mensajes === null ? (
          <p className="app-vacio">No se pudo cargar esta conversación.</p>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
