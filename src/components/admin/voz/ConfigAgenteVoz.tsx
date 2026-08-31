"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { guardarConfigVoz, marcarAgenteComoZak } from "@/lib/admin/voz-actions";
import type { AgenteVozFila } from "@/lib/admin/voz";
import type { VozEleven } from "@/lib/voz/api";
import { CAMPOS_VOZ, seccionesDe, type CampoVoz, type SeccionesVoz } from "@/lib/voz/guias";
import {
  TIPOS_EXTRACCION,
  type CampoExtraccion,
  type TipoExtraccion,
} from "@/lib/voz/tipos";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/admin/ui/Badge";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input, Select, TextArea } from "@/components/admin/ui/Field";
import { Island } from "@/components/admin/ui/Island";
import { NumeroAgente } from "./NumeroAgente";
import { SelectorVoz } from "./VozView";

type Cliente = { id: string; nombre: string };

/**
 * Configuración del agente, amable a la vista: lo esencial arriba (nombre,
 * voz, saludo), el comportamiento como acordeón (un campo abierto a la vez,
 * los demás muestran su resumen) y lo avanzado plegado — los defaults sirven.
 */
export function ConfigAgenteVoz({
  agente,
  voces,
  clientes,
}: {
  agente: AgenteVozFila;
  voces: VozEleven[] | null;
  clientes: Cliente[];
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState(agente.nombre);
  const [clienteId, setClienteId] = useState(agente.cliente_id ?? "");
  const [voiceId, setVoiceId] = useState(agente.voice_id ?? "");
  const [primerMensaje, setPrimerMensaje] = useState(agente.primer_mensaje ?? "");
  const [secciones, setSecciones] = useState<SeccionesVoz>(seccionesDe(agente.secciones));
  const [extraccion, setExtraccion] = useState<CampoExtraccion[]>(agente.extraccion);
  const [capDiario, setCapDiario] = useState(String(agente.cap_diario));

  const [abierto, setAbierto] = useState<CampoVoz | null>(null);
  const [avanzado, setAvanzado] = useState(false);
  const [marcando, startMarcar] = useTransition();

  function marcarZak() {
    setMensaje(null);
    setError(null);
    startMarcar(async () => {
      try {
        const r = await marcarAgenteComoZak(agente.id);
        if (r.error) setError(r.error);
        else {
          setMensaje("Listo: este agente es la voz de Zak.");
          router.refresh();
        }
      } catch {
        setError("Se perdió la conexión — recarga para ver si quedó marcado.");
      }
    });
  }

  function guardar() {
    setMensaje(null);
    setError(null);
    startTransition(async () => {
      try {
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
        else setMensaje(r.aviso ?? "Guardado y sincronizado con ElevenLabs.");
      } catch {
        setError("Se perdió la conexión — revisa si el guardado llegó antes de reintentar.");
      }
    });
  }

  function editarCampo(i: number, cambios: Partial<CampoExtraccion>) {
    setExtraccion((prev) => prev.map((c, j) => (j === i ? { ...c, ...cambios } : c)));
  }

  return (
    <div className="flex flex-col gap-4">
      <Island titulo="Lo esencial" className="flex flex-col gap-3 bg-isla-alta/50">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Nombre *">
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} />
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
        </div>
        {voces === null ? (
          <Banner>Sin conexión con ElevenLabs: no se puede cambiar la voz ahora.</Banner>
        ) : (
          <Field label="Voz * (con preview para oírla)">
            <SelectorVoz voces={voces} valor={voiceId} onCambio={setVoiceId} />
          </Field>
        )}
        <Field label="Saludo * (por ley se presenta como asistente virtual)">
          <TextArea
            rows={2}
            maxLength={500}
            value={primerMensaje}
            onChange={(e) => setPrimerMensaje(e.target.value)}
          />
        </Field>
      </Island>

      <Island
        titulo="Cómo se comporta"
        acciones={
          <span className="text-xs text-tinta-40">
            las reglas duras van siempre: presentarse como IA, no inventar precios, colgar bien
          </span>
        }
        className="flex flex-col gap-2 bg-isla-alta/50"
      >
        {CAMPOS_VOZ.map(({ campo, titulo, ayuda, placeholder }) => {
          const valor = secciones[campo];
          const estaAbierto = abierto === campo;
          return (
            <div key={campo} className="rounded-fila bg-isla">
              <button
                type="button"
                onClick={() => setAbierto(estaAbierto ? null : campo)}
                className="flex w-full items-center justify-between gap-3 rounded-fila px-4 py-3 text-left transition-colors hover:bg-acento-10"
              >
                <span className="shrink-0 text-sm font-medium text-tinta">{titulo}</span>
                <span className="flex min-w-0 items-center gap-2">
                  {valor.trim() ? (
                    <span className="max-w-72 truncate text-xs text-tinta-40">{valor}</span>
                  ) : (
                    <Badge tono="neutro">Sin definir</Badge>
                  )}
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-tinta-40 transition-transform",
                      estaAbierto && "rotate-180",
                    )}
                  />
                </span>
              </button>
              {estaAbierto && (
                <div className="flex flex-col gap-2 px-4 pb-4">
                  <p className="text-xs text-tinta-60">{ayuda}</p>
                  <TextArea
                    rows={4}
                    maxLength={4000}
                    placeholder={placeholder}
                    value={valor}
                    autoFocus
                    onChange={(e) =>
                      setSecciones((prev) => ({ ...prev, [campo]: e.target.value }))
                    }
                  />
                </div>
              )}
            </div>
          );
        })}
      </Island>

      <Island
        titulo="Avanzado"
        acciones={
          <Button onClick={() => setAvanzado((v) => !v)}>
            {avanzado ? "Ocultar" : "Mostrar"}
          </Button>
        }
        className="flex flex-col gap-3 bg-isla-alta/50"
      >
        {!avanzado ? (
          <p className="text-xs text-tinta-40">
            Cap diario de salientes y qué datos captura por llamada. Los valores por
            defecto funcionan bien.
          </p>
        ) : (
          <>
            <Field label="Cap de llamadas salientes por día (0-500)">
              <Input
                inputMode="numeric"
                value={capDiario}
                onChange={(e) => setCapDiario(e.target.value)}
                className="max-w-40"
              />
            </Field>
            <NumeroAgente
              agenteId={agente.id}
              numeroActual={agente.phone_number_id_eleven}
            />
            <div className="flex flex-wrap items-center gap-3 rounded-fila bg-isla p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-tinta">Voz de Zak</p>
                <p className="text-xs text-tinta-40">
                  El agente que usan el cockpit («Llamar con IA») y el bot de WhatsApp
                  para llamar. Solo uno a la vez.
                </p>
              </div>
              {agente.es_zak ? (
                <Badge tono="cliente">Es la voz de Zak</Badge>
              ) : (
                <Button disabled={marcando} onClick={marcarZak}>
                  {marcando ? "Marcando…" : "Usar como voz de Zak"}
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-tinta-60">
                Extracción de datos por llamada — lead_nombre / lead_telefono /
                lead_detalle crean la venta en el portal del cliente
              </p>
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
                      onChange={(e) =>
                        editarCampo(i, { tipo: e.target.value as TipoExtraccion })
                      }
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
                  <Button onClick={() => setExtraccion((prev) => prev.filter((_, j) => j !== i))}>
                    Quitar
                  </Button>
                </div>
              ))}
              <Button
                className="self-start"
                onClick={() =>
                  setExtraccion((prev) => [...prev, { clave: "", tipo: "string", descripcion: "" }])
                }
              >
                + Campo
              </Button>
            </div>
          </>
        )}
      </Island>

      {error && <Banner variante="error">{error}</Banner>}
      {mensaje && <Banner>{mensaje}</Banner>}

      {/* Sticky dentro del panel scrolleable: guardar siempre a la vista. */}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-fila bg-isla py-2">
        <Button variante="primaria" onClick={guardar} disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar y sincronizar"}
        </Button>
        <span className="text-xs text-tinta-40">
          Cada guardado manda el agente completo a ElevenLabs.
        </span>
      </div>
    </div>
  );
}
