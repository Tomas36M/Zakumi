"use client";

import { fechaCorta, formatoUsd } from "@/lib/admin/formato";
import type { ResumenTerritorio, Territorio } from "@/lib/admin/territorios";

type Props = {
  territorio: Territorio;
  /** Los números del territorio. Salen de `resumenDeTerritorio` —el mismo que
   * pinta la lista de la izquierda— y NO de un recuento propio: dos bucles
   * sobre `negocios` son dos sitios donde el mismo número puede equivocarse. */
  resumen: ResumenTerritorio;
};

/**
 * Lo que el panel de la izquierda ya sabe de un territorio, traído encima del
 * mapa. Pasar el ratón por un área dibujada y que no dijera NADA —ni cuántos
 * locales hay, ni cuántos sin web— es exactamente la queja que abrió esto.
 *
 * No estima nada ni pide nada a Google: solo enseña lo que ya se barrió (y se
 * pagó). Una previsualización de lo que HABRÍA dentro costaría dinero por cada
 * área sobre la que el cursor pasa de largo.
 */
export function TarjetaTerritorio({ territorio, resumen }: Props) {
  return (
    <>
      <p className="truncate text-sm font-medium text-tinta">{territorio.nombre}</p>

      {resumen.barrido ? (
        <>
          <p className="mt-1 text-xs text-tinta-60">
            {resumen.leads} {resumen.leads === 1 ? "lead" : "leads"} ·{" "}
            {resumen.sinWeb} sin web
          </p>
          <p className="mt-1 text-xs text-tinta-40">
            Barrido {fechaCorta(territorio.ultimo_barrido)}
          </p>
          <p className="text-xs text-tinta-40">
            {resumen.llamadas} {resumen.llamadas === 1 ? "llamada" : "llamadas"}{" "}
            ≈ {formatoUsd(resumen.costoUsd)}
          </p>
        </>
      ) : (
        // Un territorio recién dibujado no tiene NINGÚN número que enseñar:
        // una tarjeta con cuatro ceros ("0 leads · 0 sin web · 0 llamadas")
        // repite la misma decepción que la trajo. Dice qué le falta y dónde
        // está el botón que se lo da.
        <>
          <p className="mt-1 text-xs text-tinta-60">Sin barrer todavía.</p>
          <p className="mt-1 text-xs text-tinta-40">
            Ábrelo en la lista de la izquierda y pulsa «Barrer» para llenarlo
            con los negocios que hay dentro.
          </p>
        </>
      )}
    </>
  );
}
