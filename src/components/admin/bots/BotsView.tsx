"use client";

import { useEffect, useState } from "react";
import { PROVEEDORES, type StatusGlobal } from "@/lib/bots/tipos";

const INTERVALO_MS = 30_000;

function horaBogota(): string {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  }).format(new Date());
}

function labelProveedor(valor: string): string {
  return PROVEEDORES.find((p) => p.valor === valor)?.label ?? valor;
}

/**
 * Consola de agentes. Degradable a propósito: si un poll falla se conservan
 * los últimos datos buenos y se avisa desde cuándo no hay conexión — nunca
 * una pantalla rota por tener Railway caído.
 */
export function BotsView({ inicial }: { inicial: StatusGlobal | null }) {
  const [status, setStatus] = useState<StatusGlobal | null>(inicial);
  const [sinConexionDesde, setSinConexionDesde] = useState<string | null>(
    inicial ? null : horaBogota(),
  );

  useEffect(() => {
    let activo = true;
    async function poll() {
      try {
        const res = await fetch("/admin/api/bots/status");
        if (!activo) return;
        if (!res.ok) throw new Error(String(res.status));
        setStatus(await res.json());
        setSinConexionDesde(null);
      } catch {
        if (activo) setSinConexionDesde((desde) => desde ?? horaBogota());
      }
    }
    const timer = setInterval(poll, INTERVALO_MS);
    return () => {
      activo = false;
      clearInterval(timer);
    };
  }, []);

  const cola = status?.cola;
  const porInstancia = new Map(
    (status?.por_instancia ?? []).map((c) => [c.instancia_id, c]),
  );

  return (
    <section className="adm-seccion">
      <div className="adm-toolbar">
        <h1 className="adm-titulo">Bots</h1>
        {cola && (
          <span className="adm-toolbar-conteo">
            {cola.jobs_pendientes} en cola · {cola.jobs_trabajando} respondiendo ·{" "}
            {cola.jobs_fallidos} fallidos
          </span>
        )}
      </div>

      {sinConexionDesde && (
        <p className="adm-aviso">
          Sin conexión con el bot desde las {sinConexionDesde}. Se muestran los
          últimos datos conocidos.
        </p>
      )}

      {!status && !sinConexionDesde && (
        <p className="adm-tabla-vacia">Cargando…</p>
      )}

      {status && status.instancias.length === 0 && (
        <p className="adm-tabla-vacia">Todavía no hay bots creados.</p>
      )}

      <div className="adm-bots-grid">
        {(status?.instancias ?? []).map((inst) => {
          const colaInst = porInstancia.get(inst.id);
          return (
            <article key={inst.id} className="adm-bot-card">
              <header className="adm-bot-cabecera">
                <h2 className="adm-bot-nombre">{inst.nombre}</h2>
                <span
                  className={
                    inst.activo
                      ? "adm-bot-estado adm-bot-estado--activo"
                      : "adm-bot-estado adm-bot-estado--apagado"
                  }
                >
                  {inst.activo ? "Activo" : "Apagado"}
                </span>
              </header>
              <p className="adm-bot-meta">
                {inst.canal === "voz" ? "Voz" : "WhatsApp"} ·{" "}
                {labelProveedor(inst.proveedor)} · prompt v{inst.prompt_version}
              </p>
              <p className="adm-bot-cola">
                {colaInst
                  ? `${colaInst.pendientes} en cola · ${colaInst.fallidos} fallidos`
                  : "Sin actividad en cola"}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
