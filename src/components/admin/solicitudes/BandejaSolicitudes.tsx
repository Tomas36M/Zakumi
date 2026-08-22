"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CICLOS, formatearCOP, type Ciclo } from "@/lib/admin/cartera";
import {
  activarSolicitud,
  cotizarSolicitud,
  marcarLinkEnviado,
  rechazarSolicitud,
} from "@/lib/admin/solicitudes-actions";
import { servicioDelSlug } from "@/lib/catalogo";
import {
  esTerminal,
  labelEstado,
  type Solicitud,
} from "@/lib/portal/solicitudes";

export type PerfilResumen = {
  email: string | null;
  nombre: string | null;
  clienteId: string | null;
};

type Props = {
  solicitudes: Solicitud[];
  perfiles: Record<string, PerfilResumen>;
};

export function BandejaSolicitudes({ solicitudes, perfiles }: Props) {
  const abiertas = solicitudes.filter((s) => !esTerminal(s.estado));
  const cerradas = solicitudes.filter((s) => esTerminal(s.estado)).slice(0, 20);

  if (solicitudes.length === 0) {
    return (
      <p className="adm-ficha-sin">
        Nada por ahora. Cuando alguien pida un servicio en el portal, aparece
        aquí (y te llega el aviso por WhatsApp).
      </p>
    );
  }

  return (
    <>
      <div className="adm-sol-lista">
        {abiertas.length === 0 ? (
          <p className="adm-ficha-sin">Sin solicitudes por atender.</p>
        ) : (
          abiertas.map((s) => (
            <TarjetaSolicitud key={s.id} solicitud={s} perfil={perfiles[s.user_id]} />
          ))
        )}
      </div>

      {cerradas.length > 0 && (
        <>
          <h2 className="adm-field-label adm-sol-cerradas">Cerradas recientes</h2>
          <div className="adm-sol-lista">
            {cerradas.map((s) => (
              <TarjetaSolicitud key={s.id} solicitud={s} perfil={perfiles[s.user_id]} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  }).format(new Date(iso));
}

function TarjetaSolicitud({
  solicitud: s,
  perfil,
}: {
  solicitud: Solicitud;
  perfil: PerfilResumen | undefined;
}) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, startTransition] = useTransition();
  const servicio = servicioDelSlug(s.servicio_slug);
  const quien = perfil?.nombre || perfil?.email || "sin perfil";

  function correr(accion: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const r = await accion();
      if (r.error) setError(r.error);
    });
  }

  return (
    <article className="adm-sol-card">
      <header className="adm-sol-cabecera">
        <div>
          <strong>{servicio?.nombre ?? s.servicio_slug}</strong>
          <span className="adm-ficha-meta"> · {quien}</span>
          {perfil?.clienteId && (
            <Link
              className="adm-sol-vinculo"
              href={`/admin/clientes/${perfil.clienteId}`}
            >
              ficha 360 →
            </Link>
          )}
        </div>
        <div className="adm-sol-meta">
          <span className={`adm-sol-estado adm-sol-estado--${s.estado}`}>
            {labelEstado(s.estado)}
          </span>
          <span className="adm-ficha-meta">{fechaCorta(s.created_at)}</span>
        </div>
      </header>

      {s.mensaje && <p className="adm-sol-mensaje">“{s.mensaje}”</p>}

      {s.cotizacion_monto !== null && (
        <p className="adm-ficha-meta">
          Cotizado: <strong>{formatearCOP(Number(s.cotizacion_monto))}</strong>
          {s.cotizacion_ciclo ? ` (${s.cotizacion_ciclo})` : ""}
          {s.cotizacion_nota ? ` — ${s.cotizacion_nota}` : ""}
        </p>
      )}
      {s.link_pago && (
        <p className="adm-ficha-meta">
          Link: <span className="adm-sol-link">{s.link_pago}</span>
        </p>
      )}

      {error && (
        <p className="adm-error" role="alert">
          {error}
        </p>
      )}

      {s.estado === "nueva" && (
        <FormCotizar
          ocupado={ocupado}
          sugerida={servicio?.tarifaSugerida ?? 0}
          cicloSugerido={servicio?.cicloSugerido ?? "mensual"}
          onCotizar={(monto, ciclo, nota) =>
            correr(() => cotizarSolicitud(s.id, { monto, ciclo, nota }))
          }
          onRechazar={(motivo) => correr(() => rechazarSolicitud(s.id, motivo))}
        />
      )}

      {s.estado === "cotizada" && (
        <FormLink
          ocupado={ocupado}
          onEnviar={(link) => correr(() => marcarLinkEnviado(s.id, link))}
          onRechazar={(motivo) => correr(() => rechazarSolicitud(s.id, motivo))}
        />
      )}

      {(s.estado === "link_enviado" || s.estado === "pagada") && (
        <div className="adm-sol-acciones">
          <button
            type="button"
            className="adm-cta"
            disabled={ocupado}
            onClick={() => {
              if (
                window.confirm(
                  "¿Confirmas que el pago llegó? Esto crea el cliente y su producto, registra el primer pago y activa el servicio.",
                )
              ) {
                correr(() => activarSolicitud(s.id));
              }
            }}
          >
            {ocupado ? "Activando…" : "Confirmar pago y activar"}
          </button>
          <BotonRechazar
            ocupado={ocupado}
            onRechazar={(motivo) => correr(() => rechazarSolicitud(s.id, motivo))}
          />
        </div>
      )}
    </article>
  );
}

