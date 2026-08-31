"use client";

import { subPestanaVoz, type PestanaVoz } from "@/lib/admin/zak-caras";
import type { AgenteVozFila } from "@/lib/admin/voz";
import type { VozEleven } from "@/lib/voz/api";
import type { LlamadaVoz } from "@/lib/voz/tipos";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { ConfigAgenteVoz } from "@/components/admin/voz/ConfigAgenteVoz";
import { CrearZakVoz } from "@/components/admin/voz/CrearZakVoz";
import { LabVoz } from "@/components/admin/voz/LabVoz";
import { LlamadasVoz } from "@/components/admin/voz/LlamadasVoz";
import { TandaVoz } from "@/components/admin/voz/TandaVoz";
import { WidgetVoz } from "@/components/admin/voz/WidgetVoz";

type Props = {
  tab: PestanaVoz;
  /** El agente es_zak, o null si a Zak todavía no le han dado voz. */
  agente: AgenteVozFila | null;
  llamadas: LlamadaVoz[];
  llamadasHoy: number;
  voces: VozEleven[] | null;
  clientes: { id: string; nombre: string }[];
  telefoniaLista: boolean;
  /** El Lab se monta persistente: ver la nota de abajo. */
  labVisitado: boolean;
};

/**
 * La cara de VOZ de Zak. Reusa tal cual los componentes de la ficha de voz
 * (/admin/voz/[id]) — aquí solo cambia el shell, porque Zak no es un producto
 * que se venda: es el mismo empleado que ya vive en /admin/zak.
 */
export function ZakVoz({
  tab,
  agente,
  llamadas,
  llamadasHoy,
  voces,
  clientes,
  telefoniaLista,
  labVisitado,
}: Props) {
  if (!agente) {
    return voces === null ? (
      <EmptyState
        titulo="No se pudo hablar con ElevenLabs."
        detalle="Sin la lista de voces no se puede crear a Zak. Revisa ELEVENLABS_API_KEY y recarga."
      />
    ) : (
      <CrearZakVoz voces={voces} />
    );
  }

  const sub = subPestanaVoz(tab);

  return (
    <>
      {sub === "config" && (
        <ConfigAgenteVoz agente={agente} voces={voces} clientes={clientes} />
      )}
      {/* El lab NO se desmonta al cambiar de pestaña: destruirlo cortaría el
          polling de una prueba en vuelo y la sesión del widget. */}
      <div hidden={sub !== "lab"}>
        {labVisitado && (
          <LabVoz agente={agente} llamadasHoy={llamadasHoy} telefoniaLista={telefoniaLista} />
        )}
      </div>
      {sub === "llamadas" && <LlamadasVoz agenteId={agente.id} llamadas={llamadas} />}
      {sub === "tanda" && (
        <TandaVoz agente={agente} llamadasHoy={llamadasHoy} telefoniaLista={telefoniaLista} />
      )}
      {sub === "widget" && <WidgetVoz agentIdEleven={agente.agent_id_eleven} />}
    </>
  );
}
