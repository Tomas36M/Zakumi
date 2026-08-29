"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import { guardarPrompt, restaurarVersion } from "@/lib/admin/bots-actions";
import { fechaCorta } from "@/lib/admin/formato";
import type { PromptActivo, VersionPrompt } from "@/lib/bots/tipos";
import { Badge } from "@/components/admin/ui/Badge";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input, TextArea } from "@/components/admin/ui/Field";
import { Island } from "@/components/admin/ui/Island";
import { ListRow } from "@/components/admin/ui/ListRow";

type Props = {
  instanciaId: number;
  prompt: PromptActivo | null;
  versiones: VersionPrompt[];
  onProbarEnLabs: () => void;
};

/**
 * Editor de prompt con control optimista. Cada guardado crea la versión N+1 y
 * la activa; si alguien guardó mientras editabas, el bot devuelve 409 y aquí
 * se abre el diff — nada se pierde nunca: todo queda en el historial.
 */
export function PromptEditor({ instanciaId, prompt, versiones, onProbarEnLabs }: Props) {
  const router = useRouter();
  const [guardando, startGuardar] = useTransition();
  const { confirmar, dialogo } = useConfirmar();

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

  async function restaurar(version: number) {
    const ok = await confirmar({
      titulo: `¿Volver a activar la v${version}?`,
      mensaje: "No se crea versión nueva.",
      accion: "Activar",
    });
    if (!ok) return;
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
    <div className="grid items-start gap-aire min-[900px]:grid-cols-[minmax(0,1fr)_280px]">
      {dialogo}
      <form
        className="flex min-w-0 flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          guardar(baseVersion);
        }}
      >
        {conflicto && (
          <div
            className="flex flex-col gap-3 rounded-fila border border-peligro/30 p-4"
            role="alert"
          >
            <Banner variante="error">
              Se guardó la v{conflicto.activa} mientras editabas. Compara y decide:
            </Banner>
            {conflicto.remoto && (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="min-w-0">
                  <h3 className="mb-1.5 text-xs font-medium text-tinta-60">
                    v{conflicto.activa} (la activa)
                  </h3>
                  <pre className="barra-fina max-h-80 overflow-auto rounded-fila bg-isla-alta p-3 text-xs leading-relaxed whitespace-pre-wrap text-tinta-60">
                    {conflicto.remoto.system_prompt}
                    {"\n\n---\n\n"}
                    {conflicto.remoto.knowledge}
                  </pre>
                </div>
                <div className="min-w-0">
                  <h3 className="mb-1.5 text-xs font-medium text-tinta-60">
                    Tu versión (sin guardar)
                  </h3>
                  <pre className="barra-fina max-h-80 overflow-auto rounded-fila bg-isla-alta p-3 text-xs leading-relaxed whitespace-pre-wrap text-tinta-60">
                    {system}
                    {"\n\n---\n\n"}
                    {knowledge}
                  </pre>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variante="primaria"
                disabled={guardando}
                onClick={() => guardar(conflicto.activa)}
              >
                Guardar la mía encima (crea v{conflicto.activa + 1})
              </Button>
              <Button onClick={() => setConflicto(null)}>Seguir editando</Button>
            </div>
          </div>
        )}

        <Field label="Instrucciones (quién es y cómo se comporta)">
          <TextArea
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            rows={14}
            required
          />
        </Field>

        <Field label="Base de conocimiento (precios, horarios, catálogo)">
          <TextArea
            value={knowledge}
            onChange={(e) => setKnowledge(e.target.value)}
            rows={10}
          />
        </Field>

        <Field label="Notas de esta versión (opcional)">
          <Input
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="qué cambió y por qué"
            maxLength={300}
          />
        </Field>

        {exito && <Banner>{exito}</Banner>}
        {error && <Banner variante="error">{error}</Banner>}

        <div className="flex flex-wrap gap-2">
          <Button
            variante="primaria"
            type="submit"
            disabled={guardando || !system.trim()}
          >
            {guardando ? "Guardando…" : `Guardar y activar (crea v${baseVersion + 1})`}
          </Button>
          <Button onClick={onProbarEnLabs}>Probar en Labs</Button>
        </div>
      </form>

      <Island className="bg-isla-alta/50" titulo="Historial">
        {versiones.length === 0 && (
          <p className="text-sm text-tinta-40">Sin versiones todavía.</p>
        )}
        <ul className="flex flex-col gap-1">
          {versiones.map((v) => (
            <li key={v.version}>
              <ListRow
                interactiva={false}
                className="flex items-start justify-between gap-2"
              >
                <div className="min-w-0 text-sm text-tinta">
                  <strong>v{v.version}</strong>
                  {v.activa && (
                    <Badge tono="vivo" className="ml-1.5">
                      activa
                    </Badge>
                  )}
                  <span className="text-xs text-tinta-40"> · {fechaCorta(v.creado_en)}</span>
                  {v.notas && <p className="text-sm text-tinta-60">{v.notas}</p>}
                </div>
                {!v.activa && (
                  <Button disabled={guardando} onClick={() => void restaurar(v.version)}>
                    Restaurar
                  </Button>
                )}
              </ListRow>
            </li>
          ))}
        </ul>
      </Island>
    </div>
  );
}
