"use client";

import { useRouter } from "next/navigation";
import type { Cita360 } from "@/lib/agenda/consultas";
import { lunesDe, rangoSemana } from "@/lib/agenda/semana";
import { Cockpit, CockpitBody } from "@/components/admin/ui/Cockpit";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { useParametroUrl } from "@/components/admin/ui/useParametroUrl";
import { NavegacionSemana } from "./Calendario/NavegacionSemana";
import { Semana } from "./Calendario/Semana";
import { CitaModal } from "./CitaModal";
import { useAhora } from "./useAhora";

type Props = {
  /** Las citas de la semana visible (pasadas incluidas). */
  citas: Cita360[];
  /** El lunes de la semana visible, "YYYY-MM-DD". */
  lunes: string;
  /** Hoy en Bogotá, decidido en el servidor. */
  hoy: string;
  ahoraIso: string;
};

/**
 * La agenda: una semana tipo calendario con las reuniones que Zak (o la
 * tienda) consiguió. Solo citas de Zakumi — el resto del calendario de
 * Google no se lee. Cada cita abre su ficha (`?cita=<id>`) para moverla o
 * cancelarla, avisándole al lead.
 */
export function AgendaView({ citas, lunes, hoy, ahoraIso }: Props) {
  const router = useRouter();
  const rango = rangoSemana(lunes, hoy);
  const ahora = useAhora(ahoraIso);
  const [citaId, abrirCita] = useParametroUrl("cita");
  const citaAbierta = citaId ? (citas.find((c) => c.id === citaId) ?? null) : null;

  return (
    <Cockpit>
      <PageHeader
        titulo="Agenda"
        coletilla="las reuniones de Zak"
        migas={["Agenda"]}
        navegacion={<NavegacionSemana rango={rango} lunesDeHoy={lunesDe(hoy)} />}
        contador={
          citas.length === 0 ? (
            "sin citas esta semana"
          ) : (
            <>
              <strong className="text-tinta-85">{citas.length}</strong>{" "}
              {citas.length === 1 ? "cita" : "citas"} esta semana
            </>
          )
        }
      />

      <CockpitBody>
        <Semana
          citas={citas}
          rango={rango}
          ahoraIso={ahora}
          citaAbierta={citaId}
          onAbrir={abrirCita}
        />
      </CockpitBody>

      <CitaModal
        citaId={citaId}
        cita={citaAbierta}
        onCerrar={() => abrirCita(null)}
        onCambio={() => router.refresh()}
      />
    </Cockpit>
  );
}
