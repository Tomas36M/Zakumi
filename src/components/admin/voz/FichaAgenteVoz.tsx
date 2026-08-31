"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import {
  activarAgenteVoz,
  eliminarAgenteVoz,
  sincronizarAgenteVoz,
} from "@/lib/admin/voz-actions";
import type { AgenteVozFila } from "@/lib/admin/voz";
import type { VozEleven } from "@/lib/voz/api";
import type { LlamadaVoz } from "@/lib/voz/tipos";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import { Tabs } from "@/components/admin/ui/Tabs";
import { ConfigAgenteVoz } from "./ConfigAgenteVoz";
import { LabVoz } from "./LabVoz";
import { LlamadasVoz } from "./LlamadasVoz";
import { TandaVoz } from "./TandaVoz";
import { WidgetVoz } from "./WidgetVoz";

type Cliente = { id: string; nombre: string };
export type Pestana = "config" | "lab" | "llamadas" | "tanda" | "widget";

/**
 * Shell de la ficha: cabecera con las acciones del agente, pestañas, y un
 * panel que scrollea POR DENTRO (cockpit — la página nunca scrollea). El
 * contenido de cada pestaña vive en su propio componente.
 */
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
  const router = useRouter();
  const [tab, setTab] = useState<Pestana>(tabInicial);
  // El lab se monta en la primera visita y NO se desmonta después: destruiría
  // el polling de una prueba en vuelo y cortaría la sesión del widget.
  const [labVisitado, setLabVisitado] = useState(tabInicial === "lab");
  const [operando, startOperar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  const { confirmar, dialogo } = useConfirmar();

  const pestanas: readonly { id: Pestana; label: string }[] = [
    { id: "config", label: "Configuración" },
    { id: "lab", label: "Lab" },
    { id: "llamadas", label: `Llamadas (${llamadas.length})` },
    { id: "tanda", label: "Tanda" },
    { id: "widget", label: "Widget" },
  ];

  function correr(accion: () => Promise<{ error: string | null }>) {
    setAviso(null);
    startOperar(async () => {
      try {
        const r = await accion();
        if (r.error) setAviso(r.error);
        else router.refresh();
      } catch {
        setAviso("Se perdió la conexión — recarga y revisa antes de reintentar.");
      }
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

  async function eliminar() {
    const ok = await confirmar({
      titulo: `¿Eliminar "${agente.nombre}"?`,
      mensaje:
        "Se borra aquí y en ElevenLabs, con TODAS sus llamadas y transcripts. No hay vuelta atrás.",
      accion: "Eliminar",
      peligro: true,
    });
    if (!ok) return;
    setAviso(null);
    startOperar(async () => {
      try {
        const r = await eliminarAgenteVoz(agente.id);
        if (r.error) {
          setAviso(r.error);
          return;
        }
        router.push("/admin/voz");
      } catch {
        setAviso("Se perdió la conexión — recarga y mira si el agente sigue en la lista.");
      }
    });
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
              disabled={operando}
              onClick={() => correr(() => sincronizarAgenteVoz(agente.id))}
            >
              Sincronizar
            </Button>
          )}
          <Button disabled={operando} onClick={() => void alternarEncendido()}>
            {agente.activo ? "Apagar" : "Encender"}
          </Button>
          <Button variante="peligro" disabled={operando} onClick={() => void eliminar()}>
            <Trash2 className="h-4 w-4" /> Eliminar
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

        {aviso && <Banner variante="error">{aviso}</Banner>}

        {/* Cockpit: el panel scrollea por dentro; la página no. */}
        <div className="barra-fina flex flex-col gap-4 min-[900px]:h-[calc(100dvh-13.5rem)] min-[900px]:overflow-y-auto min-[900px]:pr-1">
          {tab === "config" && (
            <ConfigAgenteVoz agente={agente} voces={voces} clientes={clientes} />
          )}
          <div hidden={tab !== "lab"}>
            {labVisitado && (
              <LabVoz agente={agente} llamadasHoy={llamadasHoy} telefoniaLista={telefoniaLista} />
            )}
          </div>
          {tab === "llamadas" && <LlamadasVoz agenteId={agente.id} llamadas={llamadas} />}
          {tab === "tanda" && (
            <TandaVoz agente={agente} llamadasHoy={llamadasHoy} telefoniaLista={telefoniaLista} />
          )}
          {tab === "widget" && <WidgetVoz agentIdEleven={agente.agent_id_eleven} />}
        </div>
      </div>
    </section>
  );
}
