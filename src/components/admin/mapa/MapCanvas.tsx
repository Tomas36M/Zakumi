"use client";

import { useEffect, useRef } from "react";
import {
  AdvancedMarker,
  APIProvider,
  ControlPosition,
  Map as GoogleMap,
  useMap,
} from "@vis.gl/react-google-maps";
import { ESTADOS, type EstadoNegocio, type Negocio } from "@/lib/admin/negocios";
import type { ResultadoPlace } from "@/lib/admin/places";
import type { Territorio } from "@/lib/admin/territorios";
import { cn } from "@/lib/cn";
import type { Seleccion } from "@/components/admin/prospeccion/TerritorioView";
import { ACENTO } from "./colores";

// Solo el encuadre de arranque del mapa (Madrid, Cundinamarca) — ya NO es un
// preset de búsqueda: con territorios libres el sesgo de la búsqueda sale del
// viewport actual, no de una ciudad fija.
const CENTRO_INICIAL = { lat: 4.7326, lng: -74.2642 };

const LABEL_ESTADO = new Map(ESTADOS.map((e) => [e.valor, e.label]));

// Rombos por estado — mismo lenguaje que chips y badges (clases literales).
const COLOR_PIN: Record<EstadoNegocio, string> = {
  nuevo: "bg-estado-nuevo",
  contactado: "bg-estado-contactado",
  respondido: "bg-estado-respondido",
  interesado: "bg-estado-interesado",
  cliente: "bg-estado-cliente",
  descartado: "bg-estado-descartado",
};

const PIN_BASE =
  "h-4 w-4 rotate-45 border-[1.5px] border-black/80 shadow-[0_1px_4px_rgba(0,0,0,0.5)] transition-transform duration-150";
const PIN_ACTIVO = "scale-[1.45] border-white";

// Anillo de "sin web": el lead que queremos. Va en un canal distinto al
// relleno (estado, COLOR_PIN) y al contorno naranja (resultado sin importar,
// más abajo), para que las tres señales se puedan leer a la vez.
const PIN_SIN_WEB = "ring-2 ring-offset-1 ring-acento ring-offset-transparent";

/** Padding de 9px = target táctil ~34px sobre el pin de 16px. */
function PinHit({ children }: { children: React.ReactNode }) {
  return <div className="cursor-pointer p-[9px]">{children}</div>;
}

// Territorio sin dueño: identidad estable para que el efecto de
// PoligonosTerritorio no se repita en cada render si algún caller no le pasa
// territorios.
const SIN_TERRITORIOS: Territorio[] = [];

function noSeleccionarTerritorio() {}

/**
 * Los territorios guardados, pintados como polígonos. Mismo patrón que
 * TrazoEnCurso: `@vis.gl/react-google-maps` no trae `<Polygon>`, así que el
 * overlay se crea y se limpia a mano dentro de un componente hijo del mapa
 * (necesita `useMap()`). El cleanup NO es opcional: sin él, cada render deja
 * un polígono huérfano apilado sobre el anterior y se acumulan en silencio.
 *
 * Los overlays se crean UNA vez por lista de territorios (igual que
 * TrazoEnCurso crea el suyo una vez) y el resaltado se aplica después con
 * `setOptions` sobre los ya existentes: recrearlos en cada cambio de `activo`
 * o `modoCaptura` haría parpadear TODOS los polígonos cuando en realidad solo
 * cambió cuál está resaltado.
 */
function PoligonosTerritorio({
  territorios,
  activo,
  modoCaptura,
  onSeleccionar,
}: {
  territorios: Territorio[];
  activo: string | null;
  /** Capturando un punto nuevo o dibujando un territorio: el clic es para el
   * mapa, no para el relleno de un territorio ya guardado. */
  modoCaptura: boolean;
  onSeleccionar: (id: string) => void;
}) {
  const map = useMap();
  const overlays = useRef(new Map<string, google.maps.Polygon>());

  useEffect(() => {
    if (!map) return;
    const creados = new Map<string, google.maps.Polygon>();
    for (const t of territorios) {
      const poligono = new google.maps.Polygon({
        map,
        paths: t.poligono,
        fillColor: ACENTO,
        strokeColor: ACENTO,
        // Bajo los pines: el territorio es el escenario, no el actor.
        zIndex: 0,
      });
      poligono.addListener("click", () => onSeleccionar(t.id));
      creados.set(t.id, poligono);
    }
    overlays.current = creados;
    return () => {
      creados.forEach((o) => o.setMap(null));
      overlays.current = new Map();
    };
  }, [map, territorios, onSeleccionar]);

  // El resaltado y la clicabilidad se mutan sobre los overlays YA creados —
  // depende de `territorios` para alcanzar también a los que el efecto de
  // arriba acaba de crear en este mismo commit, sin recrear nada.
  useEffect(() => {
    for (const [id, poligono] of overlays.current) {
      const esActivo = id === activo;
      poligono.setOptions({
        fillOpacity: esActivo ? 0.14 : 0.05,
        strokeOpacity: esActivo ? 0.9 : 0.35,
        strokeWeight: esActivo ? 2 : 1,
        // Igual que TrazoEnCurso: un relleno clicable se roba el clic que
        // "Añadir manual" o dibujar un territorio nuevo esperan del mapa.
        clickable: !modoCaptura,
      });
    }
  }, [territorios, activo, modoCaptura]);

  return null;
}

