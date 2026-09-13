"use client";

import { useState, useTransition } from "react";
import { CalendarClock, CalendarPlus, ExternalLink, Video, X } from "lucide-react";
import {
  agendarCita,
  cancelarCita,
  reprogramarCita,
  type ResultadoCita,
} from "@/lib/admin/agenda-actions";
import type { Cita } from "@/lib/agenda/citas";
import { lineasDeResultado } from "@/lib/agenda/resultado";
import { fechaLegible } from "@/lib/solicitudes/mensaje";
import type { Solicitud } from "@/lib/portal/solicitudes";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { ConfirmarAviso } from "@/components/admin/agenda/ConfirmarAviso";
import { FormCita } from "@/components/admin/agenda/FormCita";

const LINK =
  "inline-flex h-control items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors";

type Pendiente = { tipo: "agendar" | "reprogramar"; cita: Cita } | { tipo: "cancelar" };

type Props = {
  solicitud: Solicitud;
  /** A qué número se le avisa (E.164) o null si no hay. */
  telefonoAviso: string | null;
  onCambio: () => void;
};

/** La cita de una solicitud: verla, agendarla si no tiene, moverla o
 * cancelarla. Usa las mismas piezas que la agenda. */
export function CitaSolicitud({ solicitud: s, telefonoAviso, onCambio }: Props) {
  const [formulario, setFormulario] = useState<"agendar" | "reprogramar" | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [resultado, setResultado] = useState<ResultadoCita | null>(null);
  const [ocupado, startAccion] = useTransition();
  const rechazada = s.estado === "rechazada";

  function confirmar(avisar: boolean) {
    if (!pendiente) return;
    const accion = pendiente;
    startAccion(async () => {
      const r =
        accion.tipo === "cancelar"
          ? await cancelarCita(s.id, avisar)
          : accion.tipo === "agendar"
            ? await agendarCita(s.id, accion.cita, avisar)
            : await reprogramarCita(s.id, accion.cita, avisar);
      setResultado(r);
      setPendiente(null);
      if ("ok" in r) {
        setFormulario(null);
        onCambio();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-fila bg-isla-alta/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-tinta">
          {s.cita_inicio ? (
            <>📅 {fechaLegible(s.cita_inicio)}</>
          ) : s.cita_texto_crudo ? (
            <>
              📅 Quiere agendar: «{s.cita_texto_crudo}» —{" "}
              <span className="text-tinta-60">sin hora, ponle una tú</span>
            </>
          ) : (
            <span className="text-tinta-60">Sin reunión agendada</span>
          )}
        </span>
        {!rechazada && (
          <span className="flex flex-wrap items-center gap-2">
            {s.cita_inicio ? (
              <>
                <Button
                  className="h-8 px-3 text-xs"
                  variante={formulario === "reprogramar" ? "primaria" : "fantasma"}
                  disabled={ocupado}
                  onClick={() => setFormulario((f) => (f === "reprogramar" ? null : "reprogramar"))}
                >
                  <CalendarClock className="h-3.5 w-3.5" /> Reprogramar
                </Button>
                <Button
                  className="h-8 px-3 text-xs"
                  variante="peligro"
                  disabled={ocupado}
                  onClick={() => setPendiente({ tipo: "cancelar" })}
                >
                  <X className="h-3.5 w-3.5" /> Cancelar cita
                </Button>
              </>
            ) : (
              <Button
                className="h-8 px-3 text-xs"
                variante={formulario === "agendar" ? "primaria" : "fantasma"}
                disabled={ocupado}
                onClick={() => setFormulario((f) => (f === "agendar" ? null : "agendar"))}
              >
                <CalendarPlus className="h-3.5 w-3.5" /> Agendar
              </Button>
            )}
          </span>
        )}
      </div>

      {s.cita_inicio && (s.cita_meet_url || s.cita_link_google) && (
        <div className="flex flex-wrap items-center gap-2">
          {s.cita_meet_url && (
            <a href={s.cita_meet_url} target="_blank" rel="noreferrer" className={`${LINK} bg-acento text-white hover:bg-acento-85`}>
              <Video className="h-4 w-4" /> Abrir Meet
            </a>
          )}
          {s.cita_link_google && (
            <a href={s.cita_link_google} target="_blank" rel="noreferrer" className={`${LINK} bg-isla-alta text-tinta-85 hover:bg-acento-10 hover:text-tinta`}>
              <ExternalLink className="h-4 w-4" /> Ver en Google
            </a>
          )}
        </div>
      )}

      {resultado &&
        lineasDeResultado(resultado).map((l) => (
          <Banner key={l.texto} variante={l.variante}>
            {l.texto}
          </Banner>
        ))}

      {formulario && (
        <FormCita
          key={`${formulario}:${s.cita_inicio ?? ""}`}
          inicial={formulario === "reprogramar" && s.cita_inicio && s.cita_fin ? { inicio: s.cita_inicio, fin: s.cita_fin } : null}
          etiquetaAccion={formulario === "agendar" ? "Agendar" : "Mover la cita"}
          ocupado={ocupado}
          onConfirmar={(cita) => setPendiente({ tipo: formulario, cita })}
          onCancelar={() => setFormulario(null)}
        />
      )}

      {pendiente && (
        <ConfirmarAviso
          key={pendiente.tipo}
          abierto
          titulo={
            pendiente.tipo === "cancelar"
              ? "¿Cancelar la reunión?"
              : pendiente.tipo === "agendar"
                ? "¿Agendar la reunión?"
                : "¿Mover la reunión?"
          }
          mensaje={
            pendiente.tipo === "cancelar"
              ? `Se quita la cita${s.cita_inicio ? ` del ${fechaLegible(s.cita_inicio)}` : ""} y se borra el evento de Google. La solicitud sigue en la bandeja.`
              : `Queda para el ${fechaLegible(pendiente.cita.inicio)}. Se crea o mueve el evento de Google con su Meet.`
          }
          accion={
            pendiente.tipo === "cancelar"
              ? "Cancelar la reunión"
              : pendiente.tipo === "agendar"
                ? "Agendar"
                : "Mover la reunión"
          }
          peligro={pendiente.tipo === "cancelar"}
          telefonoAviso={telefonoAviso}
          ocupado={ocupado}
          onConfirmar={confirmar}
          onCancelar={() => setPendiente(null)}
        />
      )}
    </div>
  );
}
