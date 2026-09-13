"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import { MarkerClusterer, type Marker, type Renderer } from "@googlemaps/markerclusterer";
import { esSinWeb, labelEstado, type Negocio } from "@/lib/admin/negocios";
import { cn } from "@/lib/cn";
import { COLOR_PIN, PIN_ACTIVO, PIN_BASE, PIN_SIN_WEB, PinHit } from "./pines";

/** La burbuja de un grupo. Clases literales (Tailwind) sobre un nodo hecho a
 * mano: el clusterer pide un elemento, no un componente. */
const BURBUJA =
  "flex h-9 min-w-9 items-center justify-center rounded-full border-2 border-white/80 bg-acento px-2 text-xs font-bold text-white shadow-[0_1px_4px_rgba(0,0,0,0.5)]";

const renderer: Renderer = {
  render: ({ count, position }) => {
    const content = document.createElement("div");
    content.className = BURBUJA;
    content.textContent = String(count);
    return new google.maps.marker.AdvancedMarkerElement({
      position,
      content,
      // El `title` es el tooltip: una burbuja pelada no dice de qué es.
      title: `${count} negocios`,
      zIndex: 1000 + count,
    });
  },
};

/** A partir de este zoom ya se ven manzanas: los pines van sueltos. */
const ZOOM_SIN_GRUPOS = 16;

type Props = {
  negocios: Negocio[];
  activoId: string | null;
  onSeleccionar: (id: string) => void;
};

/**
 * Los pines de los negocios, agrupados en burbujas cuando se amontonan. Un
 * barrido mete decenas de pines en una manzana y de lejos son una mancha; de
 * cerca (zoom ≥ 16) se separan y cada uno vuelve a ser clicable.
 *
 * Patrón del ejemplo oficial de @vis.gl/react-google-maps: los
 * `AdvancedMarker` se registran por `ref` en un diccionario y el clusterer se
 * alimenta de ese diccionario. React sigue siendo dueño de los marcadores; el
 * clusterer solo decide cuáles se ven.
 */
export function Marcadores({ negocios, activoId, onSeleccionar }: Props) {
  const map = useMap();
  const clusterer = useRef<MarkerClusterer | null>(null);
  const [marcadores, setMarcadores] = useState<Record<string, Marker>>({});

  useEffect(() => {
    if (!map) return;
    const c = new MarkerClusterer({
      map,
      renderer,
      algorithmOptions: { maxZoom: ZOOM_SIN_GRUPOS },
    });
    clusterer.current = c;
    return () => {
      c.clearMarkers();
      c.setMap(null);
      clusterer.current = null;
    };
  }, [map]);

  // Cada cambio de la lista (filtros, refresh) se vuelca entero al clusterer:
  // `clearMarkers` devuelve los que salieron al mapa y `addMarkers` los
  // reparte de nuevo. Con cientos de pines es un recálculo barato.
  useEffect(() => {
    const c = clusterer.current;
    if (!c) return;
    c.clearMarkers(true);
    c.addMarkers(Object.values(marcadores));
  }, [marcadores, map]);

  // Un ref callback ESTABLE por negocio. Uno inline cambia de identidad en
  // cada render, y React lo llama con null y de nuevo con el nodo cada vez:
  // dos setState por marcador por render, que a su vez re-renderiza — un
  // bucle. Memoizados sobre la lista, solo cambian cuando cambia la lista
  // (y ahí sí hay que re-registrar).
  const refs = useMemo(() => {
    const m = new Map<string, (marker: Marker | null) => void>();
    for (const n of negocios) {
      const id = n.id;
      m.set(id, (marker) =>
        setMarcadores((prev) => {
          if (marker) {
            if (prev[id] === marker) return prev;
            return { ...prev, [id]: marker };
          }
          if (!(id in prev)) return prev;
          const resto = { ...prev };
          delete resto[id];
          return resto;
        }),
      );
    }
    return m;
  }, [negocios]);

  return (
    <>
      {negocios.map((n) => {
        const activo = n.id === activoId;
        return (
          <AdvancedMarker
            key={n.id}
            ref={refs.get(n.id)}
            position={{ lat: n.lat, lng: n.lng }}
            title={`${n.nombre} — ${labelEstado(n.estado)}${esSinWeb(n) ? " — sin sitio web" : ""}`}
            zIndex={activo ? 20 : 1}
            onClick={() => onSeleccionar(n.id)}
          >
            <PinHit>
              <div
                className={cn(
                  PIN_BASE,
                  COLOR_PIN[n.estado],
                  esSinWeb(n) && PIN_SIN_WEB,
                  activo && PIN_ACTIVO,
                )}
              />
            </PinHit>
          </AdvancedMarker>
        );
      })}
    </>
  );
}
