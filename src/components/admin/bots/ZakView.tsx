"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sincronizarEstadosZak } from "@/lib/admin/zak-actions";
import { fechaCorta } from "@/lib/admin/formato";
import {
  ID_ZAK,
  type Instancia,
  type PromptActivo,
  type Prospecto,
  type StatusInstancia,
  type Tanda,
  type VersionPrompt,
} from "@/lib/bots/tipos";
import { Actividad } from "./Actividad";
import { Conversaciones } from "./Conversaciones";
import { LabsChat } from "./LabsChat";
import { PromptEditor } from "./PromptEditor";

export type PestanaZak =
  | "bandeja"
  | "interesados"
  | "tandas"
  | "metricas"
  | "prompt"
  | "labs";

const PESTANAS: readonly { valor: PestanaZak; label: string }[] = [
  { valor: "bandeja", label: "Bandeja" },
  { valor: "interesados", label: "Interesados" },
  { valor: "tandas", label: "Tandas" },
  { valor: "metricas", label: "Métricas" },
  { valor: "prompt", label: "Prompt" },
  { valor: "labs", label: "Labs" },
] as const;

type Props = {
  instancia: Instancia | null;
  prompt: PromptActivo | null;
  versiones: VersionPrompt[];
  status: StatusInstancia | null;
  tandas: Tanda[];
  prospectos: Prospecto[];
  tabInicial: PestanaZak;
  /** Deep-link desde el CRM: abrir la bandeja directo en este chat. */
  telefonoInicial?: string | null;
};

/**
 * El cockpit de Zak: el agente de Zakumi con su bandeja, sus interesados,
 * el funnel de prospección y su configuración. Los bots de /admin/bots son
 * productos vendibles; este es el motor del negocio.
 */
