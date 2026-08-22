"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  activarAgenteVoz,
  guardarConfigVoz,
  lanzarTandaVoz,
  llamadaPruebaVoz,
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
import { SelectorVoz } from "./VozView";
import { LlamadasVoz } from "./LlamadasVoz";

type Cliente = { id: string; nombre: string };
type Tab = "config" | "llamadas" | "llamar" | "widget";

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
}: {
  agente: AgenteVozFila;
  llamadas: LlamadaVoz[];
  llamadasHoy: number;
  voces: VozEleven[] | null;
  clientes: Cliente[];
  telefoniaLista: boolean;
}) {
  const [tab, setTab] = useState<Tab>("config");
  const [pendiente, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Configuración (fuente: la fila; se guarda completa) ---
  const [nombre, setNombre] = useState(agente.nombre);
  const [clienteId, setClienteId] = useState(agente.cliente_id ?? "");
  const [voiceId, setVoiceId] = useState(agente.voice_id ?? "");
  const [primerMensaje, setPrimerMensaje] = useState(agente.primer_mensaje ?? "");
  const [secciones, setSecciones] = useState<SeccionesVoz>(seccionesDe(agente.secciones));
  const [extraccion, setExtraccion] = useState<CampoExtraccion[]>(agente.extraccion);
  const [capDiario, setCapDiario] = useState(String(agente.cap_diario));

  // --- Llamar ---
  const [telPrueba, setTelPrueba] = useState("");
  const [telefonosTanda, setTelefonosTanda] = useState("");

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

  function editarCampo(i: number, cambios: Partial<CampoExtraccion>) {
    setExtraccion((prev) => prev.map((c, j) => (j === i ? { ...c, ...cambios } : c)));
  }

  return (
    <section className="adm-seccion">
      <Link href="/admin/voz" className="adm-bot-volver">
        ← Voz
      </Link>

      <div className="adm-ficha-cabecera">
        <div>
          <h1 className="adm-ficha-nombre">{agente.nombre}</h1>
          <p className="adm-ficha-meta">
            Agente de voz · {agente.cliente_nombre ?? "Demo de Zakumi"} ·{" "}
            {agente.agent_id_eleven ? "Sincronizado con ElevenLabs" : "⚠️ Sin sincronizar"} ·
            hoy {llamadasHoy}/{agente.cap_diario} llamadas
          </p>
        </div>
        <div className="adm-sol-acciones">
          {!agente.agent_id_eleven && (
            <button
              type="button"
              className="adm-cta"
              disabled={pendiente}
              onClick={() => correr(() => sincronizarAgenteVoz(agente.id))}
            >
              Sincronizar
            </button>
          )}
          <button
            type="button"
            className={agente.activo ? "adm-cta adm-cta--peligro" : "adm-cta"}
            disabled={pendiente}
            onClick={() => {
              if (
                agente.activo &&
                !window.confirm("¿Apagar el agente? Dejará de aceptar llamadas nuevas desde el panel.")
              ) {
                return;
              }
              correr(() => activarAgenteVoz(agente.id, !agente.activo));
            }}
          >
            {agente.activo ? "Apagar" : "Encender"}
          </button>
        </div>
      </div>

      <div className="adm-tabs">
        {(
          [
            ["config", "Configuración"],
            ["llamadas", `Llamadas`],
            ["llamar", "Llamar"],
            ["widget", "Widget"],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            className={tab === t ? "adm-tab adm-tab--activa" : "adm-tab"}
            onClick={() => setTab(t)}
          >
            {label}
            {t === "llamadas" && <span className="adm-tab-conteo">{llamadas.length}</span>}
          </button>
        ))}
      </div>

      {error && <p className="adm-aviso">{error}</p>}
      {mensaje && <p className="adm-voz-ok">{mensaje}</p>}

      {tab === "config" && (
        <div className="adm-bot-form">
          <fieldset className="adm-bot-form-grupo">
            <legend className="adm-field-label">Identidad</legend>
            <label className="adm-field">
              <span className="adm-field-label">Nombre *</span>
              <input
                className="adm-input"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={200}
              />
            </label>
            <label className="adm-field">
              <span className="adm-field-label">Cliente (vacío = demo de Zakumi)</span>
              <select
                className="adm-select"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
              >
                <option value="">— Sin cliente (demo) —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="adm-field">
              <span className="adm-field-label">Cap de llamadas por día (0-500)</span>
              <input
                className="adm-input"
                inputMode="numeric"
                value={capDiario}
                onChange={(e) => setCapDiario(e.target.value)}
              />
            </label>
          </fieldset>

          <fieldset className="adm-bot-form-grupo">
            <legend className="adm-field-label">Voz y saludo</legend>
            {voces === null ? (
              <p className="adm-aviso">
                Sin conexión con ElevenLabs: no se puede cambiar la voz ahora.
              </p>
            ) : (
              <SelectorVoz voces={voces} valor={voiceId} onCambio={setVoiceId} />
            )}
            <label className="adm-field">
              <span className="adm-field-label">
                Primer mensaje * (debe presentarse como asistente virtual — obligación legal)
              </span>
              <textarea
                className="adm-textarea"
                rows={2}
                maxLength={500}
                value={primerMensaje}
                onChange={(e) => setPrimerMensaje(e.target.value)}
              />
            </label>
          </fieldset>

          <fieldset className="adm-bot-form-grupo">
            <legend className="adm-field-label">
              Comportamiento (las reglas duras — presentarse como IA, no inventar
              precios, colgar bien — van siempre, esto las personaliza)
            </legend>
            {CAMPOS_VOZ.map(({ campo, titulo, ayuda, placeholder }) => (
              <label key={campo} className="adm-field">
                <span className="adm-field-label">
                  {titulo} <em className="adm-voz-ayuda">{ayuda}</em>
                </span>
                <textarea
                  className="adm-textarea"
                  rows={3}
                  maxLength={4000}
                  placeholder={placeholder}
                  value={secciones[campo]}
                  onChange={(e) =>
                    setSecciones((prev) => ({ ...prev, [campo]: e.target.value }))
                  }
                />
              </label>
            ))}
          </fieldset>

          <fieldset className="adm-bot-form-grupo">
            <legend className="adm-field-label">
              Extracción de datos por llamada (las claves lead_nombre / lead_telefono /
              lead_detalle crean la venta en el portal del cliente)
            </legend>
            {extraccion.map((c, i) => (
              <div key={i} className="adm-voz-campo">
                <input
                  className="adm-input adm-voz-campo-clave"
                  value={c.clave}
                  placeholder="clave"
                  onChange={(e) => editarCampo(i, { clave: e.target.value })}
                />
                <select
                  className="adm-select adm-voz-campo-tipo"
                  value={c.tipo}
                  onChange={(e) => editarCampo(i, { tipo: e.target.value as TipoExtraccion })}
                >
                  {TIPOS_EXTRACCION.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <input
                  className="adm-input adm-voz-campo-desc"
                  value={c.descripcion}
                  placeholder="Qué debe capturar (dile cuándo devolver null)"
                  maxLength={500}
                  onChange={(e) => editarCampo(i, { descripcion: e.target.value })}
                />
                <button
                  type="button"
                  className="adm-cta-ghost"
                  onClick={() => setExtraccion((prev) => prev.filter((_, j) => j !== i))}
                >
                  Quitar
                </button>
              </div>
            ))}
            <button
              type="button"
              className="adm-cta-ghost"
              onClick={() =>
                setExtraccion((prev) => [
                  ...prev,
                  { clave: "", tipo: "string", descripcion: "" },
                ])
              }
            >
              + Campo
            </button>
          </fieldset>

          <button type="button" className="adm-cta" onClick={guardar} disabled={pendiente}>
            {pendiente ? "Guardando…" : "Guardar y sincronizar"}
          </button>
        </div>
      )}

      {tab === "llamadas" && <LlamadasVoz agenteId={agente.id} llamadas={llamadas} />}

      {tab === "llamar" && (
        <div className="adm-bot-form">
          {!telefoniaLista && (
            <p className="adm-aviso">
              Sin número saliente: falta ELEVENLABS_PHONE_NUMBER_ID (es el
              interruptor del piloto — paso 7 del runbook). El widget funciona igual.
            </p>
          )}

          <fieldset className="adm-bot-form-grupo">
            <legend className="adm-field-label">Llamada de prueba</legend>
            <p className="adm-ficha-meta">
              El agente te llama a ti. Cuenta para el cap diario ({llamadasHoy}/
              {agente.cap_diario} hoy) y queda marcada como “Prueba”.
            </p>
            <label className="adm-field">
              <span className="adm-field-label">Tu teléfono</span>
              <input
                className="adm-input"
                value={telPrueba}
                onChange={(e) => setTelPrueba(e.target.value)}
                placeholder="+57 300 123 4567"
              />
            </label>
            <button
              type="button"
              className="adm-cta"
              disabled={pendiente || !telefoniaLista}
              onClick={() =>
                correr(async () => {
                  const r = await llamadaPruebaVoz(agente.id, telPrueba);
                  if (!r.error) setMensaje("Llamando… contesta el teléfono 📞");
                  return r;
                })
              }
            >
              Llamarme
            </button>
          </fieldset>

          <fieldset className="adm-bot-form-grupo">
            <legend className="adm-field-label">Tanda saliente</legend>
            <p className="adm-ficha-meta">
              Un teléfono por línea (o separados por coma). Se llama de a uno; el
              cap diario corta lo que no quepa hoy.
            </p>
            <textarea
              className="adm-textarea"
              rows={5}
              value={telefonosTanda}
              onChange={(e) => setTelefonosTanda(e.target.value)}
              placeholder={"+573001234567\n+573007654321"}
            />
            <button
              type="button"
              className="adm-cta"
              disabled={pendiente || !telefoniaLista}
              onClick={() => {
                if (!window.confirm("¿Lanzar la tanda de llamadas ahora?")) return;
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
            </button>
          </fieldset>
        </div>
      )}

      {tab === "widget" && (
        <div className="adm-bot-form">
          {!agente.agent_id_eleven ? (
            <p className="adm-aviso">Sincroniza el agente para obtener el snippet.</p>
          ) : (
            <>
              <p className="adm-ficha-meta">
                Pega esto en la web del cliente (antes de cerrar el body). El
                visitante habla con el agente desde el navegador — sin número, sin
                costo de telefonía.
              </p>
              <pre className="adm-voz-snippet">{snippetWidget(agente.agent_id_eleven)}</pre>
              <button
                type="button"
                className="adm-cta-ghost"
                onClick={() => {
                  void navigator.clipboard.writeText(snippetWidget(agente.agent_id_eleven!));
                  setMensaje("Snippet copiado.");
                }}
              >
                Copiar snippet
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
