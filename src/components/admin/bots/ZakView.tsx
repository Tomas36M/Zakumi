"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sincronizarEstadosZak } from "@/lib/admin/zak-actions";
import {
  PESTANAS_CHAT,
  PESTANAS_VOZ,
  PESTANA_INICIAL,
  caraDe,
  type CaraZak,
  type PestanaVoz,
  type PestanaZak,
} from "@/lib/admin/zak-caras";
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
import { Cockpit, CockpitBody } from "@/components/admin/ui/Cockpit";
import { Tabs } from "@/components/admin/ui/Tabs";
import { cn } from "@/lib/cn";
import type { PlantillaZakFila } from "@/lib/admin/plantillas";
import type { VerticalProspeccion } from "@/lib/admin/zak";
import type { AgenteVozFila } from "@/lib/admin/voz";
import type { VozEleven } from "@/lib/voz/api";
import type { LlamadaVoz } from "@/lib/voz/tipos";
import { Conversaciones } from "./Conversaciones";
import { InteresadosZak } from "./InteresadosZak";
import { LabsChat } from "./LabsChat";
import { MetricasZak } from "./MetricasZak";
import { PlantillasZak } from "./PlantillasZak";
import { PromptEditor } from "./PromptEditor";
import { TandasZak } from "./TandasZak";
import { CarasZak } from "./CarasZak";
import { ZakVoz } from "./ZakVoz";
import type { EstadoVozZak } from "@/components/admin/voz/BotonLlamarZak";

const LABEL_CHAT: Record<(typeof PESTANAS_CHAT)[number], string> = {
  bandeja: "Bandeja",
  interesados: "Interesados",
  tandas: "Tandas",
  plantillas: "Plantillas",
  metricas: "Métricas",
  prompt: "Prompt",
  labs: "Labs",
};

const LABEL_VOZ: Record<PestanaVoz, string> = {
  "voz-config": "Configuración",
  "voz-lab": "Lab",
  "voz-llamadas": "Llamadas",
  "voz-tanda": "Tanda",
  "voz-widget": "Widget",
};

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
  /** La cara de Voz: el agente es_zak y lo que necesitan sus pestañas. */
  agenteVoz: AgenteVozFila | null;
  llamadasVoz: LlamadaVoz[];
  llamadasVozHoy: number;
  voces: VozEleven[] | null;
  clientes: { id: string; nombre: string }[];
  telefoniaLista: boolean;
};

/**
 * El cockpit de Zak: el mismo empleado con sus DOS caras — el chatbot de
 * WhatsApp (bandeja, prospección, prompt) y el agente de voz (llamadas).
 * /admin/bots y /admin/voz quedan para lo que se le VENDE a clientes.
 *
 * Este componente es solo el shell: cada pestaña vive en su propio archivo.
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
  agenteVoz,
  llamadasVoz,
  llamadasVozHoy,
  voces,
  clientes,
  telefoniaLista,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<PestanaZak>(tabInicial);
  const [sincronizando, startSync] = useTransition();
  const [avisoSync, setAvisoSync] = useState<string | null>(null);
  const syncHecho = useRef(false);
  // El Lab de voz se monta en la primera visita y NO se desmonta después:
  // destruirlo cortaría el polling de una prueba en vuelo.
  const [labVozVisitado, setLabVozVisitado] = useState(tabInicial === "voz-lab");

  const cara = caraDe(tab);

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

  const interesados = useMemo(() => prospectos.filter((p) => p.interesado), [prospectos]);
  const uso = status?.uso_hoy;

  // Tasa de respuesta agregada de la prospección (los fallidos no cuentan
  // como enviados; los pendientes todavía no salieron).
  const enviados = tandas.reduce(
    (t, x) => t + x.funnel.enviado + x.funnel.entregado + x.funnel.leido + x.funnel.respondido,
    0,
  );
  const respondidos = tandas.reduce((t, x) => t + x.funnel.respondido, 0);

  function cambiarCara(nueva: CaraZak) {
    if (nueva === cara) return;
    irA(PESTANA_INICIAL[nueva]);
  }

  function irA(destino: PestanaZak) {
    if (destino === "voz-lab") setLabVozVisitado(true);
    setTab(destino);
  }

  const pestanasChat = PESTANAS_CHAT.map((p) => ({
    id: p as PestanaZak,
    label:
      p === "interesados" && interesados.length > 0 ? (
        <span className="inline-flex items-center gap-1.5">
          {LABEL_CHAT[p]}
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
        LABEL_CHAT[p]
      ),
  }));

  const pestanasVoz = PESTANAS_VOZ.map((p) => ({
    id: p as PestanaZak,
    label: p === "voz-llamadas" ? `${LABEL_VOZ[p]} (${llamadasVoz.length})` : LABEL_VOZ[p],
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
              {instancia.nombre} ·{" "}
              {instancia.proveedor === "cloud" ? "API oficial de Meta" : "Green API"} · prompt v
              {instancia.prompt_version}
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

      {/* Caras, avisos y pestañas: alto natural, siempre a la vista. Fuera del
          body para que el contenido scrollee por debajo. */}
      <div className="flex shrink-0 flex-col gap-4 px-5 pt-4">
        <CarasZak activa={cara} onCambiar={cambiarCara} vozPendiente={agenteVoz === null} />

        {!instancia && cara === "chat" && (
          <Banner>
            Sin conexión con el bot: se muestra lo último conocido. Recarga en un momento.
          </Banner>
        )}
        {avisoSync && <Banner>{avisoSync}</Banner>}

        {/* Sin agente de voz no hay pestañas que enseñar: solo el alta. */}
        {(cara === "chat" || agenteVoz !== null) && (
          <Tabs
            pestanas={cara === "chat" ? pestanasChat : pestanasVoz}
            activa={tab}
            onCambiar={irA}
          />
        )}
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
          <InteresadosZak
            interesados={interesados}
            vozZak={vozZak}
            sincronizando={sincronizando}
            onSincronizar={() => sincronizar(false)}
            onAbrirChat={() => irA("bandeja")}
          />
        )}

        {tab === "tandas" && <TandasZak tandas={tandas} />}

        {tab === "plantillas" && <PlantillasZak filas={plantillas} />}

        {tab === "metricas" && (
          <MetricasZak
            enviados={enviados}
            respondidos={respondidos}
            interesados={interesados.length}
            tandas={tandas.length}
          />
        )}

        {tab === "prompt" && (
          <PromptEditor
            instanciaId={ID_ZAK}
            prompt={prompt}
            versiones={versiones}
            onProbarEnLabs={() => irA("labs")}
          />
        )}

        {tab === "labs" && (
          <LabsChat instanciaId={ID_ZAK} prompt={prompt} onEditarPrompt={() => irA("prompt")} />
        )}

        {cara === "voz" && (
          <ZakVoz
            tab={tab as PestanaVoz}
            agente={agenteVoz}
            llamadas={llamadasVoz}
            llamadasHoy={llamadasVozHoy}
            voces={voces}
            clientes={clientes}
            telefoniaLista={telefoniaLista}
            labVisitado={labVozVisitado}
          />
        )}
      </CockpitBody>
    </Cockpit>
  );
}
