"use client";

import { useMap } from "@vis.gl/react-google-maps";
import { Crosshair, Layers, Maximize2, Minimize2, Minus, Plus } from "lucide-react";
import { BotonMapa } from "./BotonMapa";

export type TipoMapa = "roadmap" | "hybrid";

type Punto = { lat: number; lng: number };

type Props = {
  /** Lo que hay que abarcar al recentrar (los negocios visibles). */
  puntos: readonly Punto[];
  /** Adónde ir si no hay nada que abarcar. */
  centroInicial: Punto;
  tipoMapa: TipoMapa;
  onTipoMapa: (tipo: TipoMapa) => void;
  pantallaCompleta: boolean;
  onPantallaCompleta: () => void;
};

/**
 * La columna de acciones del mapa (patrón del mapa de LUCI): zoom, recentrar,
 * pantalla completa y mapa/satélite. Sustituye al control de zoom nativo de
 * Google, que no habla el idioma de las islas. Va DENTRO del APIProvider
 * (hermana del mapa, no hija): `useMap()` la encuentra igual.
 */
export function ControlesMapa({
  puntos,
  centroInicial,
  tipoMapa,
  onTipoMapa,
  pantallaCompleta,
  onPantallaCompleta,
}: Props) {
  const map = useMap();

  function zoom(delta: number) {
    if (!map) return;
    map.setZoom((map.getZoom() ?? 14) + delta);
  }

  function recentrar() {
    if (!map) return;
    if (puntos.length === 0) {
      map.setCenter(centroInicial);
      map.setZoom(14);
      return;
    }
    const caja = new google.maps.LatLngBounds();
    for (const p of puntos) caja.extend(p);
    map.fitBounds(caja, 48);
  }

  return (
    <div className="absolute right-3 bottom-8 z-10 flex flex-col items-end gap-1">
      <BotonMapa Icono={Plus} etiqueta="Acercar" onClick={() => zoom(1)} />
      <BotonMapa Icono={Minus} etiqueta="Alejar" onClick={() => zoom(-1)} />
      <BotonMapa Icono={Crosshair} etiqueta="Recentrar en los negocios" onClick={recentrar} />
      <BotonMapa
        Icono={Layers}
        etiqueta={tipoMapa === "hybrid" ? "Ver mapa" : "Ver satélite"}
        activa={tipoMapa === "hybrid"}
        onClick={() => onTipoMapa(tipoMapa === "hybrid" ? "roadmap" : "hybrid")}
      />
      <BotonMapa
        Icono={pantallaCompleta ? Minimize2 : Maximize2}
        etiqueta={pantallaCompleta ? "Salir de pantalla completa" : "Pantalla completa"}
        activa={pantallaCompleta}
        onClick={onPantallaCompleta}
      />
    </div>
  );
}