type Props = {
  negocios: Negocio[];
  resultados: ResultadoPlace[];
  seleccion: Seleccion;
  modoCaptura: boolean;
  onSeleccionar: (seleccion: Seleccion) => void;
  onClickMapa: (lat: number, lng: number) => void;
  /** Territorios guardados, dibujados como polígonos bajo los pines. Opcional:
   * un caller sin territorios (o mientras cargan) puede omitirlo. */
  territorios?: Territorio[];
  /** El territorio que se pinta con más opacidad — hoy, el que el caller
   * decida resaltar (p.ej. el que tiene el barrido abierto). */
  territorioActivo?: string | null;
  /** Clic sobre un polígono de territorio. Debe venir memoizado
   * (`useCallback` en el padre): está en las dependencias del efecto de
   * PoligonosTerritorio, y una función nueva en cada render redibuja todos
   * los polígonos en cada tecla que se pulse. */
  onSeleccionarTerritorio?: (id: string) => void;
  /** Overlays que necesitan el contexto del mapa (useMap/useMapsLibrary): el
   * trazo en curso de un territorio nuevo (TrazoEnCurso) vive aquí adentro. */
  children?: React.ReactNode;
};

export function MapCanvas(props: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;

  if (!apiKey || !mapId) {
    return (
      <div className="grid h-full place-items-center rounded-isla border border-dashed border-hairline p-8 text-center text-sm text-tinta-60">
        <p>
          El mapa necesita{" "}
          <code className="text-[0.8em] text-acento">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> y{" "}
          <code className="text-[0.8em] text-acento">NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID</code> en{" "}
          <code className="text-[0.8em] text-acento">.env.local</code>. La plantilla está en{" "}
          <code className="text-[0.8em] text-acento">.env.example</code>.
        </p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <GoogleMap
        className={cn("h-full w-full", props.modoCaptura && "cursor-crosshair")}
        mapId={mapId}
        defaultCenter={CENTRO_INICIAL}
        defaultZoom={14}
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        // Abajo al centro: las islas flotantes cubren las esquinas superiores
        // y (cuando su contenido es largo) los laterales completos.
        zoomControlOptions={{ position: ControlPosition.BLOCK_END_INLINE_CENTER }}
        onClick={(e) => {
          const punto = e.detail.latLng;
          if (punto) props.onClickMapa(punto.lat, punto.lng);
        }}
      >
        {/* Bajo los pines (zIndex 0 en el overlay): el territorio es el
            escenario, no el actor. */}
        <PoligonosTerritorio
          territorios={props.territorios ?? SIN_TERRITORIOS}
          activo={props.territorioActivo ?? null}
          modoCaptura={props.modoCaptura}
          onSeleccionar={props.onSeleccionarTerritorio ?? noSeleccionarTerritorio}
        />

        {props.negocios.map((n) => {
          const activo =
            props.seleccion?.tipo === "negocio" && props.seleccion.id === n.id;
          return (
            <AdvancedMarker
              key={n.id}
              position={{ lat: n.lat, lng: n.lng }}
              title={`${n.nombre} — ${LABEL_ESTADO.get(n.estado) ?? n.estado}${
                n.sitio_web ? "" : " — sin sitio web"
              }`}
              zIndex={activo ? 20 : 1}
              onClick={() => props.onSeleccionar({ tipo: "negocio", id: n.id })}
            >
              <PinHit>
                <div
                  className={cn(
                    PIN_BASE,
                    COLOR_PIN[n.estado],
                    !n.sitio_web && PIN_SIN_WEB,
                    activo && PIN_ACTIVO,
                  )}
                />
              </PinHit>
            </AdvancedMarker>
          );
        })}

        {props.resultados
          .filter((r) => !r.yaImportado)
          .map((r) => {
            const activo =
              props.seleccion?.tipo === "resultado" &&
              props.seleccion.placeId === r.placeId;
            return (
              <AdvancedMarker
                key={r.placeId}
                position={{ lat: r.lat, lng: r.lng }}
                title={`${r.nombre} — resultado sin importar`}
                zIndex={activo ? 20 : 2}
                onClick={() =>
                  props.onSeleccionar({ tipo: "resultado", placeId: r.placeId })
                }
              >
                <PinHit>
                  <div
                    className={cn(
                      PIN_BASE,
                      "border-2 border-acento bg-transparent",
                      activo && PIN_ACTIVO,
                    )}
                  />
                </PinHit>
              </AdvancedMarker>
            );
          })}

        {props.seleccion?.tipo === "nuevo" ? (
          <AdvancedMarker
            position={{ lat: props.seleccion.lat, lng: props.seleccion.lng }}
            title="Negocio nuevo"
            zIndex={30}
          >
            <PinHit>
              <div className={cn(PIN_BASE, "border-acento bg-white", PIN_ACTIVO)} />
            </PinHit>
          </AdvancedMarker>
        ) : null}

        {props.children}
      </GoogleMap>
    </APIProvider>
  );
}
