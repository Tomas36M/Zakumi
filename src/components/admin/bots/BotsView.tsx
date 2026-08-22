"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ID_ZAK, PROVEEDORES, type StatusGlobal } from "@/lib/bots/tipos";
import { horaBogota } from "@/lib/admin/formato";
import { Badge } from "@/components/admin/ui/Badge";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Skeleton } from "@/components/admin/ui/Skeleton";
import { NuevoBotForm } from "./NuevoBotForm";

const INTERVALO_MS = 30_000;

function labelProveedor(valor: string): string {
  return PROVEEDORES.find((p) => p.valor === valor)?.label ?? valor;
}

/**
 * Consola de agentes. Degradable a propósito: si un poll falla se conservan
 * los últimos datos buenos y se avisa desde cuándo no hay conexión — nunca
 * una pantalla rota por tener Railway caído.
 */
export function BotsView({ inicial }: { inicial: StatusGlobal | null }) {
  const router = useRouter();
  const [status, setStatus] = useState<StatusGlobal | null>(inicial);
  const [sinConexionDesde, setSinConexionDesde] = useState<string | null>(
    inicial ? null : horaBogota(),
  );
  const [creando, setCreando] = useState(false);

  const recargar = useCallback(async () => {
    try {
      const res = await fetch("/admin/api/bots/status");
      if (!res.ok) throw new Error(String(res.status));
      setStatus(await res.json());
      setSinConexionDesde(null);
    } catch {
      setSinConexionDesde((desde) => desde ?? horaBogota());
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(recargar, INTERVALO_MS);
    return () => clearInterval(timer);
  }, [recargar]);

  const cola = status?.cola;
  const porInstancia = new Map(
    (status?.por_instancia ?? []).map((c) => [c.instancia_id, c]),
  );

  return (
    <section>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <h1 className="text-lg font-semibold text-tinta">Bots</h1>
        {cola && (
          <span className="text-xs text-tinta-40">
            {cola.jobs_pendientes} en cola · {cola.jobs_trabajando} respondiendo ·{" "}
            {cola.jobs_fallidos} fallidos
          </span>
        )}
        <Button variante="primaria" onClick={() => setCreando(true)}>
          Nuevo bot
        </Button>
      </header>

      <div className="flex flex-col gap-4 px-5 py-4">
        {creando && (
          <NuevoBotForm
            onCreado={(id) => {
              setCreando(false);
              router.push(`/admin/bots/${id}`);
            }}
            onCancelar={() => setCreando(false)}
          />
        )}

        {sinConexionDesde && (
          <Banner>
            Sin conexión con el bot desde las {sinConexionDesde}. Se muestran los
            últimos datos conocidos.
          </Banner>
        )}

        {!status && !sinConexionDesde && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        )}

        {status && status.instancias.filter((i) => i.id !== ID_ZAK).length === 0 && (
          <EmptyState titulo="Todavía no hay bots creados." />
        )}

        <div className="grid gap-aire md:grid-cols-2 xl:grid-cols-3">
          {/* Zak no se lista aquí: es el motor del negocio y vive en /admin/zak. */}
          {(status?.instancias ?? []).filter((i) => i.id !== ID_ZAK).map((inst) => {
            const colaInst = porInstancia.get(inst.id);
            return (
              <Link
                key={inst.id}
                href={`/admin/bots/${inst.id}`}
                className="flex flex-col gap-1 rounded-isla bg-isla-alta/50 p-4 transition-colors hover:bg-isla-alta"
              >
                <header className="flex items-center justify-between gap-2">
                  <h2 className="truncate text-sm font-semibold text-tinta">
                    {inst.nombre}
                  </h2>
                  <Badge tono={inst.activo ? "vivo" : "peligro"}>
                    {inst.activo ? "Activo" : "Apagado"}
                  </Badge>
                </header>
                <p className="text-xs text-tinta-60">
                  {inst.canal === "voz" ? "Voz" : "WhatsApp"} ·{" "}
                  {labelProveedor(inst.proveedor)} · prompt v{inst.prompt_version}
                </p>
                <p className="text-xs text-tinta-40">
                  {colaInst
                    ? `${colaInst.pendientes} en cola · ${colaInst.fallidos} fallidos`
                    : "Sin actividad en cola"}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
