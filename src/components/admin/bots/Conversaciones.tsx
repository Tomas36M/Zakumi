"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import {
  borrarConversacion,
  enviarManual,
  pausarChat,
  reanudarChat,
} from "@/lib/admin/bots-actions";
import { fechaCorta, horaDeIso } from "@/lib/admin/formato";
import { labelEstado } from "@/lib/admin/negocios";
import {
  fueraDeVentana,
  rutaFolleto,
  verticalDeSaludo,
  type FichaNegocio,
} from "@/lib/admin/zak";
import { abrirChatZak } from "@/lib/admin/zak-actions";
import { usePollingVivo } from "@/lib/admin/usePollingVivo";
import { mismoJson } from "@/lib/admin/vivo";
import { esLabs, type Conversacion, type Historial } from "@/lib/bots/tipos";
import { Badge } from "@/components/admin/ui/Badge";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { ChatBubble } from "@/components/admin/ui/ChatBubble";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Input } from "@/components/admin/ui/Field";
import { ListRow } from "@/components/admin/ui/ListRow";
import { Skeleton } from "@/components/admin/ui/Skeleton";
import { NuevoChatZak } from "./NuevoChatZak";
import { SelectorPlantilla } from "./SelectorPlantilla";

type Props = {
  instanciaId: number;
  /** Zak tiene extras de prospección: abrir chats nuevos y reabrir con plantilla. */
  esZak?: boolean;
  /** Chat a abrir al montar (deep-link del CRM), exista o no en la lista. */
  abrirInicial?: string | null;
};

/**
 * Conversaciones reales del bot: lista paginada, historial del chat elegido,
 * pausar/reanudar (tomar el chat un humano) y envío manual por el proveedor.
 */
