"use client";

import { useMemo, useState } from "react";
import { Cockpit, CockpitBody } from "@/components/admin/ui/Cockpit";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import type { GrupoAgenda } from "@/lib/agenda/consultas";
import { DetalleCita } from "./DetalleCita";
import { ListaCitas } from "./ListaCitas";

export function AgendaView({ grupos }: { grupos: GrupoAgenda[] }) {
  const todas = useMemo(() => grupos.flatMap((g) => g.citas), [grupos]);

  // Guardamos solo el id (patrón de ClientesView/LlamadasVoz): el panel
  // refresca props del servidor con router.refresh() sin desmontar el
  // árbol, así que el objeto Cita360 completo en el estado quedaría
  // congelado con datos viejos. Derivarlo de `grupos` en cada render
  // garantiza que, si la cita seleccionada se reagenda o cancela, nunca se
  // siga mostrando (ni se pueda pulsar) un Meet que ya no existe.
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(todas[0]?.id ?? null);
  const seleccionada = useMemo(
    () => todas.find((c) => c.id === seleccionadaId) ?? todas[0] ?? null,
    [todas, seleccionadaId],
  );

  return (
    <Cockpit>
      <PageHeader titulo="Agenda" />
      {grupos.length === 0 ? (
        <CockpitBody>
          <EmptyState
            titulo="Nada agendado."
            detalle="Cuando Zak cierre una reunión en una llamada o un chat, aparece aquí con su link de Meet."
          />
        </CockpitBody>
      ) : (
        // El scroll vive DENTRO de cada columna, nunca en la página.
        <div className="grid min-h-0 flex-1 gap-aire px-5 py-4 min-[900px]:grid-cols-[320px_1fr]">
          <div className="barra-fina min-h-0 min-[900px]:overflow-y-auto">
            <ListaCitas
              grupos={grupos}
              seleccionadaId={seleccionada?.id ?? null}
              onElegir={(cita) => setSeleccionadaId(cita.id)}
            />
          </div>
          <div className="barra-fina min-h-0 min-[900px]:overflow-y-auto">
            {seleccionada && <DetalleCita cita={seleccionada} />}
          </div>
        </div>
      )}
    </Cockpit>
  );
}