export function ZakView({
  instancia,
  prompt,
  versiones,
  status,
  tandas,
  prospectos,
  tabInicial,
  telefonoInicial = null,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<PestanaZak>(tabInicial);
  const [sincronizando, startSync] = useTransition();
  const [avisoSync, setAvisoSync] = useState<string | null>(null);
  const syncHecho = useRef(false);

  function sincronizar(silencioso: boolean) {
    startSync(async () => {
      const res = await sincronizarEstadosZak();
      if ("error" in res) {
        if (!silencioso) setAvisoSync(res.error);
        return;
      }
      if (res.respondidos + res.interesados > 0) {
        setAvisoSync(
          `CRM al día: ${res.respondidos} pasaron a Respondió y ${res.interesados} a Interesado.`,
        );
        router.refresh();
      } else if (!silencioso) {
        setAvisoSync("El CRM ya estaba al día con la prospección.");
      }
    });
  }

  // Sync automático UNA vez por visita: la frecuencia natural con la que
  // Tomás abre el cockpit es la frecuencia del sync.
  useEffect(() => {
    if (syncHecho.current) return;
    syncHecho.current = true;
    sincronizar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const interesados = prospectos.filter((p) => p.interesado);
  const uso = status?.uso_hoy;

  // Tasa de respuesta agregada de la prospección (los fallidos no cuentan
  // como enviados; los pendientes todavía no salieron).
  const enviados = tandas.reduce(
    (t, x) => t + x.funnel.enviado + x.funnel.entregado + x.funnel.leido + x.funnel.respondido,
    0,
  );
  const respondidos = tandas.reduce((t, x) => t + x.funnel.respondido, 0);

  return (
    <section className="adm-seccion">
      <div className="adm-toolbar">
        <div>
          <h1 className="adm-titulo">
            Zak <span className="adm-zak-rol">el cerebro comercial</span>
          </h1>
          {instancia && (
            <p className="adm-bot-meta">
              {instancia.nombre} · {instancia.proveedor === "cloud" ? "API oficial de Meta" : "Green API"} ·
              prompt v{instancia.prompt_version}
              {!instancia.activo && " · APAGADO"}
            </p>
          )}
        </div>
        {uso && (
          <span className="adm-toolbar-conteo">
            hoy: {uso.llamadas} llamadas · {uso.tokens_entrada + uso.tokens_salida} tokens ·{" "}
            {interesados.length} interesados en total
          </span>
        )}
      </div>

      {!instancia && (
        <p className="adm-aviso">
          Sin conexión con el bot: se muestra lo último conocido. Recarga en un momento.
        </p>
      )}
      {avisoSync && (
        <p className="adm-aviso" role="status">
          {avisoSync}
        </p>
      )}

      <div className="adm-tabs" role="tablist">
        {PESTANAS.map((p) => (
          <button
            key={p.valor}
            type="button"
            role="tab"
            aria-selected={tab === p.valor}
            className={tab === p.valor ? "adm-tab adm-tab--activa" : "adm-tab"}
            onClick={() => setTab(p.valor)}
          >
            {p.label}
            {p.valor === "interesados" && interesados.length > 0 && (
              <span className="adm-tab-conteo">{interesados.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "bandeja" && (
        <Conversaciones instanciaId={ID_ZAK} esZak abrirInicial={telefonoInicial} />
      )}

      {tab === "interesados" && (
        <div className="adm-zak-interesados">
          <div className="adm-conv-cabecera">
            <p className="adm-ficha-meta">
              Negocios que Zak calentó y están listos para que tú cierres.
            </p>
            <button
              type="button"
              className="adm-cta-ghost"
              disabled={sincronizando}
              onClick={() => sincronizar(false)}
            >
              {sincronizando ? "Sincronizando…" : "Sincronizar con el CRM"}
            </button>
          </div>
          {interesados.length === 0 ? (
            <p className="adm-ficha-sin">
              Todavía nadie levanta la mano. Manda una tanda desde Negocios y
              deja que Zak caliente.
            </p>
          ) : (
            <ul className="adm-editor-versiones">
              {interesados.map((p) => (
                <li key={p.id} className="adm-editor-version">
                  <div>
                    <strong>{p.contexto.nombre ?? p.telefono}</strong>
                    <span className="adm-editor-fecha">
                      {" "}· {p.telefono} · {fechaCorta(p.actualizado_en)}
                    </span>
                    <p className="adm-editor-notas">
                      {p.interes_resumen ?? "interés sin detalle"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="adm-cta-ghost"
                    onClick={() => setTab("bandeja")}
                  >
                    Abrir chat
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "tandas" && (
        <div className="adm-zak-tandas">
          {tandas.length === 0 && (
            <p className="adm-ficha-sin">
              Sin tandas todavía. En Negocios: selecciona prospectos y dale a
              «Que Zak los contacte».
            </p>
          )}
          {tandas.map((t) => {
            const total =
              t.funnel.pendiente + t.funnel.enviado + t.funnel.entregado +
              t.funnel.leido + t.funnel.respondido + t.funnel.fallido;
            return (
              <article key={t.id} className="adm-zak-tanda">
                <header className="adm-conv-cabecera">
                  <h2 className="adm-360-oportunidad-nombre">
                    Tanda #{t.id} · {fechaCorta(t.creado_en)}
                  </h2>
                  <span className="adm-editor-fecha">
                    {t.plantilla} · {total} prospectos
                  </span>
                </header>
                <div className="adm-zak-funnel">
                  {([
                    ["pendiente", "En cola"],
                    ["enviado", "Enviado"],
                    ["entregado", "Entregado"],
                    ["leido", "Leído"],
                    ["respondido", "Respondió"],
                  ] as const).map(([clave, label]) => (
                    <div key={clave} className="adm-cifra-bloque">
                      <span className="adm-cifra">{t.funnel[clave]}</span>
                      <span className="adm-cifra-label">{label}</span>
                    </div>
                  ))}
                  <div className="adm-cifra-bloque adm-zak-funnel--interes">
                    <span className="adm-cifra">{t.interesados}</span>
                    <span className="adm-cifra-label">Interesados 🧡</span>
                  </div>
                </div>
                {t.funnel.fallido > 0 && (
                  <p className="adm-error">
                    {t.funnel.fallido} envío(s) fallidos — si el error menciona la
                    plantilla, revisa que «{t.plantilla}» esté aprobada en Meta.
                  </p>
                )}
                {t.notas && <p className="adm-editor-notas">{t.notas}</p>}
              </article>
            );
          })}
        </div>
      )}

      {tab === "metricas" && (
        <div className="adm-zak-metricas">
          <div className="adm-actividad-cifras">
            <div className="adm-cifra-bloque">
              <span className="adm-cifra">
                {enviados > 0 ? `${Math.round((respondidos / enviados) * 100)}%` : "—"}
              </span>
              <span className="adm-cifra-label">
                tasa de respuesta de la prospección ({respondidos}/{enviados})
              </span>
            </div>
            <div className="adm-cifra-bloque">
              <span className="adm-cifra">{interesados.length}</span>
              <span className="adm-cifra-label">interesados en total</span>
            </div>
            <div className="adm-cifra-bloque">
              <span className="adm-cifra">{tandas.length}</span>
              <span className="adm-cifra-label">tandas enviadas</span>
            </div>
          </div>
          <Actividad instanciaId={ID_ZAK} />
        </div>
      )}

      {tab === "prompt" && (
        <PromptEditor
          instanciaId={ID_ZAK}
          prompt={prompt}
          versiones={versiones}
          onProbarEnLabs={() => setTab("labs")}
        />
      )}

      {tab === "labs" && (
        <LabsChat
          instanciaId={ID_ZAK}
          prompt={prompt}
          onEditarPrompt={() => setTab("prompt")}
        />
      )}
    </section>
  );
}
