"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { guardarPrompt, restaurarVersion } from "@/lib/admin/bots-actions";
import type { PromptActivo, VersionPrompt } from "@/lib/bots/tipos";

type Props = {
  instanciaId: number;
  prompt: PromptActivo | null;
  versiones: VersionPrompt[];
  onProbarEnLabs: () => void;
};

function fechaCorta(iso: string): string {
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
 * Editor de prompt con control optimista. Cada guardado crea la versión N+1 y
 * la activa; si alguien guardó mientras editabas, el bot devuelve 409 y aquí
 * se abre el diff — nada se pierde nunca: todo queda en el historial.
 */
export function PromptEditor({ instanciaId, prompt, versiones, onProbarEnLabs }: Props) {
  const router = useRouter();
  const [guardando, startGuardar] = useTransition();

  const [system, setSystem] = useState(prompt?.system_prompt ?? "");
  const [knowledge, setKnowledge] = useState(prompt?.knowledge ?? "");
  const [notas, setNotas] = useState("");
  // La versión sobre la que se está editando: viaja como base_version.
  const [baseVersion, setBaseVersion] = useState(prompt?.version ?? 0);

  const [exito, setExito] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflicto, setConflicto] = useState<{
    activa: number;
    remoto: PromptActivo | null;
  } | null>(null);

  function limpiarAvisos() {
    setExito(null);
    setError(null);
  }

  function guardar(base: number) {
    limpiarAvisos();
    startGuardar(async () => {
      const res = await guardarPrompt(instanciaId, {
        system_prompt: system,
        knowledge,
        notas: notas || undefined,
        base_version: base,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      if ("conflicto" in res) {
        // Alguien activó la v X mientras editabas: cargarla para comparar.
        let remoto: PromptActivo | null = null;
        try {
          const r = await fetch(
            `/admin/api/bots/${instanciaId}/prompt?version=${res.conflicto}`,
          );
          if (r.ok) remoto = (await r.json()) as PromptActivo;
        } catch {
          // sin diff remoto igual se puede pisar
        }
        setConflicto({ activa: res.conflicto, remoto });
        return;
      }
      setConflicto(null);
      setBaseVersion(res.version);
      setNotas("");
      setExito(
        `v${res.version} activa. Los chats de WhatsApp la usan en menos de 30 segundos.`,
      );
      router.refresh();
    });
  }

  function restaurar(version: number) {
    if (!window.confirm(`¿Volver a activar la v${version}? No se crea versión nueva.`)) {
      return;
    }
    limpiarAvisos();
    startGuardar(async () => {
      const res = await restaurarVersion(instanciaId, version);
      if (res.error) {
        setError(res.error);
        return;
      }
      setExito(`v${version} activa de nuevo.`);
      router.refresh();
    });
  }

  return (
    <div className="adm-editor-layout">
      <form
        className="adm-editor"
        onSubmit={(e) => {
          e.preventDefault();
          guardar(baseVersion);
        }}
      >
        {conflicto && (
          <div className="adm-editor-conflicto" role="alert">
            <p className="adm-error">
              Se guardó la v{conflicto.activa} mientras editabas. Compara y decide:
            </p>
            {conflicto.remoto && (
              <div className="adm-editor-diff">
                <div>
                  <h3 className="adm-field-label">v{conflicto.activa} (la activa)</h3>
                  <pre className="adm-editor-pre">
                    {conflicto.remoto.system_prompt}
                    {"\n\n---\n\n"}
                    {conflicto.remoto.knowledge}
                  </pre>
                </div>
                <div>
                  <h3 className="adm-field-label">Tu versión (sin guardar)</h3>
                  <pre className="adm-editor-pre">
                    {system}
                    {"\n\n---\n\n"}
                    {knowledge}
                  </pre>
                </div>
              </div>
            )}
            <div className="adm-ficha-acciones">
              <button
                type="button"
                className="adm-cta"
                disabled={guardando}
                onClick={() => guardar(conflicto.activa)}
              >
                Guardar la mía encima (crea v{conflicto.activa + 1})
              </button>
              <button
                type="button"
                className="adm-cta-ghost"
                onClick={() => setConflicto(null)}
              >
                Seguir editando
              </button>
            </div>
          </div>
        )}

        <label className="adm-field">
          <span className="adm-field-label">Instrucciones (quién es y cómo se comporta)</span>
          <textarea
            className="adm-textarea adm-editor-textarea"
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            rows={14}
            required
          />
        </label>

        <label className="adm-field">
          <span className="adm-field-label">
            Base de conocimiento (precios, horarios, catálogo)
          </span>
          <textarea
            className="adm-textarea adm-editor-textarea"
            value={knowledge}
            onChange={(e) => setKnowledge(e.target.value)}
            rows={10}
          />
        </label>

        <label className="adm-field">
          <span className="adm-field-label">Notas de esta versión (opcional)</span>
          <input
            className="adm-input"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="qué cambió y por qué"
            maxLength={300}
          />
        </label>

        {exito && <p className="adm-aviso">{exito}</p>}
        {error && (
          <p className="adm-error" role="alert">
            {error}
          </p>
        )}

        <div className="adm-ficha-acciones">
          <button className="adm-cta" type="submit" disabled={guardando || !system.trim()}>
            {guardando ? "Guardando…" : `Guardar y activar (crea v${baseVersion + 1})`}
          </button>
          <button type="button" className="adm-cta-ghost" onClick={onProbarEnLabs}>
            Probar en Labs
          </button>
        </div>
      </form>

      <aside className="adm-editor-historial">
        <h2 className="adm-field-label">Historial</h2>
        {versiones.length === 0 && (
          <p className="adm-ficha-sin">Sin versiones todavía.</p>
        )}
        <ul className="adm-editor-versiones">
          {versiones.map((v) => (
            <li key={v.version} className="adm-editor-version">
              <div>
                <strong>v{v.version}</strong>
                {v.activa && <span className="adm-editor-activa"> · activa</span>}
                <span className="adm-editor-fecha"> · {fechaCorta(v.creado_en)}</span>
                {v.notas && <p className="adm-editor-notas">{v.notas}</p>}
              </div>
              {!v.activa && (
                <button
                  type="button"
                  className="adm-cta-ghost"
                  disabled={guardando}
                  onClick={() => restaurar(v.version)}
                >
                  Restaurar
                </button>
              )}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
