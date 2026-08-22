"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { crearAgenteVoz } from "@/lib/admin/voz-actions";
import type { AgenteVozFila } from "@/lib/admin/voz";
import type { VozEleven } from "@/lib/voz/api";
import { seccionesVacias } from "@/lib/voz/guias";

type Cliente = { id: string; nombre: string };

/** Selector de voz con oído: el nombre no dice nada, el preview sí. */
export function SelectorVoz({
  voces,
  valor,
  onCambio,
}: {
  voces: VozEleven[];
  valor: string;
  onCambio: (voiceId: string) => void;
}) {
  const elegida = useMemo(() => voces.find((v) => v.voice_id === valor) ?? null, [voces, valor]);
  return (
    <div className="adm-voz-selector">
      <select
        className="adm-select"
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
      >
        <option value="">Elige una voz…</option>
        {voces.map((v) => (
          <option key={v.voice_id} value={v.voice_id}>
            {v.nombre}
            {v.etiquetas ? ` — ${v.etiquetas}` : ""}
          </option>
        ))}
      </select>
      {elegida?.preview_url && (
        // key: al cambiar de voz el <audio> recarga el preview nuevo.
        <audio key={elegida.voice_id} className="adm-voz-preview" controls preload="none" src={elegida.preview_url} />
      )}
    </div>
  );
}

function NuevoAgenteForm({
  voces,
  clientes,
  onCerrar,
}: {
  voces: VozEleven[];
  clientes: Cliente[];
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [primerMensaje, setPrimerMensaje] = useState(
    "¡Hola, muy buenas! Soy el asistente virtual de …. ¿Con quién tengo el gusto?",
  );

  function crear() {
    setError(null);
    startTransition(async () => {
      const r = await crearAgenteVoz({
        nombre,
        clienteId: clienteId || null,
        voiceId,
        primerMensaje,
        secciones: seccionesVacias(),
        extraccion: [], // la action pone la extracción de lead por defecto
        capDiario: 5,
      });
      if ("error" in r) {
        setError(r.error);
        return;
      }
      router.push(`/admin/voz/${r.id}`);
    });
  }

  return (
    <div className="adm-nuevo-form adm-bot-form">
      <div className="adm-ficha-cabecera">
        <div>
          <h2 className="adm-ficha-nombre">Agente de voz nuevo</h2>
          <p className="adm-ficha-meta">
            Nace con la extracción de lead y las reglas duras puestas; el guion y
            los detalles se afinan en la ficha.
          </p>
        </div>
        <button type="button" className="adm-ficha-cerrar" onClick={onCerrar}>
          Cerrar
        </button>
      </div>

      <fieldset className="adm-bot-form-grupo">
        <legend className="adm-field-label">Identidad</legend>
        <label className="adm-field">
          <span className="adm-field-label">Nombre *</span>
          <input
            className="adm-input"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej.: Recepción Clínica Sonría"
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
      </fieldset>

      <fieldset className="adm-bot-form-grupo">
        <legend className="adm-field-label">Voz y saludo</legend>
        <label className="adm-field">
          <span className="adm-field-label">Voz *</span>
        </label>
        <SelectorVoz voces={voces} valor={voiceId} onCambio={setVoiceId} />
        <label className="adm-field">
          <span className="adm-field-label">
            Primer mensaje * (debe presentarse como asistente virtual)
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

      {error && <p className="adm-aviso">{error}</p>}
      <button type="button" className="adm-cta" onClick={crear} disabled={pendiente}>
        {pendiente ? "Creando…" : "Crear agente"}
      </button>
    </div>
  );
}

export function VozView({
  agentes,
  llamadasHoy,
  voces,
  clientes,
}: {
  agentes: AgenteVozFila[];
  llamadasHoy: Record<string, number>;
  voces: VozEleven[] | null;
  clientes: Cliente[];
}) {
  const [creando, setCreando] = useState(false);

  return (
    <section className="adm-seccion">
      <div className="adm-toolbar">
        <h1 className="adm-titulo">Voz</h1>
        <span className="adm-toolbar-conteo">
          {agentes.length === 1 ? "1 agente" : `${agentes.length} agentes`}
        </span>
        <button
          type="button"
          className="adm-cta"
          onClick={() => setCreando((v) => !v)}
          disabled={voces === null}
        >
          {creando ? "Cancelar" : "Nuevo agente de voz"}
        </button>
      </div>

      {voces === null && (
        <p className="adm-aviso">
          Sin conexión con ElevenLabs — falta ELEVENLABS_API_KEY o el proveedor no
          responde. Los agentes ya creados se listan igual.
        </p>
      )}

      {creando && voces !== null && (
        <NuevoAgenteForm voces={voces} clientes={clientes} onCerrar={() => setCreando(false)} />
      )}

      {agentes.length === 0 && !creando ? (
        <p className="adm-busqueda-vacia">
          Todavía no hay agentes de voz. El primero debería ser la demo de Zakumi:
          créalo sin cliente y pruébalo con el widget antes de venderlo.
        </p>
      ) : (
        <div className="adm-bots-grid">
          {agentes.map((a) => {
            const hoy = llamadasHoy[a.id] ?? 0;
            return (
              <Link key={a.id} href={`/admin/voz/${a.id}`} className="adm-bot-card">
                <div className="adm-bot-cabecera">
                  <span className="adm-bot-nombre">{a.nombre}</span>
                  <span
                    className={
                      a.activo
                        ? "adm-bot-estado adm-bot-estado--activo"
                        : "adm-bot-estado adm-bot-estado--apagado"
                    }
                  >
                    {a.activo ? "Activo" : "Apagado"}
                  </span>
                </div>
                <p className="adm-bot-meta">
                  Voz · {a.cliente_nombre ?? "Demo de Zakumi"}
                </p>
                <p className="adm-bot-meta">
                  {a.agent_id_eleven ? "Sincronizado" : "⚠️ Sin sincronizar"} · hoy{" "}
                  {hoy}/{a.cap_diario} llamadas
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
