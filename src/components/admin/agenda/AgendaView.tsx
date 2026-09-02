"use client";

import { useState } from "react";
import { Cockpit, CockpitBody } from "@/components/admin/ui/Cockpit";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import type { Cita360, GrupoAgenda } from "@/lib/agenda/consultas";
import { DetalleCita } from "./DetalleCita";
import { ListaCitas } from "./ListaCitas";

export function AgendaView({ grupos }: { grupos: GrupoAgenda[] }) {
  const primera = grupos[0]?.citas[0] ?? null;
  const [seleccionada, setSeleccionada] = useState<Cita360 | null>(primera);

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
              onElegir={setSeleccionada}
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
