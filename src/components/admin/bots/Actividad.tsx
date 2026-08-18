"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { reintentarJob } from "@/lib/admin/bots-actions";
import {
  esLabs,
  type JobFallido,
  type Lead,
  type StatusInstancia,
} from "@/lib/bots/tipos";

type Props = { instanciaId: number };

type Datos = {
  status: StatusInstancia;
  jobs: JobFallido[];
  leads: Lead[];
};

function fechaCorta(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  }).format(fecha);
}

function resumenLead(datos: Record<string, unknown>): string {
  const partes = Object.entries(datos)
    .filter(([, v]) => typeof v === "string" || typeof v === "number")
    .map(([k, v]) => `${k}: ${v}`);
  return partes.join(" · ") || "(sin datos)";
}

/** Uso de hoy (tokens reales), jobs fallidos con reintento y leads del bot. */
export function Actividad({ instanciaId }: Props) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avisoJob, setAvisoJob] = useState<string | null>(null);
  const [operando, startOperar] = useTransition();

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/admin/api/bots/${instanciaId}/actividad`);
      if (!res.ok) throw new Error(String(res.status));
      setDatos((await res.json()) as Datos);
    } catch {
      setError("No se pudo cargar la actividad. ¿Railway está arriba?");
    }
  }, [instanciaId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function reintentar(jobId: number) {
    setAvisoJob(null);
    startOperar(async () => {
      const res = await reintentarJob(jobId);
      if (res.error) {
        setAvisoJob(res.error);
        return;
      }
      await cargar();
    });
  }

  if (error) return <p className="adm-aviso">{error}</p>;
  if (!datos) return <p className="adm-tabla-vacia">Cargando…</p>;

  const uso = datos.status.uso_hoy;

  return (
    <div className="adm-actividad">
      <div className="adm-actividad-cifras">
        <div className="adm-cifra-bloque">
          <span className="adm-cifra">{uso.llamadas}</span>
          <span className="adm-cifra-label">llamadas a Claude hoy</span>
        </div>
        <div className="adm-cifra-bloque">
          <span className="adm-cifra">
            {(uso.tokens_entrada + uso.tokens_salida).toLocaleString("es-CO")}
          </span>
          <span className="adm-cifra-label">tokens hoy (entrada + salida)</span>
        </div>
        <div className="adm-cifra-bloque">
          <span className="adm-cifra">{datos.status.conversaciones}</span>
          <span className="adm-cifra-label">conversaciones totales</span>
        </div>
        <div className="adm-cifra-bloque">
          <span className="adm-cifra">{datos.status.pausados}</span>
          <span className="adm-cifra-label">chats pausados</span>
        </div>
      </div>

      <section>
        <h2 className="adm-field-label">Jobs fallidos</h2>
        {avisoJob && (
          <p className="adm-error" role="alert">
            {avisoJob}
          </p>
        )}
        {datos.jobs.length === 0 ? (
          <p className="adm-ficha-sin">Ninguno. Todo respondido. ✓</p>
        ) : (
          <ul className="adm-actividad-jobs">
            {datos.jobs.map((j) => (
              <li key={j.id} className="adm-actividad-job">
                <div>
                  <strong>{j.telefono}</strong>
                  <span className="adm-editor-fecha"> · {fechaCorta(j.creado_en)}</span>
                  <p className="adm-editor-notas">
                    “{j.texto.slice(0, 120)}” — {j.error ?? "sin detalle"} (
                    {j.intentos} intentos)
                  </p>
                </div>
                <button
                  type="button"
                  className="adm-cta-ghost"
                  disabled={operando}
                  onClick={() => reintentar(j.id)}
                >
                  Reintentar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="adm-field-label">Leads capturados</h2>
        {datos.leads.length === 0 ? (
          <p className="adm-ficha-sin">Todavía no hay leads.</p>
        ) : (
          <ul className="adm-actividad-leads">
            {datos.leads.map((l, i) => (
              <li key={`${l.phone}-${i}`} className="adm-actividad-lead">
                <strong>{l.phone}</strong>
                {esLabs(l.phone) && <span className="adm-conv-prueba"> Prueba</span>}
                <span className="adm-editor-notas"> — {resumenLead(l.datos)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
