"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { reintentarJob } from "@/lib/admin/bots-actions";
import { fechaCorta } from "@/lib/admin/formato";
import {
  esLabs,
  type JobFallido,
  type Lead,
  type StatusInstancia,
} from "@/lib/bots/tipos";
import { Badge } from "@/components/admin/ui/Badge";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Island } from "@/components/admin/ui/Island";
import { ListRow } from "@/components/admin/ui/ListRow";
import { Skeleton } from "@/components/admin/ui/Skeleton";

type Props = { instanciaId: number };

type Datos = {
  status: StatusInstancia;
  jobs: JobFallido[];
  leads: Lead[];
};

const ERROR_CARGA = "No se pudo cargar la actividad. ¿Railway está arriba?";

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

  // El fetch no toca estado: así el efecto de montaje puede llamarlo y aplicar
  // el resultado en su propia continuación (con guarda de desmontaje), y
  // `cargar` reutiliza lo mismo tras reintentar un job.
  const pedirDatos = useCallback(async (): Promise<Datos> => {
    const res = await fetch(`/admin/api/bots/${instanciaId}/actividad`);
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as Datos;
  }, [instanciaId]);

  const cargar = useCallback(async () => {
    try {
      setDatos(await pedirDatos());
      setError(null);
    } catch {
      setError(ERROR_CARGA);
    }
  }, [pedirDatos]);

  useEffect(() => {
    let activo = true;
    void (async () => {
      try {
        const nuevos = await pedirDatos();
        if (!activo) return;
        setDatos(nuevos);
        setError(null);
      } catch {
        if (activo) setError(ERROR_CARGA);
      }
    })();
    return () => {
      activo = false;
    };
  }, [pedirDatos]);

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

  if (error) return <Banner>{error}</Banner>;
  if (!datos) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    );
  }

  const uso = datos.status.uso_hoy;

  const cifras = [
    { valor: String(uso.llamadas), label: "llamadas a Claude hoy" },
    {
      valor: (uso.tokens_entrada + uso.tokens_salida).toLocaleString("es-CO"),
      label: "tokens hoy (entrada + salida)",
    },
    { valor: String(datos.status.conversaciones), label: "conversaciones totales" },
    { valor: String(datos.status.pausados), label: "chats pausados" },
  ];

  return (
    <div className="flex flex-col gap-aire">
      <div className="grid grid-cols-2 gap-aire md:grid-cols-4">
        {cifras.map((c) => (
          <div key={c.label} className="rounded-fila bg-isla-alta px-4 py-3">
            <span className="block text-2xl font-semibold text-tinta">{c.valor}</span>
            <span className="text-xs text-tinta-60">{c.label}</span>
          </div>
        ))}
      </div>

      <Island className="bg-isla-alta/50" titulo="Jobs fallidos">
        {avisoJob && (
          <Banner variante="error" className="mb-2">
            {avisoJob}
          </Banner>
        )}
        {datos.jobs.length === 0 ? (
          <p className="text-sm text-tinta-40">Ninguno. Todo respondido. ✓</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {datos.jobs.map((j) => (
              <li key={j.id}>
                <ListRow
                  interactiva={false}
                  className="flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-tinta">
                      <strong>{j.telefono}</strong>
                      <span className="text-xs text-tinta-40"> · {fechaCorta(j.creado_en)}</span>
                    </p>
                    <p className="text-sm text-tinta-60">
                      “{j.texto.slice(0, 120)}” — {j.error ?? "sin detalle"} (
                      {j.intentos} intentos)
                    </p>
                  </div>
                  <Button disabled={operando} onClick={() => reintentar(j.id)}>
                    Reintentar
                  </Button>
                </ListRow>
              </li>
            ))}
          </ul>
        )}
      </Island>

      <Island className="bg-isla-alta/50" titulo="Leads capturados">
        {datos.leads.length === 0 ? (
          <p className="text-sm text-tinta-40">Todavía no hay leads.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {datos.leads.map((l, i) => (
              <li key={`${l.phone}-${i}`}>
                <ListRow interactiva={false} className="text-sm text-tinta">
                  <strong>{l.phone}</strong>
                  {esLabs(l.phone) && (
                    <Badge tono="neutro" className="ml-1.5">
                      Prueba
                    </Badge>
                  )}
                  <span className="text-tinta-60"> — {resumenLead(l.datos)}</span>
                </ListRow>
              </li>
            ))}
          </ul>
        )}
      </Island>
    </div>
  );
}
