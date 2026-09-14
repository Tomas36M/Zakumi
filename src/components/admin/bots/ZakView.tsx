"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AudioLines, MessageCircle } from "lucide-react";
import { sincronizarEstadosZak } from "@/lib/admin/zak-actions";
import {
  PESTANAS_CHAT,
  PESTANAS_VOZ,
  PESTANA_INICIAL,
  caraDe,
  carasZak,
  type CaraZak,
  type PestanaChat,
  type PestanaVoz,
  type PestanaZak,
} from "@/lib/admin/zak-caras";
import { ID_ZAK, type Instancia, type PromptActivo, type VersionPrompt } from "@/lib/bots/tipos";
import { Banner } from "@/components/admin/ui/Banner";
import { Caras } from "@/components/admin/ui/Caras";
import { Cockpit, CockpitBody } from "@/components/admin/ui/Cockpit";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Tabs } from "@/components/admin/ui/Tabs";
import { useParametroUrl } from "@/components/admin/ui/useParametroUrl";
import type { PlantillaZakFila } from "@/lib/admin/plantillas";
import type { VerticalProspeccion } from "@/lib/admin/zak";
import type { AgenteVozFila } from "@/lib/admin/voz";
import type { VozEleven } from "@/lib/voz/api";
import type { LlamadaVoz } from "@/lib/voz/tipos";
import { Conversaciones } from "./Conversaciones";
import { LabsChat } from "./LabsChat";
import { PlantillasZak } from "./PlantillasZak";
import { PromptEditor } from "./PromptEditor";
import { ZakVoz } from "./ZakVoz";
import type { EstadoVozZak } from "@/components/admin/voz/BotonLlamarZak";

const ICONOS_CARAS = { chat: MessageCircle, voz: AudioLines } as const;

const LABEL_CHAT: Record<(typeof PESTANAS_CHAT)[number], string> = {
  bandeja: "Bandeja",
  plantillas: "Plantillas",
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
  // `tabInicial` (server) manda en el primer render; después la pestaña es
  // estado local y solo se ESCRIBE a la URL, para que el enlace se pueda
  // compartir y una recarga vuelva a la misma pestaña.
  const [tab, setTab] = useState<PestanaZak>(tabInicial);
  const [, ponerTab] = useParametroUrl("tab");
  const [, startSync] = useTransition();
  const syncHecho = useRef(false);
  // El Lab de voz se monta en la primera visita y NO se desmonta después:
  // destruirlo cortaría el polling de una prueba en vuelo.
  const [labVozVisitado, setLabVozVisitado] = useState(tabInicial === "voz-lab");

  const cara = caraDe(tab);

  function sincronizar() {
    startSync(async () => {
      const res = await sincronizarEstadosZak();
      if ("error" in res) return;
      if (res.respondidos + res.interesados > 0) {
        router.refresh();
      }
    });
  }

  // Sync automático UNA vez por visita: la frecuencia natural con la que
  // Tomás abre el cockpit es la frecuencia del sync.
  useEffect(() => {
    if (syncHecho.current) return;
    syncHecho.current = true;
    sincronizar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cambiarCara(nueva: CaraZak) {
    if (nueva === cara) return;
    irA(PESTANA_INICIAL[nueva]);
  }

  function irA(destino: PestanaZak) {
    if (destino === "voz-lab") setLabVozVisitado(true);
    setTab(destino);
    ponerTab(destino);
  }

  const pestanasChat = PESTANAS_CHAT.map((p) => ({
    id: p as PestanaZak,
    label: LABEL_CHAT[p],
  }));

  const pestanasVoz = PESTANAS_VOZ.map((p) => ({
    id: p as PestanaZak,
    label: p === "voz-llamadas" ? `${LABEL_VOZ[p]} (${llamadasVoz.length})` : LABEL_VOZ[p],
  }));

  return (
    <Cockpit>
      <PageHeader
        titulo="Zak"
        coletilla="el cerebro comercial"
        migas={[
          "Zak",
          cara === "voz" && agenteVoz === null
            ? "Voz"
            : cara === "chat"
              ? LABEL_CHAT[tab as PestanaChat]
              : LABEL_VOZ[tab as PestanaVoz],
        ]}
        subtitulo={
          instancia && (
            <>
              {instancia.nombre} ·{" "}
              {instancia.proveedor === "cloud" ? "API oficial de Meta" : "Green API"} · prompt v
              {instancia.prompt_version}
              {!instancia.activo && " · APAGADO"}
            </>
          )
        }
        navegacion={
          <Caras
            caras={carasZak({ vozPendiente: agenteVoz === null })}
            iconos={ICONOS_CARAS}
            activa={cara}
            onCambiar={cambiarCara}
            etiqueta="Las dos caras de Zak"
          />
        }
      />

      {/* Avisos y pestañas: alto natural, siempre a la vista. Fuera del body
          para que el contenido scrollee por debajo. */}
      <div className="flex shrink-0 flex-col gap-4 px-5 pt-4">
        {!instancia && cara === "chat" && (
          <Banner>
            Sin conexión con el bot: se muestra lo último conocido. Recarga en un momento.
          </Banner>
        )}

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
            // Otro deep-link = otra bandeja: remontar en vez de sincronizar props→estado.
            key={telefonoInicial ?? "bandeja"}
            instanciaId={ID_ZAK}
            esZak
            abrirInicial={telefonoInicial}
            verticales={verticales}
            vozZak={vozZak}
            onTickLista={sincronizar}
          />
        )}

        {tab === "plantillas" && <PlantillasZak filas={plantillas} />}

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
