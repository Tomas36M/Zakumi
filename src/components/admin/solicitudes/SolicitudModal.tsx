"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PencilLine, Trash2 } from "lucide-react";
import { formatearCOP } from "@/lib/admin/cartera";
import { fechaCorta } from "@/lib/admin/formato";
import { eliminarSolicitud } from "@/lib/admin/solicitudes-actions";
import { servicioDelSlug } from "@/lib/catalogo";
import { esTerminal, labelEstado, type Solicitud } from "@/lib/portal/solicitudes";
import { Badge } from "@/components/admin/ui/Badge";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import { Modal } from "@/components/admin/ui/Modal";
import { AccionesEstado } from "./AccionesEstado";
import { CitaSolicitud } from "./CitaSolicitud";
import { FormSolicitud } from "./FormSolicitud";
import { CANAL_SOLICITUD, quienPide, TONO_SOLICITUD, type PerfilResumen } from "./solicitud-ui";

type Props = {
  solicitudId: string | null;
  /** Resuelta por el dueño en cada render (id → fila viva). */
  solicitud: Solicitud | null;
  perfil: PerfilResumen | undefined;
  telefonoAviso: string | null;
  onCerrar: () => void;
  onCambio: () => void;
};

/** La ficha de una solicitud: qué piden, la cita, las acciones del ciclo
 * de venta, y editarla o borrarla. */
export function SolicitudModal({ solicitudId, solicitud: s, perfil, telefonoAviso, onCerrar, onCambio }: Props) {
  const { confirmar, dialogo } = useConfirmar();
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, startAccion] = useTransition();

  async function eliminar() {
    if (!s) return;
    const ok = await confirmar({
      titulo: "¿Eliminar esta solicitud?",
      mensaje:
        "Desaparece de la bandeja y de la agenda. Si estaba activa, el producto del cliente NO se borra. No se puede deshacer.",
      accion: "Eliminar",
      peligro: true,
    });
    if (!ok) return;
    setError(null);
    startAccion(async () => {
      const r = await eliminarSolicitud(s.id);
      if (r.error) {
        setError(r.error);
        return;
      }
      onCerrar();
      onCambio();
    });
  }

  const servicio = s ? servicioDelSlug(s.servicio_slug) : null;

  return (
    <Modal
      abierto={solicitudId !== null}
      onCerrar={(a) => {
        if (!a) onCerrar();
      }}
      titulo={servicio?.nombre ?? s?.servicio_slug ?? "Solicitud"}
      descripcion={s ? `${quienPide(s, perfil)} · ${fechaCorta(s.created_at)}` : undefined}
      tamano="ancho"
    >
      {dialogo}
      {s ? (
        <div key={s.id} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {s.origen !== "portal" && (
              <Badge tono={CANAL_SOLICITUD[s.origen].tono}>{CANAL_SOLICITUD[s.origen].label}</Badge>
            )}
            <Badge tono={TONO_SOLICITUD[s.estado]}>{labelEstado(s.estado)}</Badge>
            {s.contacto_email && <span className="text-xs text-tinta-40">{s.contacto_email}</span>}
            {perfil?.clienteId && (
              <Link className="text-sm font-medium text-acento hover:underline" href={`/admin/clientes/${perfil.clienteId}`}>
                ficha 360 →
              </Link>
            )}
            <span className="flex-1" />
            <Button variante={editando ? "primaria" : "fantasma"} disabled={ocupado} onClick={() => setEditando((e) => !e)}>
              <PencilLine className="h-4 w-4" /> {editando ? "Cerrar edición" : "Editar"}
            </Button>
            <Button variante="peligro" disabled={ocupado} onClick={() => void eliminar()}>
              <Trash2 className="h-4 w-4" /> Eliminar
            </Button>
          </div>

          {error && <Banner variante="error">{error}</Banner>}

          {editando ? (
            <FormSolicitud
              solicitud={s}
              onGuardado={() => {
                setEditando(false);
                onCambio();
              }}
              onCancelar={() => setEditando(false)}
            />
          ) : (
            s.mensaje && <p className="text-sm text-tinta-85 italic">“{s.mensaje}”</p>
          )}

          {s.cotizacion_monto !== null && (
            <p className="text-xs text-tinta-60">
              Cotizado: <strong className="text-tinta">{formatearCOP(Number(s.cotizacion_monto))}</strong>
              {s.cotizacion_ciclo ? ` (${s.cotizacion_ciclo})` : ""}
              {s.cotizacion_nota ? ` — ${s.cotizacion_nota}` : ""}
            </p>
          )}
          {s.link_pago && (
            <p className="text-xs text-tinta-60">
              Link: <span className="break-all text-tinta-85">{s.link_pago}</span>
            </p>
          )}

          <CitaSolicitud solicitud={s} telefonoAviso={telefonoAviso} onCambio={onCambio} />

          {!esTerminal(s.estado) && <AccionesEstado solicitud={s} onCambio={onCambio} />}
        </div>
      ) : (
        <Banner variante="error">Esta solicitud no está en la lista cargada. Recarga la página.</Banner>
      )}
    </Modal>
  );
}
