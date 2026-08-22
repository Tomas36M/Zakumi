"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CATALOGO_ZAKUMI, type Servicio } from "@/lib/catalogo";
import { formatearCOP, type TipoProducto } from "@/lib/admin/cartera";
import { crearSolicitud, type EstadoSolicitudForm } from "@/lib/portal/actions";

const INICIAL: EstadoSolicitudForm = { error: null };

type Props = {
  /** Slugs con solicitud en curso (no se puede pedir dos veces). */
  enCurso: string[];
  /** Tipos de producto ya activos del cliente. */
  contratados: TipoProducto[];
};

export function TiendaView({ enCurso, contratados }: Props) {
  const [abierto, setAbierto] = useState<string | null>(null);

  return (
    <div className="app-tienda-grid">
      {CATALOGO_ZAKUMI.map((servicio) => (
        <TarjetaServicio
          key={servicio.slug}
          servicio={servicio}
          solicitado={enCurso.includes(servicio.slug)}
          contratado={contratados.includes(servicio.tipo)}
          abierto={abierto === servicio.slug}
          onAbrir={() =>
            setAbierto((a) => (a === servicio.slug ? null : servicio.slug))
          }
        />
      ))}
    </div>
  );
}

function TarjetaServicio({
  servicio,
  solicitado,
  contratado,
  abierto,
  onAbrir,
}: {
  servicio: Servicio;
  solicitado: boolean;
  contratado: boolean;
  abierto: boolean;
  onAbrir: () => void;
}) {
  const [estado, accion, enviando] = useActionState(crearSolicitud, INICIAL);

  const ciclo =
    servicio.cicloSugerido === "unico"
      ? "pago único"
      : servicio.cicloSugerido === "anual"
        ? "al año"
        : "al mes";

  return (
    <div className="app-servicio">
      <h2 className="app-servicio-nombre">{servicio.nombre}</h2>
      <p className="app-servicio-pitch">{servicio.pitch}</p>
      <p className="app-servicio-precio">
        Desde <strong>{formatearCOP(servicio.tarifaSugerida)}</strong> {ciclo}
      </p>

      {!servicio.disponible ? (
        <div className="app-servicio-pie">
          <span className="app-chip app-chip--neutro">Próximamente</span>
        </div>
      ) : contratado ? (
        <div className="app-servicio-pie">
          <span className="app-chip app-chip--ok">Ya lo tienes</span>
        </div>
      ) : solicitado ? (
        <div className="app-servicio-pie">
          <span className="app-chip">Solicitud en curso</span>
          <Link href="/app/solicitudes" className="app-btn-ghost">
            Ver estado
          </Link>
        </div>
      ) : abierto ? (
        <form action={accion}>
          <input type="hidden" name="servicio" value={servicio.slug} />
          <div className="app-field">
            <label className="app-field-label" htmlFor={`msj-${servicio.slug}`}>
              Cuéntanos de tu negocio
            </label>
            <textarea
              id={`msj-${servicio.slug}`}
              className="app-textarea"
              name="mensaje"
              maxLength={2000}
              placeholder="Qué vendes, dónde estás y qué te gustaría lograr."
              autoFocus
            />
          </div>
          {estado.error && (
            <p className="app-error" role="alert">
              {estado.error}
            </p>
          )}
          <div className="app-servicio-pie">
            <button type="button" className="app-btn-ghost" onClick={onAbrir}>
              Cancelar
            </button>
            <button type="submit" className="app-btn" disabled={enviando}>
              {enviando ? "Enviando…" : "Enviar solicitud"}
            </button>
          </div>
        </form>
      ) : (
        <div className="app-servicio-pie">
          <button type="button" className="app-btn" onClick={onAbrir}>
            Solicitar cotización
          </button>
        </div>
      )}
    </div>
  );
}
