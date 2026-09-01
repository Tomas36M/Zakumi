"use client";

import { useMemo, useState } from "react";
import {
  PRECIO_POR_LLAMADA_USD,
  claveTrabajo,
  estimarBarrido,
  teselar,
} from "@/lib/admin/barrido";
import { formatoUsd } from "@/lib/admin/formato";
import type { Territorio } from "@/lib/admin/territorios";
import { VERTICALES_PROSPECCION } from "@/lib/admin/zak";
import { tiposDeVertical } from "@/lib/admin/verticales-places";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Modal } from "@/components/admin/ui/Modal";
import { cn } from "@/lib/cn";

// Solo las verticales que tienen tipos de Places: una sin tipos es un 400 del
// handler, y contarla en la estimación sería mentir sobre lo que se compra.
const VERTICALES = VERTICALES_PROSPECCION.filter(
  (v) => tiposDeVertical(v.slug).length > 0,
);

type Props = {
  territorio: Territorio;
  onCerrar: () => void;
  onConfirmar: (verticales: string[]) => void;
};

/**
 * La última pantalla antes de gastar. Todo lo que se ve aquí es dinero: las
 * teselas que se van a comprar, lo que cuestan, hasta dónde puede subir si hay
 * zonas densas, y lo que este territorio lleva gastado.
 */
export function DialogoBarrer({ territorio, onCerrar, onConfirmar }: Props) {
  const [marcadas, setMarcadas] = useState<ReadonlySet<string>>(
    () => new Set(VERTICALES.map((v) => v.slug)),
  );

  // La rejilla NO depende de las verticales: se calcula una vez y el resto son
  // multiplicaciones. `teselar` recorre la caja entera celda por celda.
  const teselas = useMemo(() => teselar(territorio.poligono), [territorio.poligono]);
  const hechas = useMemo(
    () => new Set(territorio.teselas_hechas ?? []),
    [territorio.teselas_hechas],
  );

  const slugs = useMemo(
    () => VERTICALES.filter((v) => marcadas.has(v.slug)).map((v) => v.slug),
    [marcadas],
  );

  // Lo que esta tanda va a COMPRAR: lo ya barrido no se vuelve a pagar.
  const pendientes = useMemo(() => {
    let n = 0;
    for (const t of teselas) {
      for (const slug of slugs) {
        if (!hechas.has(claveTrabajo(t, slug))) n++;
      }
    }
    return n;
  }, [teselas, slugs, hechas]);

  const bruto = estimarBarrido(teselas.length, slugs.length);
  // Mismo cálculo sobre lo pendiente: llamadas = teselas × verticales, así que
  // "pendientes × 1" es exactamente la cuenta de esta tanda.
  const tanda = estimarBarrido(pendientes, 1);
  const gastado = territorio.llamadas ?? 0;

  function alternar(slug: string) {
    setMarcadas((prev) => {
      const copia = new Set(prev);
      if (copia.has(slug)) copia.delete(slug);
      else copia.add(slug);
      return copia;
    });
  }

  return (
    <Modal
      abierto
      onCerrar={(abierto) => {
        if (!abierto) onCerrar();
      }}
      titulo={`Barrer ${territorio.nombre}`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5">
          {VERTICALES.map((v) => {
            const activa = marcadas.has(v.slug);
            return (
              <button
                key={v.slug}
                type="button"
                role="checkbox"
                aria-checked={activa}
                onClick={() => alternar(v.slug)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  activa
                    ? "border-acento bg-acento-10 text-tinta"
                    : "border-hairline text-tinta-40 hover:border-acento/40",
                )}
              >
                {v.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Button
            className="h-8 px-3 text-xs"
            onClick={() => setMarcadas(new Set(VERTICALES.map((v) => v.slug)))}
          >
            Todas
          </Button>
          <Button className="h-8 px-3 text-xs" onClick={() => setMarcadas(new Set())}>
            Ninguna
          </Button>
        </div>

        <div className="rounded-fila bg-isla-alta p-4 text-sm leading-relaxed text-tinta-60">
          <p>
            <strong className="text-tinta">{teselas.length}</strong> teselas ×{" "}
            <strong className="text-tinta">{slugs.length}</strong>{" "}
            {slugs.length === 1 ? "vertical" : "verticales"} ={" "}
            <strong className="text-tinta">{bruto.llamadas}</strong> llamadas.
          </p>
          <p className="mt-1">
            Esta tanda compra{" "}
            <strong className="text-acento">{tanda.llamadas} llamadas</strong> ≈{" "}
            <strong className="text-acento">{formatoUsd(tanda.costoUsd)}</strong>
            {pendientes < bruto.llamadas && (
              <> — las otras {bruto.llamadas - pendientes} ya están barridas y no se pagan.</>
            )}
          </p>
          <p className="mt-1">
            Puede subir hasta ~{formatoUsd(tanda.costoMaxUsd)} si hay zonas densas
            (una tesela saturada se parte en cuatro).
          </p>
          <p className="mt-2 border-t border-hairline pt-2">
            Este territorio lleva <strong className="text-tinta">{gastado}</strong>{" "}
            {gastado === 1 ? "llamada gastada" : "llamadas gastadas"} ≈{" "}
            {formatoUsd(gastado * PRECIO_POR_LLAMADA_USD)}.
          </p>
        </div>

        {slugs.length === 0 && (
          <Banner>Marca al menos una vertical: sin verticales no hay nada que barrer.</Banner>
        )}
        {slugs.length > 0 && pendientes === 0 && (
          <Banner>
            Ya barriste todas estas verticales en este territorio. Reanudar no
            compraría nada nuevo.
          </Banner>
        )}

        <div className="flex justify-end gap-2">
          <Button onClick={onCerrar}>Cancelar</Button>
          <Button
            variante="primaria"
            disabled={pendientes === 0}
            onClick={() => onConfirmar(slugs)}
          >
            Barrer y gastar {formatoUsd(tanda.costoUsd)}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
