"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  activarAgenteVoz,
  guardarConfigVoz,
  lanzarTandaVoz,
  sincronizarAgenteVoz,
} from "@/lib/admin/voz-actions";
import type { AgenteVozFila } from "@/lib/admin/voz";
import type { VozEleven } from "@/lib/voz/api";
import { CAMPOS_VOZ, seccionesDe, type SeccionesVoz } from "@/lib/voz/guias";
import {
  TIPOS_EXTRACCION,
  type CampoExtraccion,
  type LlamadaVoz,
  type TipoExtraccion,
} from "@/lib/voz/tipos";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import { Field, Input, Select, TextArea } from "@/components/admin/ui/Field";
import { Island } from "@/components/admin/ui/Island";
import { Tabs } from "@/components/admin/ui/Tabs";
import { SelectorVoz } from "./VozView";
import { LabVoz } from "./LabVoz";
import { LlamadasVoz } from "./LlamadasVoz";

type Cliente = { id: string; nombre: string };
export type Pestana = "config" | "lab" | "llamadas" | "tanda" | "widget";

function snippetWidget(agentId: string): string {
  return (
    `<elevenlabs-convai agent-id="${agentId}"></elevenlabs-convai>\n` +
    `<script src="https://unpkg.com/@elevenlabs/convai-widget-embed" async type="text/javascript"></script>`
  );
}

