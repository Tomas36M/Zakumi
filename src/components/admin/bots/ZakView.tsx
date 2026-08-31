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
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Cockpit, CockpitBody } from "@/components/admin/ui/Cockpit";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Island } from "@/components/admin/ui/Island";
import { ListRow } from "@/components/admin/ui/ListRow";
import { Tabs } from "@/components/admin/ui/Tabs";
import { cn } from "@/lib/cn";
import type { PlantillaZakFila } from "@/lib/admin/plantillas";
import type { VerticalProspeccion } from "@/lib/admin/zak";
import { Actividad } from "./Actividad";
import { Conversaciones } from "./Conversaciones";
import { LabsChat } from "./LabsChat";
import { PlantillasZak } from "./PlantillasZak";
import { PromptEditor } from "./PromptEditor";
import { BotonLlamarZak, type EstadoVozZak } from "@/components/admin/voz/BotonLlamarZak";

export type PestanaZak =
  | "bandeja"
  | "interesados"
  | "tandas"
  | "plantillas"
  | "metricas"
  | "prompt"
  | "labs";

const PESTANAS: readonly { valor: PestanaZak; label: string }[] = [
  { valor: "bandeja", label: "Bandeja" },
  { valor: "interesados", label: "Interesados" },
  { valor: "tandas", label: "Tandas" },
  { valor: "plantillas", label: "Plantillas" },
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
  /** El catálogo vivo (tabla plantillas_zak; estático si aún no existe). */
  verticales: VerticalProspeccion[];
  /** Las filas crudas de plantillas_zak para la pestaña Plantillas. */
  plantillas: PlantillaZakFila[];
  /** Estado de la voz de Zak (server): habilita "Llamar con IA". */
  vozZak: EstadoVozZak;
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
  verticales,
  plantillas,
  vozZak,
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

  const pestanas = PESTANAS.map((p) => ({
    id: p.valor,
    label:
      p.valor === "interesados" && interesados.length > 0 ? (
        <span className="inline-flex items-center gap-1.5">
          {p.label}
          <span
            className={cn(
              "rounded-full px-1.5 text-[0.7rem] font-bold",
              tab === "interesados" ? "bg-white/25 text-white" : "bg-acento text-white",
            )}
          >
            {interesados.length}
          </span>
        </span>
      ) : (
        p.label
      ),
  }));

  return (
    <Cockpit>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <div>
          <h1 className="text-lg font-semibold text-tinta">
            Zak{" "}
            <span className="font-editorial text-base font-normal italic text-acento">
              el cerebro comercial
            </span>
          </h1>
          {instancia && (
            <p className="text-xs text-tinta-60">
              {instancia.nombre} · {instancia.proveedor === "cloud" ? "API oficial de Meta" : "Green API"} ·
              prompt v{instancia.prompt_version}
              {!instancia.activo && " · APAGADO"}
            </p>
          )}
        </div>
        {uso && (
          <span className="text-xs text-tinta-40">
            hoy: {uso.llamadas} llamadas · {uso.tokens_entrada + uso.tokens_salida} tokens ·{" "}
            {interesados.length} interesados en total
          </span>
        )}
      </header>

      {/* Avisos y pestañas viven FUERA del body: alto natural, siempre a la
          vista. Si vivieran dentro se irían con el scroll — y su alto variable
          era justo lo que descuadraba el viejo calc(100dvh-13.5rem). */}
      <div className="flex shrink-0 flex-col gap-4 px-5 pt-4">
        {!instancia && (
          <Banner>
            Sin conexión con el bot: se muestra lo último conocido. Recarga en un momento.
          </Banner>
        )}
        {avisoSync && <Banner>{avisoSync}</Banner>}

        <Tabs pestanas={pestanas} activa={tab} onCambiar={setTab} />
      </div>

      <CockpitBody>
        {tab === "bandeja" && (
          <Conversaciones
            instanciaId={ID_ZAK}
            esZak
            abrirInicial={telefonoInicial}
            verticales={verticales}
            vozZak={vozZak}
          />
        )}

        {tab === "interesados" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-tinta-60">
                Negocios que Zak calentó y están listos para que tú cierres.
              </p>
              <Button disabled={sincronizando} onClick={() => sincronizar(false)}>
                {sincronizando ? "Sincronizando…" : "Sincronizar con el CRM"}
              </Button>
            </div>
            {interesados.length === 0 ? (
              <EmptyState
                titulo="Todavía nadie levanta la mano."
                detalle="Manda una tanda desde Negocios y deja que Zak caliente."
              />
            ) : (
              <ul className="flex flex-col">
                {interesados.map((p) => (
                  <li key={p.id}>
                    <ListRow
                      interactiva={false}
                      className="flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <strong className="text-sm font-semibold text-tinta">
                          {p.contexto.nombre ?? p.telefono}
                        </strong>
                        <span className="text-xs text-tinta-40">
                          {" "}· {p.telefono} · {fechaCorta(p.actualizado_en)}
                        </span>
                        <p className="text-xs text-tinta-60">
                          {p.interes_resumen ?? "interés sin detalle"}
                        </p>
                      </div>
                      <span className="flex shrink-0 flex-wrap items-center gap-2">
                        <BotonLlamarZak
                          vozZak={vozZak}
                          telefono={`+${p.telefono}`}
                          nombre={p.contexto.nombre ?? null}
                          negocioId={p.negocio_id}
                        />
                        <Button onClick={() => setTab("bandeja")}>Abrir chat</Button>
                      </span>
                    </ListRow>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "tandas" && (
          <div className="flex flex-col gap-4">
            {tandas.length === 0 && (
              <EmptyState
                titulo="Sin tandas todavía."
                detalle="En Negocios: selecciona prospectos y dale a «Que Zak los contacte»."
              />
            )}
            {tandas.map((t) => {
              const total =
                t.funnel.pendiente + t.funnel.enviado + t.funnel.entregado +
                t.funnel.leido + t.funnel.respondido + t.funnel.fallido;
              return (
                <Island
                  key={t.id}
                  className="bg-isla-alta"
                  titulo={
                    <>
                      Tanda #{t.id} · {fechaCorta(t.creado_en)}
                    </>
                  }
                  acciones={
                    <span className="text-xs text-tinta-40">
                      {t.plantilla} · {total} prospectos
                    </span>
                  }
                >
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-aire">
                      {([
                        ["pendiente", "En cola"],
                        ["enviado", "Enviado"],
                        ["entregado", "Entregado"],
                        ["leido", "Leído"],
                        ["respondido", "Respondió"],
                      ] as const).map(([clave, label]) => (
                        <div key={clave} className="flex flex-col gap-0.5 rounded-fila bg-isla p-3">
                          <span className="text-2xl font-semibold text-tinta">
                            {t.funnel[clave]}
                          </span>
                          <span className="text-xs text-tinta-60">{label}</span>
                        </div>
                      ))}
                      <div className="flex flex-col gap-0.5 rounded-fila bg-acento-10 p-3">
                        <span className="text-2xl font-semibold text-acento">{t.interesados}</span>
                        <span className="text-xs text-tinta-60">Interesados 🧡</span>
                      </div>
                    </div>
                    {t.funnel.fallido > 0 && (
                      <Banner variante="error">
                        {t.funnel.fallido} envío(s) fallidos — si el error menciona la
                        plantilla, revisa que «{t.plantilla}» esté aprobada en Meta.
                      </Banner>
                    )}
                    {t.notas && <p className="text-xs text-tinta-60">{t.notas}</p>}
                  </div>
                </Island>
              );
            })}
          </div>
        )}

        {tab === "plantillas" && (
          <PlantillasZak filas={plantillas} />
        )}

        {tab === "metricas" && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-aire">
              <div className="flex flex-col gap-0.5 rounded-fila bg-isla-alta p-4">
                <span className="text-2xl font-semibold text-tinta">
                  {enviados > 0 ? `${Math.round((respondidos / enviados) * 100)}%` : "—"}
                </span>
                <span className="text-xs text-tinta-60">
                  tasa de respuesta de la prospección ({respondidos}/{enviados})
                </span>
              </div>
              <div className="flex flex-col gap-0.5 rounded-fila bg-isla-alta p-4">
                <span className="text-2xl font-semibold text-tinta">{interesados.length}</span>
                <span className="text-xs text-tinta-60">interesados en total</span>
              </div>
              <div className="flex flex-col gap-0.5 rounded-fila bg-isla-alta p-4">
                <span className="text-2xl font-semibold text-tinta">{tandas.length}</span>
                <span className="text-xs text-tinta-60">tandas enviadas</span>
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
      </CockpitBody>
    </Cockpit>
  );
}
