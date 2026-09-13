"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarClock, ExternalLink, Video, X } from "lucide-react";
import { cancelarCita, reprogramarCita, type ResultadoCita } from "@/lib/admin/agenda-actions";
import type { Cita } from "@/lib/agenda/citas";
import type { Cita360 } from "@/lib/agenda/consultas";
import { lineasDeResultado } from "@/lib/agenda/resultado";
import { fechaLegible } from "@/lib/solicitudes/mensaje";
import { Badge } from "@/components/admin/ui/Badge";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Modal } from "@/components/admin/ui/Modal";
import { ConfirmarAviso } from "./ConfirmarAviso";
import { FormCita } from "./FormCita";
import { LABEL_ORIGEN, TONO_ORIGEN } from "./origen";

const LINK =
  "inline-flex h-control items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors";
const LINK_PRIMARIO = `${LINK} bg-acento text-white hover:bg-acento-85`;
const LINK_FANTASMA = `${LINK} bg-isla-alta text-tinta-85 hover:bg-acento-10 hover:text-tinta`;

type Pendiente = { tipo: "reprogramar"; cita: Cita } | { tipo: "cancelar" };

type Props = {
  citaId: string | null;
  /** Resuelta por el dueño en cada render; null tras cancelar (ya no está). */
  cita: Cita360 | null;
  onCerrar: () => void;
  onCambio: () => void;
};

/** La ficha de una cita: detalle, Meet, y mover o cancelar con aviso. */
export function CitaModal({ citaId, cita, onCerrar, onCambio }: Props) {
  const [reprogramando, setReprogramando] = useState(false);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [resultado, setResultado] = useState<ResultadoCita | null>(null);
  const [ocupado, startAccion] = useTransition();

  function cerrar() {
    setReprogramando(false);
    setPendiente(null);
    setResultado(null);
    onCerrar();
  }

  function confirmar(avisar: boolean) {
    if (!pendiente || !citaId) return;
    const accion = pendiente;
    startAccion(async () => {
      const r =
        accion.tipo === "reprogramar"
          ? await reprogramarCita(citaId, accion.cita, avisar)
          : await cancelarCita(citaId, avisar);
      setResultado(r);
      setPendiente(null);
      if ("ok" in r) {
        setReprogramando(false);
        onCambio();
      }
    });
  }

  return (
    <>
      <Modal
        abierto={citaId !== null}
        onCerrar={(a) => {
          if (!a) cerrar();
        }}
        titulo={cita?.nombre ?? (resultado ? "Cita" : "Cita")}
        descripcion={cita ? fechaLegible(cita.inicio) : undefined}
        tamano="ancho"
      >
        <div className="flex flex-col gap-4">
          {resultado &&
            lineasDeResultado(resultado).map((l) => (
              <Banner key={l.texto} variante={l.variante}>
                {l.texto}
              </Banner>
            ))}

          {cita ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tono={TONO_ORIGEN[cita.origen]}>{LABEL_ORIGEN[cita.origen]}</Badge>
                {cita.telefono && <span className="text-sm text-tinta-60">{cita.telefono}</span>}
                {cita.servicio && <span className="text-sm text-tinta-60">· {cita.servicio}</span>}
              </div>
              {cita.detalle && (
                <p className="rounded-fila bg-isla-alta/40 p-3 text-sm text-tinta-85 italic">
                  “{cita.detalle}”
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {cita.meetUrl ? (
                  <a href={cita.meetUrl} target="_blank" rel="noreferrer" className={LINK_PRIMARIO}>
                    <Video className="h-4 w-4" /> Abrir Meet
                  </a>
                ) : (
                  <span className="text-sm text-tinta-60">Sin link de Meet</span>
                )}
                {cita.linkGoogle && (
                  <a href={cita.linkGoogle} target="_blank" rel="noreferrer" className={LINK_FANTASMA}>
                    <ExternalLink className="h-4 w-4" /> Ver en Google
                  </a>
                )}
                <Link href={`/admin/solicitudes?solicitud=${cita.solicitudId}`} className={LINK_FANTASMA}>
                  Ver solicitud
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
                <Button
                  variante={reprogramando ? "primaria" : "fantasma"}
                  disabled={ocupado}
                  onClick={() => setReprogramando((r) => !r)}
                >
                  <CalendarClock className="h-4 w-4" /> Reprogramar
                </Button>
                <Button variante="peligro" disabled={ocupado} onClick={() => setPendiente({ tipo: "cancelar" })}>
                  <X className="h-4 w-4" /> Cancelar cita
                </Button>
              </div>

              {reprogramando && (
                <FormCita
                  key={cita.inicio}
                  inicial={{ inicio: cita.inicio, fin: cita.fin }}
                  etiquetaAccion="Mover la cita"
                  ocupado={ocupado}
                  onConfirmar={(c) => setPendiente({ tipo: "reprogramar", cita: c })}
                  onCancelar={() => setReprogramando(false)}
                />
              )}
            </>
          ) : (
            !resultado && (
              <Banner variante="error">Esta cita ya no está en la semana cargada.</Banner>
            )
          )}

          {resultado && (
            <div className="flex justify-end">
              <Button onClick={cerrar}>Cerrar</Button>
            </div>
          )}
        </div>
      </Modal>

      {cita && pendiente && (
        <ConfirmarAviso
          key={pendiente.tipo}
          abierto
          titulo={pendiente.tipo === "cancelar" ? "¿Cancelar la reunión?" : "¿Mover la reunión?"}
          mensaje={
            pendiente.tipo === "cancelar"
              ? `Se quita la cita del ${fechaLegible(cita.inicio)} y se borra el evento de Google. La solicitud sigue en la bandeja.`
              : `La reunión pasa al ${fechaLegible(pendiente.cita.inicio)}. El evento de Google se mueve y los invitados reciben la actualización.`
          }
          accion={pendiente.tipo === "cancelar" ? "Cancelar la reunión" : "Mover la reunión"}
          peligro={pendiente.tipo === "cancelar"}
          telefonoAviso={cita.telefonoAviso}
          ocupado={ocupado}
          onConfirmar={confirmar}
          onCancelar={() => setPendiente(null)}
        />
      )}
    </>
  );
}