export function Conversaciones({ instanciaId, esZak = false, abrirInicial = null }: Props) {
  const [conversaciones, setConversaciones] = useState<Conversacion[] | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [telefono, setTelefono] = useState<string | null>(null);
  const [historial, setHistorial] = useState<Historial | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [avisoChat, setAvisoChat] = useState<string | null>(null);
  const [operando, startOperar] = useTransition();

  const [abriendoChat, setAbriendoChat] = useState(false);

  // Fichas del CRM por teléfono (formato del bot): quién es cada número,
  // qué tipo de negocio es y en qué estado va. Sin ficha = número suelto.
  const [fichas, setFichas] = useState<Record<string, FichaNegocio>>({});
  const [slugReabrir, setSlugReabrir] = useState<string | null>(null);
  // Teléfonos ya consultados (con o sin negocio): cada número viaja al CRM
  // UNA vez por visita — ni clics repetidos ni paginar re-preguntan.
  const pedidasRef = useRef(new Set<string>());

  // Espejos en refs de lo que los ticks del poll necesitan leer sin recrear
  // intervalos: se actualizan en los MISMOS callbacks que hacen setState.
  const historialRef = useRef<Historial | null>(null);
  const conversacionesRef = useRef<Conversacion[] | null>(null);
  const offsetRef = useRef(0);
  const telefonoRef = useRef<string | null>(null);

  // "¿Debo pegar el scroll al fondo?" — carga inicial: siempre; tick del
  // poll: solo si el usuario YA estaba al fondo (no robarle el scroll al que
  // lee arriba). scrollTop directo sobre la caja: scrollIntoView movería
  // TODOS los ancestros scrolleables y saltaría la página entera. El effect
  // solo toca DOM.
  const contRef = useRef<HTMLDivElement | null>(null);
  const bajarRef = useRef(true);
  useEffect(() => {
    const c = contRef.current;
    if (bajarRef.current && c) {
      c.scrollTop = c.scrollHeight;
      bajarRef.current = false;
    }
  }, [telefono, historial?.messages.length]);

  const cruzarConCrm = useCallback(
    async (tels: string[]) => {
      if (!esZak) return;
      const nuevas = tels.filter((t) => !esLabs(t) && !pedidasRef.current.has(t));
      if (nuevas.length === 0) return;
      for (const t of nuevas) pedidasRef.current.add(t);
      try {
        const res = await fetch(
          `/admin/api/zak/fichas?tels=${encodeURIComponent(nuevas.join(","))}`,
        );
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { fichas: Record<string, FichaNegocio> };
        setFichas((prev) => ({ ...prev, ...data.fichas }));
      } catch {
        // Informativo: sin ficha la bandeja sigue sirviendo. Reintentables.
        for (const t of nuevas) pedidasRef.current.delete(t);
      }
    },
    [esZak],
  );

  const cargarLista = useCallback(
    async (off: number): Promise<boolean> => {
      setError(null);
      try {
        const res = await fetch(
          `/admin/api/bots/${instanciaId}/conversaciones?offset=${off}`,
        );
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { conversaciones: Conversacion[] };
        conversacionesRef.current = data.conversaciones;
        setConversaciones(data.conversaciones);
        offsetRef.current = off;
        setOffset(off);
        void cruzarConCrm(data.conversaciones.map((c) => c.phone));
        return true;
      } catch {
        setError("No se pudieron cargar las conversaciones. ¿Railway está arriba?");
        return false;
      }
    },
    [instanciaId, cruzarConCrm],
  );

  // Tick de la lista (~12s): silencioso — jamás toca `error` (ahí viaja el
  // "Saludo enviado ✓") y en fallo conserva la última lista buena.
  const refrescarLista = useCallback(async () => {
    try {
      const res = await fetch(
        `/admin/api/bots/${instanciaId}/conversaciones?offset=${offsetRef.current}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { conversaciones: Conversacion[] };
      if (mismoJson(conversacionesRef.current, data.conversaciones)) return;
      conversacionesRef.current = data.conversaciones;
      setConversaciones(data.conversaciones);
      void cruzarConCrm(data.conversaciones.map((c) => c.phone));
    } catch {
      // tick silencioso: se reintenta en el próximo
    }
  }, [instanciaId, cruzarConCrm]);

  const cargarHistorial = useCallback(
    async (tel: string) => {
      setAvisoChat(null);
      historialRef.current = null;
      setHistorial(null);
      telefonoRef.current = tel;
      setTelefono(tel);
      setSlugReabrir(null);
      bajarRef.current = true; // chat recién abierto: scroll al último mensaje
      void cruzarConCrm([tel]);
      try {
        const res = await fetch(
          `/admin/api/bots/${instanciaId}/historial?telefono=${encodeURIComponent(tel)}`,
        );
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Historial;
        if (telefonoRef.current !== tel) return; // ya abrió otro chat
        historialRef.current = data;
        setHistorial(data);
      } catch {
        setAvisoChat("No se pudo cargar el historial.");
      }
    },
    [instanciaId, cruzarConCrm],
  );

  // Tick del chat abierto (~3.5s): solo hace setState si algo cambió, y mide
  // ANTES si el usuario estaba al fondo para no robarle el scroll.
  const refrescarHistorial = useCallback(async () => {
    const tel = telefonoRef.current;
    if (!tel) return;
    try {
      const res = await fetch(
        `/admin/api/bots/${instanciaId}/historial?telefono=${encodeURIComponent(tel)}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as Historial;
      if (telefonoRef.current !== tel) return; // cambió de chat en pleno vuelo
      if (mismoJson(historialRef.current, data)) return;
      const c = contRef.current;
      bajarRef.current =
        c !== null && c.scrollHeight - c.scrollTop - c.clientHeight < 48;
      historialRef.current = data;
      setHistorial(data);
    } catch {
      // tick silencioso: se reintenta en el próximo
    }
  }, [instanciaId]);

  useEffect(() => {
    void cargarLista(0);
  }, [cargarLista]);

  // Deep-link del CRM: abrir ese chat aunque no exista todavía en la lista —
  // el historial vacío + ventana cerrada ofrece «Reabrir con plantilla».
  useEffect(() => {
    if (abrirInicial) void cargarHistorial(abrirInicial);
  }, [abrirInicial, cargarHistorial]);

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
      // Tick silencioso, no recarga con skeleton: el bot ya guarda el mensaje
      // manual en el historial, así que aparece al instante y sin parpadeo.
      bajarRef.current = true;
      await refrescarHistorial();
    });
  }

  function reabrirConPlantilla(slug: string) {
    if (!telefono) return;
    setAvisoChat(null);
    startOperar(async () => {
      const res = await abrirChatZak(telefono, slug);
      if ("error" in res) {
        setAvisoChat(res.error);
        return;
      }
      await cargarHistorial(telefono);
    });
  }

  function borrar() {
    if (!telefono) return;
    if (
      !window.confirm(
        "¿Borrar esta conversación? Se borra también la MEMORIA del agente con " +
          "esta persona: el próximo mensaje empieza de cero.",
      )
    ) {
      return;
    }
    setAvisoChat(null);
    startOperar(async () => {
      const res = await borrarConversacion(instanciaId, telefono);
      if (res.error) {
        setAvisoChat(res.error);
        return;
      }
      telefonoRef.current = null;
      setTelefono(null);
      historialRef.current = null;
      setHistorial(null);
      await cargarLista(0);
    });
  }

  // La bandeja en vivo: el chat abierto cada ~3.5s, la lista cada ~12s. Los
  // labs no tienen WhatsApp al otro lado, y `!operando` congela el poll
  // mientras una mutación (pausar, reabrir, borrar, enviar) está en vuelo.
  usePollingVivo(refrescarHistorial, {
    intervaloMs: 3500,
    habilitado:
      telefono !== null && historial !== null && !esLabs(telefono) && !operando,
  });
  usePollingVivo(refrescarLista, {
    intervaloMs: 12_000,
    habilitado: conversaciones !== null && !operando,
  });

  const ventanaCerrada =
    esZak && historial !== null && !esLabs(historial.phone) &&
    fueraDeVentana(historial.ultimo_del_cliente, Date.now());

  const fichaActual = telefono ? fichas[telefono] : undefined;
  const slugParaReabrir = slugReabrir ?? fichaActual?.verticalSlug ?? "generico";

  return (
    <div className="grid items-start gap-aire min-[900px]:grid-cols-[340px_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        {esZak && (
          abriendoChat ? (
            <NuevoChatZak
              onAbierto={() => {
                setAbriendoChat(false);
                // El aviso va DESPUÉS de recargar: cargarLista arranca con
                // setError(null) y se comería la confirmación del envío.
                void cargarLista(0).then((ok) => {
                  if (ok) {
                    setError("Saludo enviado ✓ — la conversación ya está en la bandeja.");
                  }
                });
              }}
              onCancelar={() => setAbriendoChat(false)}
            />
          ) : (
            <Button onClick={() => setAbriendoChat(true)}>
              + Nuevo chat (Zak saluda con la plantilla)
            </Button>
          )
        )}
        {error && <Banner>{error}</Banner>}
        {conversaciones === null && !error && (
          <div className="flex flex-col gap-2 px-3 py-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        )}
        {conversaciones?.length === 0 && (
          <EmptyState titulo="Todavía no hay conversaciones." />
        )}
        <ul className="flex flex-col gap-1">
          {(conversaciones ?? []).map((c) => {
            const ficha = fichas[c.phone];
            return (
              <li key={c.phone}>
                <ListRow
                  role="button"
                  tabIndex={0}
                  activa={c.phone === telefono}
                  onClick={() => void cargarHistorial(c.phone)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void cargarHistorial(c.phone);
                    }
                  }}
                  className="flex flex-col gap-0.5"
                >
                  <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-tinta">
                    {ficha?.nombre ?? c.phone}
                    {esLabs(c.phone) && <Badge tono="neutro">Prueba</Badge>}
                    {ficha && <Badge tono="neutro">{ficha.verticalLabel}</Badge>}
                    {ficha && <Badge tono={ficha.estado}>{labelEstado(ficha.estado)}</Badge>}
                    {c.paused && <Badge tono="neutro">⏸ pausado</Badge>}
                  </span>
                  <span className="truncate text-sm text-tinta-60">{c.last}</span>
                  <span className="text-xs text-tinta-40">
                    {ficha && `${c.phone} · `}
                    {c.messages} mensajes · {fechaCorta(c.last_at)}
                  </span>
                </ListRow>
              </li>
            );
          })}
        </ul>
        {(offset > 0 || (conversaciones?.length ?? 0) === 50) && (
          <div className="flex flex-wrap gap-2">
            {offset > 0 && (
              <Button onClick={() => void cargarLista(Math.max(offset - 50, 0))}>
                ← Más recientes
              </Button>
            )}
            {(conversaciones?.length ?? 0) === 50 && (
              <Button onClick={() => void cargarLista(offset + 50)}>
                Más antiguas →
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        {!telefono && (
          <EmptyState titulo="Elige una conversación para ver el chat." />
        )}
        {telefono && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-tinta">
                  {fichaActual?.nombre ?? telefono}
                </h2>
                {fichaActual && (
                  <>
                    <span className="text-sm text-tinta-40">{telefono}</span>
                    <Badge tono="neutro">{fichaActual.verticalLabel}</Badge>
                    <Badge tono={fichaActual.estado}>
                      {labelEstado(fichaActual.estado)}
                    </Badge>
                  </>
                )}
              </span>
              {historial && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button disabled={operando} onClick={alternarPausa}>
                    {historial.paused ? "Reanudar bot" : "Pausar bot (lo tomo yo)"}
                  </Button>
                  <Button variante="peligro" disabled={operando} onClick={borrar}>
                    <Trash2 className="h-4 w-4" /> Borrar
                  </Button>
                </div>
              )}
            </div>
            {historial?.paused && (
              <Banner>
                Bot en silencio en este chat: los mensajes los responde un humano.
              </Banner>
            )}
            <div
              ref={contRef}
              className="barra-fina flex max-h-[65vh] min-h-40 flex-col gap-4 overflow-y-auto rounded-fila border border-hairline p-4"
            >
              {historial === null && !avisoChat && (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              )}
              {historial?.messages.map((m, i) => {
                const saludo = m.role === "assistant" ? verticalDeSaludo(m.content) : null;
                return (
                  <ChatBubble
                    key={i}
                    lado={m.role === "assistant" ? "agente" : "cliente"}
                    autor={m.role === "assistant" ? (esZak ? "Zak" : "Bot") : "Cliente"}
                    hora={horaDeIso(m.creado_en)}
                  >
                    {saludo && (
                      <Image
                        src={rutaFolleto(saludo.folleto)}
                        alt={`Folleto ${saludo.label}`}
                        width={176}
                        height={220}
                        loading="lazy"
                        className="mb-2 h-auto w-44 rounded-fila border border-hairline"
                      />
                    )}
                    {m.content}
                  </ChatBubble>
                );
              })}
            </div>
            {avisoChat && <Banner variante="error">{avisoChat}</Banner>}
            {ventanaCerrada ? (
              <div className="flex flex-col gap-2">
                <Banner>
                  WhatsApp cerró el chat libre: pasaron más de 24 horas desde el
                  último mensaje de esta persona (regla de Meta — el texto libre se
                  descarta en silencio). Para reabrirlo, Zak saluda con la plantilla.
                </Banner>
                <div className="max-w-md">
                  <SelectorPlantilla
                    valor={slugParaReabrir}
                    onCambiar={setSlugReabrir}
                    disabled={operando}
                  />
                </div>
                <Button
                  variante="primaria"
                  className="self-start"
                  disabled={operando}
                  onClick={() => reabrirConPlantilla(slugParaReabrir)}
                >
                  {operando ? "Enviando…" : "Reabrir con plantilla"}
                </Button>
              </div>
            ) : (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  enviar();
                }}
              >
                <Input
                  className="flex-1"
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  placeholder="Mensaje manual por WhatsApp (como el negocio)"
                  disabled={operando || esLabs(telefono)}
                />
                <Button
                  variante="primaria"
                  type="submit"
                  disabled={operando || !mensaje.trim() || esLabs(telefono)}
                >
                  Enviar
                </Button>
              </form>
            )}
            {esLabs(telefono) && (
              <p className="text-sm text-tinta-40">
                Conversación de prueba del Labs: no hay WhatsApp al otro lado.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
