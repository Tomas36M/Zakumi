"use client";

import { useEffect } from "react";
import {
  AdvancedMarker,
  APIProvider,
  ControlPosition,
  Map as GoogleMap,
  useMap,
} from "@vis.gl/react-google-maps";
import {
  CIUDADES,
  ESTADOS,
  type Ciudad,
  type EstadoNegocio,
  type Negocio,
} from "@/lib/admin/negocios";
import type { ResultadoPlace } from "@/lib/admin/places";
import { cn } from "@/lib/cn";
import type { Seleccion } from "./MapaView";

const MADRID = CIUDADES[0];
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

/** Padding de 9px = target táctil ~34px sobre el pin de 16px. */
function PinHit({ children }: { children: React.ReactNode }) {
  return <div className="cursor-pointer p-[9px]">{children}</div>;
}

type Props = {
  negocios: Negocio[];
  resultados: ResultadoPlace[];
  seleccion: Seleccion;
  ciudadActiva: Exclude<Ciudad, "otra"> | null;
  modoCaptura: boolean;
  onSeleccionar: (seleccion: Seleccion) => void;
  onClickMapa: (lat: number, lng: number) => void;
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
        defaultCenter={MADRID.centro}
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
        <RecentrarCiudad ciudad={props.ciudadActiva} />

        {props.negocios.map((n) => {
          const activo =
            props.seleccion?.tipo === "negocio" && props.seleccion.id === n.id;
          return (
            <AdvancedMarker
              key={n.id}
              position={{ lat: n.lat, lng: n.lng }}
              title={`${n.nombre} — ${LABEL_ESTADO.get(n.estado) ?? n.estado}`}
              zIndex={activo ? 20 : 1}
              onClick={() => props.onSeleccionar({ tipo: "negocio", id: n.id })}
            >
              <PinHit>
                <div
                  className={cn(PIN_BASE, COLOR_PIN[n.estado], activo && PIN_ACTIVO)}
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
      </GoogleMap>
    </APIProvider>
  );
}

/** Recentra el mapa cuando cambia el chip de ciudad. */
function RecentrarCiudad({ ciudad }: { ciudad: Exclude<Ciudad, "otra"> | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !ciudad) return;
    const destino = CIUDADES.find((c) => c.valor === ciudad);
    if (!destino) return;
    map.panTo(destino.centro);
    map.setZoom(destino.valor === "bogota" ? 12 : 14);
  }, [map, ciudad]);

  return null;
}
