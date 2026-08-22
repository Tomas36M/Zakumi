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
  type EstadoSolicitud,
  type Solicitud,
} from "@/lib/portal/solicitudes";
import { Badge, type TonoBadge } from "@/components/admin/ui/Badge";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Field, Input, Select } from "@/components/admin/ui/Field";
import { Island } from "@/components/admin/ui/Island";

export type PerfilResumen = {
  email: string | null;
  nombre: string | null;
  clienteId: string | null;
};

// El funnel de venta reusa la paleta del pipeline del CRM.
const TONO_SOLICITUD: Record<EstadoSolicitud, TonoBadge> = {
  nueva: "nuevo",
  cotizada: "contactado",
  link_enviado: "respondido",
  pagada: "interesado",
  activa: "cliente",
  rechazada: "descartado",
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
      <EmptyState
        titulo="Nada por ahora."
        detalle="Cuando alguien pida un servicio en el portal, aparece aquí (y te llega el aviso por WhatsApp)."
      />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-aire">
        {abiertas.length === 0 ? (
          <p className="text-sm text-tinta-40">Sin solicitudes por atender.</p>
        ) : (
          abiertas.map((s) => (
            <TarjetaSolicitud key={s.id} solicitud={s} perfil={perfiles[s.user_id]} />
          ))
        )}
      </div>

      {cerradas.length > 0 && (
        <>
          <h2 className="mt-6 mb-3 text-xs font-semibold tracking-wide text-tinta-60 uppercase">
            Cerradas recientes
          </h2>
          <div className="flex flex-col gap-aire">
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
    <Island className="bg-isla-alta/50">
      <article className="flex flex-col gap-3">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div className="text-sm text-tinta">
            <strong>{servicio?.nombre ?? s.servicio_slug}</strong>
            <span className="text-xs text-tinta-40"> · {quien}</span>
            {perfil?.clienteId && (
              <Link
                className="ml-2 text-sm font-medium text-acento hover:underline"
                href={`/admin/clientes/${perfil.clienteId}`}
              >
                ficha 360 →
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge tono={TONO_SOLICITUD[s.estado]}>{labelEstado(s.estado)}</Badge>
            <span className="text-xs text-tinta-40">{fechaCorta(s.created_at)}</span>
          </div>
        </header>

        {s.mensaje && <p className="text-sm text-tinta-85 italic">“{s.mensaje}”</p>}

        {s.cotizacion_monto !== null && (
          <p className="text-xs text-tinta-60">
            Cotizado:{" "}
            <strong className="text-tinta">
              {formatearCOP(Number(s.cotizacion_monto))}
            </strong>
            {s.cotizacion_ciclo ? ` (${s.cotizacion_ciclo})` : ""}
            {s.cotizacion_nota ? ` — ${s.cotizacion_nota}` : ""}
          </p>
        )}
        {s.link_pago && (
          <p className="text-xs text-tinta-60">
            Link: <span className="break-all text-tinta-85">{s.link_pago}</span>
          </p>
        )}

        {error && <Banner variante="error">{error}</Banner>}

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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variante="primaria"
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
            </Button>
            <BotonRechazar
              ocupado={ocupado}
              onRechazar={(motivo) => correr(() => rechazarSolicitud(s.id, motivo))}
            />
          </div>
        )}
      </article>
    </Island>
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
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Monto (COP)">
          <Input
            inputMode="numeric"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </Field>
        <Field label="Ciclo">
          <Select value={ciclo} onChange={(e) => setCiclo(e.target.value as Ciclo)}>
            {CICLOS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Nota para el cliente (opcional)">
        <Input
          value={nota}
          maxLength={2000}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Qué incluye, tiempos, condiciones…"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variante="primaria"
          disabled={ocupado || !Number.isFinite(Number(monto)) || Number(monto) <= 0}
          onClick={() => onCotizar(Number(monto), ciclo, nota)}
        >
          {ocupado ? "Guardando…" : "Cotizar"}
        </Button>
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
    <div className="flex flex-col gap-3">
      <Field label="Link de pago (Wompi / Bold)">
        <Input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://checkout.wompi.co/…"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variante="primaria"
          disabled={ocupado || !/^https:\/\/\S+$/i.test(link.trim())}
          onClick={() => onEnviar(link.trim())}
        >
          {ocupado ? "Publicando…" : "Publicar link al cliente"}
        </Button>
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
      <Button disabled={ocupado} onClick={() => setAbierto(true)}>
        Rechazar
      </Button>
    );
  }
  return (
    <span className="flex flex-1 flex-wrap items-center gap-2">
      <Input
        className="min-w-48 flex-1"
        value={motivo}
        maxLength={2000}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Motivo (el cliente lo ve)"
      />
      <Button variante="peligro" disabled={ocupado} onClick={() => onRechazar(motivo)}>
        Confirmar rechazo
      </Button>
    </span>
  );
}
