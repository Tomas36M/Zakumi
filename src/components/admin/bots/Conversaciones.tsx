"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { enviarManual, pausarChat, reanudarChat } from "@/lib/admin/bots-actions";
import { esLabs, type Conversacion, type Historial } from "@/lib/bots/tipos";

type Props = { instanciaId: number };

function fechaCorta(iso: string | null): string {
  if (!iso) return "";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  }).format(fecha);
}

/**
 * Conversaciones reales del bot: lista paginada, historial del chat elegido,
 * pausar/reanudar (tomar el chat un humano) y envío manual por el proveedor.
 */
export function Conversaciones({ instanciaId }: Props) {
  const [conversaciones, setConversaciones] = useState<Conversacion[] | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [telefono, setTelefono] = useState<string | null>(null);
  const [historial, setHistorial] = useState<Historial | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [avisoChat, setAvisoChat] = useState<string | null>(null);
  const [operando, startOperar] = useTransition();

  const cargarLista = useCallback(
    async (off: number) => {
      setError(null);
      try {
        const res = await fetch(
          `/admin/api/bots/${instanciaId}/conversaciones?offset=${off}`,
        );
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { conversaciones: Conversacion[] };
        setConversaciones(data.conversaciones);
        setOffset(off);
      } catch {
        setError("No se pudieron cargar las conversaciones. ¿Railway está arriba?");
      }
    },
    [instanciaId],
  );

  const cargarHistorial = useCallback(
    async (tel: string) => {
      setAvisoChat(null);
      setHistorial(null);
      setTelefono(tel);
      try {
        const res = await fetch(
          `/admin/api/bots/${instanciaId}/historial?telefono=${encodeURIComponent(tel)}`,
        );
        if (!res.ok) throw new Error(String(res.status));
        setHistorial((await res.json()) as Historial);
      } catch {
        setAvisoChat("No se pudo cargar el historial.");
      }
    },
    [instanciaId],
  );

  useEffect(() => {
    void cargarLista(0);
  }, [cargarLista]);

  function alternarPausa() {
    if (!telefono || !historial) return;
    setAvisoChat(null);
    const pausado = historial.paused;
    startOperar(async () => {
      const res = pausado
        ? await reanudarChat(instanciaId, telefono)
        : await pausarChat(instanciaId, telefono);
      if (res.error) {
        setAvisoChat(res.error);
        return;
      }
      await cargarHistorial(telefono);
      await cargarLista(offset);
    });
  }

  function enviar() {
    if (!telefono || !mensaje.trim()) return;
    setAvisoChat(null);
    startOperar(async () => {
      const res = await enviarManual(instanciaId, telefono, mensaje);
      if (res.error) {
        setAvisoChat(res.error);
        return;
      }
      setMensaje("");
      await cargarHistorial(telefono);
    });
  }

  return (
    <div className="adm-conv-layout">
      <div className="adm-conv-lista">
        {error && <p className="adm-aviso">{error}</p>}
        {conversaciones === null && !error && (
          <p className="adm-tabla-vacia">Cargando…</p>
        )}
        {conversaciones?.length === 0 && (
          <p className="adm-tabla-vacia">Todavía no hay conversaciones.</p>
        )}
        <ul className="adm-conv-items">
          {(conversaciones ?? []).map((c) => (
            <li key={c.phone}>
              <button
                type="button"
                className={
                  c.phone === telefono
                    ? "adm-conv-item adm-conv-item--activa"
                    : "adm-conv-item"
                }
                onClick={() => void cargarHistorial(c.phone)}
              >
                <span className="adm-conv-telefono">
                  {c.phone}
                  {esLabs(c.phone) && <span className="adm-conv-prueba"> Prueba</span>}
                  {c.paused && <span className="adm-conv-pausado"> ⏸ pausado</span>}
                </span>
                <span className="adm-conv-ultimo">{c.last}</span>
                <span className="adm-conv-fecha">
                  {c.messages} mensajes · {fechaCorta(c.last_at)}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {(offset > 0 || (conversaciones?.length ?? 0) === 50) && (
          <div className="adm-ficha-acciones">
            {offset > 0 && (
              <button
                type="button"
                className="adm-cta-ghost"
                onClick={() => void cargarLista(Math.max(offset - 50, 0))}
              >
                ← Más recientes
              </button>
            )}
            {(conversaciones?.length ?? 0) === 50 && (
              <button
                type="button"
                className="adm-cta-ghost"
                onClick={() => void cargarLista(offset + 50)}
              >
                Más antiguas →
              </button>
            )}
          </div>
        )}
      </div>

      <div className="adm-conv-detalle">
        {!telefono && (
          <p className="adm-ficha-sin">Elige una conversación para ver el chat.</p>
        )}
        {telefono && (
          <>
            <div className="adm-conv-cabecera">
              <h2 className="adm-ficha-nombre">{telefono}</h2>
              {historial && (
                <button
                  type="button"
                  className="adm-cta-ghost"
                  disabled={operando}
                  onClick={alternarPausa}
                >
                  {historial.paused ? "Reanudar bot" : "Pausar bot (lo tomo yo)"}
                </button>
              )}
            </div>
            {historial?.paused && (
              <p className="adm-aviso">
                Bot en silencio en este chat: los mensajes los responde un humano.
              </p>
            )}
            <div className="adm-chat">
              {historial === null && !avisoChat && (
                <p className="adm-tabla-vacia">Cargando…</p>
              )}
              {historial?.messages.map((m, i) => (
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
            </div>
            {avisoChat && (
              <p className="adm-error" role="alert">
                {avisoChat}
              </p>
            )}
            <form
              className="adm-chat-envio"
              onSubmit={(e) => {
                e.preventDefault();
                enviar();
              }}
            >
              <input
                className="adm-input"
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Mensaje manual por WhatsApp (como el negocio)"
                disabled={operando || esLabs(telefono)}
              />
              <button
                className="adm-cta"
                type="submit"
                disabled={operando || !mensaje.trim() || esLabs(telefono)}
              >
                Enviar
              </button>
            </form>
            {esLabs(telefono) && (
              <p className="adm-ficha-sin">
                Conversación de prueba del Labs: no hay WhatsApp al otro lado.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
