"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { fechaCorta } from "@/lib/admin/formato";
import { labelEstado } from "@/lib/admin/negocios";
import type { FilaCola } from "@/lib/admin/cola-voz";
import { Badge } from "@/components/admin/ui/Badge";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Island } from "@/components/admin/ui/Island";
import { ListRow } from "@/components/admin/ui/ListRow";
import { Skeleton } from "@/components/admin/ui/Skeleton";
import { BotonLlamarZak, type EstadoVozZak } from "./BotonLlamarZak";

type Respuesta = { cola: FilaCola[]; miradas: number };

/**
 * Por llamar: los negocios a los que les escribimos y de los que solo contestó
 * su máquina (horario, menú, «gracias por tu mensaje»). Desde el 18 sep el bot
 * se calla con esas contestadoras, así que estos números no avanzan solos —
 * al dueño se le llama.
 *
 * La cola NO llama sola a nadie: cada llamada la dispara Tomás desde su fila, y
 * se abre el modal que la narra en vivo. Marcar sesenta números de golpe es la
 * clase de automatismo que quema una lista (y la plata) sin que nadie mire.
 */
export function ColaVoz({ vozZak }: { vozZak: EstadoVozZak }) {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, startRefrescar] = useTransition();

  // Sin setState antes del primer await (lo llama el efecto de montaje): el
  // esqueleto ya lo pinta `datos === null`, y el error viejo se limpia cuando
  // la cola nueva llega bien, no al arrancar. Mismo criterio que la bandeja.
  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/admin/api/zak/cola-voz");
      if (!res.ok) throw new Error(String(res.status));
      setDatos((await res.json()) as Respuesta);
      setError(null);
    } catch {
      setError(
        "No se pudo armar la cola: el bot no respondió. Recarga en un momento; lo que hay en pantalla puede estar viejo.",
      );
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await cargar();
    })();
  }, [cargar]);

  const cola = datos?.cola ?? [];
  const sinLlamar = cola.filter((f) => f.ultimaLlamada === null).length;

  return (
    <Island
      titulo="Por llamar"
      className="flex flex-col gap-3 bg-isla-alta/50"
      acciones={
        <Button
          disabled={refrescando}
          onClick={() => startRefrescar(async () => { await cargar(); })}
        >
          {refrescando ? "Actualizando…" : "Actualizar"}
        </Button>
      }
    >
      <p className="text-xs text-tinta-60">
        Negocios de los que solo contestó su máquina. Zak ya no les escribe encima
        de su propio bot: al dueño se le llama. Cada llamada la disparas tú.
      </p>

      {error && <Banner variante="error">{error}</Banner>}

      {datos === null && !error && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      )}

      {datos !== null && cola.length === 0 && (
        <EmptyState
          titulo="Nadie en la cola."
          detalle="Cuando una tanda reciba respuestas automáticas, esos negocios aparecen acá."
        />
      )}

      {cola.length > 0 && (
        <>
          <p className="text-sm text-tinta-60">
            <strong className="text-tinta">{cola.length}</strong>{" "}
            {cola.length === 1 ? "negocio" : "negocios"} en la cola ·{" "}
            <strong className="text-acento">{sinLlamar}</strong> sin llamar todavía
          </p>
          <ul className="barra-fina flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-0.5">
            {cola.map((f) => (
              <li key={f.telefono}>
                <ListRow className="flex flex-wrap items-center gap-2 border border-hairline bg-isla">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-tinta">
                      {f.nombre ?? f.telefonoE164}
                      {f.verticalLabel && <Badge tono="neutro">{f.verticalLabel}</Badge>}
                      {f.estado && <Badge tono={f.estado}>{labelEstado(f.estado)}</Badge>}
                    </span>
                    <span className="text-xs text-tinta-40">
                      {f.nombre ? `${f.telefonoE164} · ` : ""}
                      {f.contestoEn
                        ? `su máquina contestó el ${fechaCorta(f.contestoEn)}`
                        : "sin fecha de respuesta"}
                      {f.ultimaLlamada
                        ? ` · ya llamado el ${fechaCorta(f.ultimaLlamada)}`
                        : ""}
                    </span>
                  </span>
                  <BotonLlamarZak
                    vozZak={vozZak}
                    telefono={f.telefonoE164}
                    nombre={f.nombre}
                    negocioId={f.negocioId}
                  />
                </ListRow>
              </li>
            ))}
          </ul>
          {/* Un censo no declara completitud que no tiene: la cola mira las
              últimas conversaciones del bot, no toda la historia. */}
          <p className="text-xs text-tinta-40">
            Sobre las últimas {datos?.miradas ?? 0} conversaciones del bot.
          </p>
        </>
      )}
    </Island>
  );
}
