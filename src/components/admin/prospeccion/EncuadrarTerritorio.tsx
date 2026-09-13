"use client";

import { useEffect } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import { bboxDeTerritorio, type Territorio } from "@/lib/admin/territorios";

/** Un pedido de encuadre. `n` distingue dos pedidos seguidos del mismo
 * territorio (el botón «Centrar» dos veces). */
export type Encuadre = { id: string; n: number };

type Props = {
  encuadre: Encuadre | null;
  territorios: readonly Territorio[];
  /** La cara está visible. Un mapa `hidden` no tiene tamaño y `fitBounds`
   * encuadra contra un rectángulo de cero: se espera a que se vea. */
  visible: boolean;
};

/**
 * Centra el mapa en un territorio cuando se lo piden: el deep-link
 * `?territorio=` desde la página Territorios, o el botón «Centrar» de la
 * ficha. Va DENTRO de <MapCanvas> porque `useMap()` necesita su contexto.
 * No encuadra al tocar un polígono: eso ya está a la vista.
 */
export function EncuadrarTerritorio({ encuadre, territorios, visible }: Props) {
  const map = useMap();
  const territorio = encuadre ? (territorios.find((t) => t.id === encuadre.id) ?? null) : null;
  const caja = territorio ? bboxDeTerritorio(territorio) : null;
  const clave = caja ? `${encuadre?.n}:${caja.south},${caja.north},${caja.west},${caja.east}` : null;

  useEffect(() => {
    if (!map || !caja || !visible) return;
    map.fitBounds(caja, 48);
    // `clave` resume el pedido y la caja: cambia solo cuando hay algo nuevo
    // que encuadrar, no en cada render con el mismo territorio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, clave, visible]);

  return null;
}
