"use client";

import { useEffect, useRef } from "react";
import { AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import type { Punto } from "@/lib/admin/barrido";

// El naranja del panel (--color-acento). Un overlay de Google no lee tokens
// CSS: hay que darle el literal.
const ACENTO = "#DB5227";

/**
 * El área que el usuario está dibujando, pintada sobre el mapa. Va DENTRO de
 * <MapCanvas> porque `useMap()` necesita el contexto del <APIProvider>.
 *
 * Se dibuja a mano, clic a clic, y NO con `google.maps.drawing.DrawingManager`:
 * esa librería salió de la Maps JavaScript API en la v3.65 (en
 * @types/google.maps@3.66 la clase ya viene sin miembros y
 * `DrawingManagerOptions` no existe). Un polígono normal sí sigue soportado.
 */
export function TrazoEnCurso({ trazo }: { trazo: readonly Punto[] }) {
  const map = useMap();
  const poligono = useRef<google.maps.Polygon | null>(null);

  // El overlay se crea UNA vez y se le cambia el path: recrearlo en cada clic
  // hace parpadear el área entera.
  useEffect(() => {
    if (!map) return;
    const dibujo = new google.maps.Polygon({
      map,
      fillColor: ACENTO,
      fillOpacity: 0.12,
      strokeColor: ACENTO,
      strokeWeight: 2,
      clickable: false,
      zIndex: 5,
    });
    poligono.current = dibujo;
    return () => {
      dibujo.setMap(null);
      poligono.current = null;
    };
  }, [map]);

  // `map` va en las dependencias aunque no se use aquí: sin él, el orden de
  // los dos efectos (crear y luego pintar) sería lo único que garantiza que el
  // path se aplique al overlay recién creado, y eso es un acoplamiento que se
  // rompe callado el día que alguien reordene.
  useEffect(() => {
    poligono.current?.setPath([...trazo]);
  }, [map, trazo]);

  return (
    <>
      {/* Con uno o dos vértices el polígono no se ve: los puntos son la única
          prueba de que el clic aterrizó. */}
      {trazo.map((p, i) => (
        <AdvancedMarker
          key={`${p.lat},${p.lng},${i}`}
          position={p}
          title={`Vértice ${i + 1}`}
          zIndex={6}
        >
          <div className="h-2.5 w-2.5 rounded-full border border-white bg-acento" />
        </AdvancedMarker>
      ))}
    </>
  );
}