export function FichaAgenteVoz({
  agente,
  llamadas,
  llamadasHoy,
  voces,
  clientes,
  telefoniaLista,
  tabInicial = "config",
}: {
  agente: AgenteVozFila;
  llamadas: LlamadaVoz[];
  llamadasHoy: number;
  voces: VozEleven[] | null;
  clientes: Cliente[];
  telefoniaLista: boolean;
  tabInicial?: Pestana;
}) {
  const [tab, setTab] = useState<Pestana>(tabInicial);
  // El lab se monta en la primera visita (no cargar su bundle si nunca se
  // abre) y NO se desmonta después: destruiría el polling de una prueba en
  // vuelo y cortaría la sesión del widget al cambiar de pestaña.
  const [labVisitado, setLabVisitado] = useState(tabInicial === "lab");
  const [pendiente, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { confirmar, dialogo } = useConfirmar();

  // --- Configuración (fuente: la fila; se guarda completa) ---
  const [nombre, setNombre] = useState(agente.nombre);
  const [clienteId, setClienteId] = useState(agente.cliente_id ?? "");
  const [voiceId, setVoiceId] = useState(agente.voice_id ?? "");
  const [primerMensaje, setPrimerMensaje] = useState(agente.primer_mensaje ?? "");
  const [secciones, setSecciones] = useState<SeccionesVoz>(seccionesDe(agente.secciones));
  const [extraccion, setExtraccion] = useState<CampoExtraccion[]>(agente.extraccion);
  const [capDiario, setCapDiario] = useState(String(agente.cap_diario));

  // --- Tanda ---
  const [telefonosTanda, setTelefonosTanda] = useState("");

  const pestanas: readonly { id: Pestana; label: string }[] = [
    { id: "config", label: "Configuración" },
    { id: "lab", label: "Lab" },
    { id: "llamadas", label: `Llamadas (${llamadas.length})` },
    { id: "tanda", label: "Tanda" },
    { id: "widget", label: "Widget" },
  ];

  function correr(accion: () => Promise<{ error: string | null } | void>) {
    setMensaje(null);
    setError(null);
    startTransition(async () => {
      const r = await accion();
      if (r && r.error) setError(r.error);
    });
  }

  function guardar() {
    setMensaje(null);
    setError(null);
    startTransition(async () => {
      const r = await guardarConfigVoz(agente.id, {
        nombre,
        clienteId: clienteId || null,
        voiceId,
        primerMensaje,
        secciones,
        extraccion,
        capDiario: Number(capDiario),
      });
      if (r.error) setError(r.error);
      else setMensaje(r.aviso ?? "Configuración guardada y sincronizada.");
    });
  }

  async function alternarEncendido() {
    if (agente.activo) {
      const ok = await confirmar({
        titulo: `¿Apagar "${agente.nombre}"?`,
        mensaje: "Dejará de aceptar llamadas nuevas desde el panel.",
        accion: "Apagar",
        peligro: true,
      });
      if (!ok) return;
    }
    correr(() => activarAgenteVoz(agente.id, !agente.activo));
  }

  function editarCampo(i: number, cambios: Partial<CampoExtraccion>) {
    setExtraccion((prev) => prev.map((c, j) => (j === i ? { ...c, ...cambios } : c)));
  }

  return (
    <section>
      {dialogo}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <div>
          <h1 className="text-lg font-semibold text-tinta">
            <Link href="/admin/voz" className="text-tinta-60 hover:text-tinta">
              Voz
            </Link>{" "}
            / {agente.nombre}
          </h1>
          <p className="text-xs text-tinta-60">
            Agente de voz · {agente.cliente_nombre ?? "Demo de Zakumi"} ·{" "}
            {agente.agent_id_eleven ? "Sincronizado con ElevenLabs" : "⚠️ Sin sincronizar"} ·
            hoy {llamadasHoy}/{agente.cap_diario} salientes
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!agente.agent_id_eleven && (
            <Button
              variante="primaria"
              disabled={pendiente}
              onClick={() => correr(() => sincronizarAgenteVoz(agente.id))}
            >
              Sincronizar
            </Button>
          )}
          <Button
            variante={agente.activo ? "peligro" : "fantasma"}
            disabled={pendiente}
            onClick={() => void alternarEncendido()}
          >
            {agente.activo ? "Apagar" : "Encender"}
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-4 px-5 py-4">
        <Tabs
          pestanas={pestanas}
          activa={tab}
          onCambiar={(t) => {
            setTab(t);
            if (t === "lab") setLabVisitado(true);
          }}
        />

        {error && <Banner variante="error">{error}</Banner>}
        {mensaje && <Banner>{mensaje}</Banner>}

        {tab === "config" && (
          <div className="flex flex-col gap-4">
            <Island titulo="Identidad" className="flex flex-col gap-3 bg-isla-alta/50">
              <Field label="Nombre *">
                <Input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  maxLength={200}
                />
              </Field>
              <Field label="Cliente (vacío = demo de Zakumi)">
                <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                  <option value="">— Sin cliente (demo) —</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Cap de llamadas salientes por día (0-500)">
                <Input
                  inputMode="numeric"
                  value={capDiario}
                  onChange={(e) => setCapDiario(e.target.value)}
                  className="max-w-40"
                />
              </Field>
            </Island>

            <Island titulo="Voz y saludo" className="flex flex-col gap-3 bg-isla-alta/50">
              {voces === null ? (
                <Banner>Sin conexión con ElevenLabs: no se puede cambiar la voz ahora.</Banner>
              ) : (
                <Field label="Voz *">
                  <SelectorVoz voces={voces} valor={voiceId} onCambio={setVoiceId} />
                </Field>
              )}
              <Field label="Primer mensaje * (debe presentarse como asistente virtual — obligación legal)">
                <TextArea
                  rows={2}
                  maxLength={500}
                  value={primerMensaje}
                  onChange={(e) => setPrimerMensaje(e.target.value)}
                />
              </Field>
            </Island>

            <Island
              titulo="Comportamiento"
              acciones={
                <span className="text-xs text-tinta-40">
                  las reglas duras — presentarse como IA, no inventar precios, colgar bien — van siempre
                </span>
              }
              className="flex flex-col gap-3 bg-isla-alta/50"
            >
              {CAMPOS_VOZ.map(({ campo, titulo, ayuda, placeholder }) => (
                <Field key={campo} label={`${titulo} — ${ayuda}`}>
                  <TextArea
                    rows={3}
                    maxLength={4000}
                    placeholder={placeholder}
                    value={secciones[campo]}
                    onChange={(e) =>
                      setSecciones((prev) => ({ ...prev, [campo]: e.target.value }))
                    }
                  />
                </Field>
              ))}
            </Island>

            <Island
              titulo="Extracción de datos por llamada"
              acciones={
                <span className="text-xs text-tinta-40">
                  lead_nombre / lead_telefono / lead_detalle crean la venta en el portal
                </span>
              }
              className="flex flex-col gap-3 bg-isla-alta/50"
            >
              {extraccion.map((c, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Input
                    value={c.clave}
                    placeholder="clave"
                    onChange={(e) => editarCampo(i, { clave: e.target.value })}
                    className="w-44"
                  />
                  <div className="w-44 shrink-0">
                    <Select
                      value={c.tipo}
                      onChange={(e) => editarCampo(i, { tipo: e.target.value as TipoExtraccion })}
                    >
                      {TIPOS_EXTRACCION.map((t) => (
                        <option key={t.valor} value={t.valor}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Input
                    value={c.descripcion}
                    placeholder="Qué debe capturar (dile cuándo devolver null)"
                    maxLength={500}
                    onChange={(e) => editarCampo(i, { descripcion: e.target.value })}
                    className="min-w-60 flex-1"
                  />
                  <Button
                    onClick={() => setExtraccion((prev) => prev.filter((_, j) => j !== i))}
                  >
                    Quitar
                  </Button>
                </div>
              ))}
              <Button
                className="self-start"
                onClick={() =>
                  setExtraccion((prev) => [
                    ...prev,
                    { clave: "", tipo: "string", descripcion: "" },
                  ])
                }
              >
                + Campo
              </Button>
            </Island>

            <Button
              variante="primaria"
              className="self-start"
              onClick={guardar}
              disabled={pendiente}
            >
              {pendiente ? "Guardando…" : "Guardar y sincronizar"}
            </Button>
          </div>
        )}

        <div hidden={tab !== "lab"}>
          {labVisitado && (
            <LabVoz agente={agente} llamadasHoy={llamadasHoy} telefoniaLista={telefoniaLista} />
          )}
        </div>

        {tab === "llamadas" && <LlamadasVoz agenteId={agente.id} llamadas={llamadas} />}

        {tab === "tanda" && (
          <div className="flex flex-col gap-4">
            {!telefoniaLista && (
              <Banner>
                Sin número saliente: falta ELEVENLABS_PHONE_NUMBER_ID (es el interruptor
                del piloto — paso 7 del runbook). El widget funciona igual.
              </Banner>
            )}

            <Island titulo="Tanda saliente" className="flex flex-col gap-3 bg-isla-alta/50">
              <p className="text-xs text-tinta-60">
                Un teléfono por línea (o separados por coma). Se llama de a uno; el cap
                diario corta lo que no quepa hoy.
              </p>
              <TextArea
                rows={5}
                value={telefonosTanda}
                onChange={(e) => setTelefonosTanda(e.target.value)}
                placeholder={"+573001234567\n+573007654321"}
              />
              <Button
                variante="primaria"
                className="self-start"
                disabled={pendiente || !telefoniaLista}
                onClick={async () => {
                  const n = telefonosTanda.split(/[\n,]/).filter((t) => t.trim()).length;
                  const ok = await confirmar({
                    titulo: "¿Lanzar la tanda ahora?",
                    mensaje: `${n} ${n === 1 ? "teléfono" : "teléfonos"}; se llama de a uno y el cap corta lo que no quepa hoy.`,
                    accion: "Lanzar",
                  });
                  if (!ok) return;
                  correr(async () => {
                    const r = await lanzarTandaVoz(agente.id, telefonosTanda);
                    if ("error" in r) return r;
                    setTelefonosTanda("");
                    setMensaje(
                      `Tanda enviada: ${r.enviadas} llamadas.` +
                        (r.invalidos.length > 0
                          ? ` Ignorados por formato: ${r.invalidos.join(", ")}.`
                          : ""),
                    );
                    return { error: null };
                  });
                }}
              >
                Lanzar tanda
              </Button>
            </Island>
          </div>
        )}

        {tab === "widget" && (
          <div className="flex flex-col gap-3">
            {!agente.agent_id_eleven ? (
              <Banner>Sincroniza el agente para obtener el snippet.</Banner>
            ) : (
              <>
                <p className="text-xs text-tinta-60">
                  Pega esto en la web del cliente (antes de cerrar el body). El visitante
                  habla con el agente desde el navegador — sin número, sin costo de
                  telefonía.
                </p>
                <pre className="overflow-x-auto rounded-fila bg-isla-alta p-4 text-xs leading-relaxed text-tinta-85">
                  {snippetWidget(agente.agent_id_eleven)}
                </pre>
                <Button
                  className="self-start"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        snippetWidget(agente.agent_id_eleven!),
                      );
                      setError(null);
                      setMensaje("Snippet copiado.");
                    } catch {
                      setMensaje(null);
                      setError(
                        "El navegador no dejó copiar. Selecciona el snippet y cópialo a mano.",
                      );
                    }
                  }}
                >
                  Copiar snippet
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