function FormCotizar({
  ocupado,
  sugerida,
  cicloSugerido,
  onCotizar,
  onRechazar,
}: {
  ocupado: boolean;
  sugerida: number;
  cicloSugerido: Ciclo;
  onCotizar: (monto: number, ciclo: Ciclo, nota: string) => void;
  onRechazar: (motivo: string) => void;
}) {
  const [monto, setMonto] = useState(sugerida > 0 ? String(sugerida) : "");
  const [ciclo, setCiclo] = useState<Ciclo>(cicloSugerido);
  const [nota, setNota] = useState("");

  return (
    <div className="adm-sol-form">
      <label className="adm-field">
        <span className="adm-field-label">Monto (COP)</span>
        <input
          className="adm-input"
          inputMode="numeric"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
        />
      </label>
      <label className="adm-field">
        <span className="adm-field-label">Ciclo</span>
        <select
          className="adm-select"
          value={ciclo}
          onChange={(e) => setCiclo(e.target.value as Ciclo)}
        >
          {CICLOS.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="adm-field adm-sol-nota">
        <span className="adm-field-label">Nota para el cliente (opcional)</span>
        <input
          className="adm-input"
          value={nota}
          maxLength={2000}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Qué incluye, tiempos, condiciones…"
        />
      </label>
      <div className="adm-sol-acciones">
        <button
          type="button"
          className="adm-cta"
          disabled={ocupado || !Number.isFinite(Number(monto)) || Number(monto) <= 0}
          onClick={() => onCotizar(Number(monto), ciclo, nota)}
        >
          {ocupado ? "Guardando…" : "Cotizar"}
        </button>
        <BotonRechazar ocupado={ocupado} onRechazar={onRechazar} />
      </div>
    </div>
  );
}

function FormLink({
  ocupado,
  onEnviar,
  onRechazar,
}: {
  ocupado: boolean;
  onEnviar: (link: string) => void;
  onRechazar: (motivo: string) => void;
}) {
  const [link, setLink] = useState("");
  return (
    <div className="adm-sol-form">
      <label className="adm-field adm-sol-nota">
        <span className="adm-field-label">Link de pago (Wompi / Bold)</span>
        <input
          className="adm-input"
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://checkout.wompi.co/…"
        />
      </label>
      <div className="adm-sol-acciones">
        <button
          type="button"
          className="adm-cta"
          disabled={ocupado || !/^https:\/\/\S+$/i.test(link.trim())}
          onClick={() => onEnviar(link.trim())}
        >
          {ocupado ? "Publicando…" : "Publicar link al cliente"}
        </button>
        <BotonRechazar ocupado={ocupado} onRechazar={onRechazar} />
      </div>
    </div>
  );
}

function BotonRechazar({
  ocupado,
  onRechazar,
}: {
  ocupado: boolean;
  onRechazar: (motivo: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");

  if (!abierto) {
    return (
      <button
        type="button"
        className="adm-cta-ghost"
        disabled={ocupado}
        onClick={() => setAbierto(true)}
      >
        Rechazar
      </button>
    );
  }
  return (
    <span className="adm-sol-rechazo">
      <input
        className="adm-input"
        value={motivo}
        maxLength={2000}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Motivo (el cliente lo ve)"
      />
      <button
        type="button"
        className="adm-cta-ghost adm-cta--peligro"
        disabled={ocupado}
        onClick={() => onRechazar(motivo)}
      >
        Confirmar rechazo
      </button>
    </span>
  );
}
