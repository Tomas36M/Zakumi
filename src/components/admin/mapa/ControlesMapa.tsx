"use client";

import { useMap } from "@vis.gl/react-google-maps";
import {
  Crosshair,
  Layers,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

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

/** Un botón redondo cuya etiqueta crece hacia la izquierda al pasar el ratón. */
function Accion({
  Icono,
  etiqueta,
  activa = false,
  onClick,
}: {
  Icono: LucideIcon;
  etiqueta: string;
  activa?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      aria-pressed={activa}
      title={etiqueta}
      onClick={onClick}
      className={cn(
        "group flex h-9 items-center self-end overflow-hidden rounded-full border bg-isla/90 backdrop-blur-sm transition-colors hover:border-acento/40 hover:text-tinta",
        activa ? "border-acento text-acento" : "border-hairline text-tinta-60",
      )}
    >
      <span className="max-w-0 overflow-hidden text-xs font-medium whitespace-nowrap opacity-0 transition-all duration-300 group-hover:max-w-40 group-hover:pl-3 group-hover:opacity-100">
        {etiqueta}
      </span>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center">
        <Icono className="h-4 w-4" />
      </span>
    </button>
  );
}

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
      <Accion Icono={Plus} etiqueta="Acercar" onClick={() => zoom(1)} />
      <Accion Icono={Minus} etiqueta="Alejar" onClick={() => zoom(-1)} />
      <Accion Icono={Crosshair} etiqueta="Recentrar en los negocios" onClick={recentrar} />
      <Accion
        Icono={Layers}
        etiqueta={tipoMapa === "hybrid" ? "Ver mapa" : "Ver satélite"}
        activa={tipoMapa === "hybrid"}
        onClick={() => onTipoMapa(tipoMapa === "hybrid" ? "roadmap" : "hybrid")}
      />
      <Accion
        Icono={pantallaCompleta ? Minimize2 : Maximize2}
        etiqueta={pantallaCompleta ? "Salir de pantalla completa" : "Pantalla completa"}
        activa={pantallaCompleta}
        onClick={onPantallaCompleta}
      />
    </div>
  );
}
