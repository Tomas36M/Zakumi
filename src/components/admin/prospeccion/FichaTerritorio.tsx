"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Crosshair, PencilLine, Trash2, X } from "lucide-react";
import { fechaCorta, formatoUsd } from "@/lib/admin/formato";
import type { ResumenTerritorio, Territorio } from "@/lib/admin/territorios";
import { eliminarTerritorio } from "@/lib/admin/territorios-actions";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import { IconButton } from "@/components/admin/ui/IconButton";
import { RenombrarTerritorio } from "./RenombrarTerritorio";

type Props = {
  territorio: Territorio;
  resumen: ResumenTerritorio;
  /** El contorno se cruza a sí mismo: puede faltar censo. */
  cruzado: boolean;
  /** El territorio cuyo barrido está montado ahora mismo (o null). */
  barriendoId: string | null;
  onBarrer: () => void;
  onCentrar: () => void;
  onCerrar: () => void;
  /** Renombrado: el dueño refresca. */
  onCambio: () => void;
  onEliminado: () => void;
};

/**
 * La ficha de un territorio en la isla derecha del mapa: sus números y los
 * botones que se pueden apretar. Sustituye a la lista flotante de la
 * izquierda; el diálogo de estimación lo abre el padre — aquí solo se pide
 * «barrer este».
 */
export function FichaTerritorio({
  territorio: t,
  resumen,
  cruzado,
  barriendoId,
  onBarrer,
  onCentrar,
  onCerrar,
  onCambio,
  onEliminado,
}: Props) {
  const { confirmar, dialogo } = useConfirmar();
  const [renombrando, setRenombrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, startAccion] = useTransition();
  // Renombrar o borrar el territorio que se está barriendo deja al pool
  // haciendo POST contra un id muerto: llamadas que se cobran y no se anotan.
  const bloqueado = ocupado || barriendoId === t.id;

  async function borrar() {
    const ok = await confirmar({
      titulo: `¿Eliminar ${t.nombre}?`,
      mensaje:
        "Se borra el área y su historial de teselas barridas: para volver a barrerla hay que pagarle a Google otra vez. Los leads que ya produjo NO se borran.",
      accion: "Eliminar",
      peligro: true,
    });
    if (!ok) return;
    startAccion(async () => {
      const res = await eliminarTerritorio(t.id);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onEliminado();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {dialogo}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-tinta">{t.nombre}</h2>
          <p className="text-xs text-tinta-40">
            {t.ultimo_barrido ? `barrido ${fechaCorta(t.ultimo_barrido)}` : "sin barrer"} ·{" "}
            {resumen.llamadas} {resumen.llamadas === 1 ? "consulta" : "consultas"} ≈{" "}
            {formatoUsd(resumen.costoUsd)}
          </p>
        </div>
        <IconButton etiqueta="Cerrar ficha" onClick={onCerrar}>
          <X className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="flex items-baseline gap-4">
        <span>
          <span className="font-editorial text-3xl italic text-tinta">{resumen.leads}</span>
          <span className="text-xs text-tinta-40"> {resumen.leads === 1 ? "lead" : "leads"}</span>
        </span>
        <span>
          <span className="font-editorial text-3xl italic text-acento">{resumen.sinWeb}</span>
          <span className="text-xs text-tinta-40"> sin web</span>
        </span>
      </div>

      {/* Visible AQUÍ, antes de apretar Barrer: es donde se gasta la plata. */}
      {cruzado && (
        <p className="text-xs text-peligro">
          Contorno cruzado: la zona cubierta dos veces cuenta como «fuera» — puede faltar
          censo aunque el barrido termine en 100 %.
        </p>
      )}
      {error && <Banner variante="error">{error}</Banner>}

      <div className="flex flex-wrap gap-2">
        <Button
          variante="primaria"
          // Bloqueado mientras haya CUALQUIER barrido abierto, no solo el
          // suyo: confirmar otro territorio cambia el `key` de la banda y el
          // barrido viejo se desmonta con su pool todavía comprando teselas.
          disabled={barriendoId !== null}
          onClick={onBarrer}
        >
          {barriendoId === t.id
            ? "Barrido abierto"
            : barriendoId !== null
              ? "Hay un barrido abierto"
              : "Barrer"}
        </Button>
        <Link
          href={`/admin/territorios/${t.id}`}
          className="inline-flex h-control items-center justify-center gap-2 rounded-full bg-isla-alta px-4 text-sm font-medium text-tinta-85 transition-colors hover:bg-acento-10 hover:text-tinta"
        >
          Ver locales
        </Link>
      </div>

      <div className="flex items-center gap-1">
        <IconButton etiqueta="Centrar el mapa en el territorio" onClick={onCentrar}>
          <Crosshair className="h-4 w-4" />
        </IconButton>
        <IconButton etiqueta={`Renombrar ${t.nombre}`} disabled={bloqueado} onClick={() => setRenombrando(true)}>
          <PencilLine className="h-4 w-4" />
        </IconButton>
        <IconButton etiqueta={`Eliminar ${t.nombre}`} disabled={bloqueado} onClick={() => void borrar()}>
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>

      {renombrando && (
        <RenombrarTerritorio
          key={t.id}
          territorio={t}
          onCerrar={() => setRenombrando(false)}
          onRenombrado={() => {
            setRenombrando(false);
            onCambio();
          }}
        />
      )}
    </div>
  );
}
