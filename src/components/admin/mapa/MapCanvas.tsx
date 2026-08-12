"use client";

import { useEffect } from "react";
import {
  AdvancedMarker,
  APIProvider,
  Map as GoogleMap,
  useMap,
} from "@vis.gl/react-google-maps";
import { CIUDADES, ESTADOS, type Ciudad, type Negocio } from "@/lib/admin/negocios";
import type { ResultadoPlace } from "@/lib/admin/places";
import type { Seleccion } from "./MapaView";

const MADRID = CIUDADES[0];
const LABEL_ESTADO = new Map(ESTADOS.map((e) => [e.valor, e.label]));

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
      <div className="adm-map-vacio">
        <p>
          El mapa necesita <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> y{" "}
          <code>NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID</code> en <code>.env.local</code>.
          La plantilla está en <code>.env.example</code>.
        </p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <GoogleMap
        className={props.modoCaptura ? "adm-map adm-map--captura" : "adm-map"}
        mapId={mapId}
        defaultCenter={MADRID.centro}
        defaultZoom={14}
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
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
              <div className="adm-pin-hit">
                <div
                  className={
                    activo
                      ? `adm-pin adm-pin--${n.estado} adm-pin--activo`
                      : `adm-pin adm-pin--${n.estado}`
                  }
                />
              </div>
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
                <div className="adm-pin-hit">
                  <div
                    className={
                      activo
                        ? "adm-pin adm-pin--resultado adm-pin--activo"
                        : "adm-pin adm-pin--resultado"
                    }
                  />
                </div>
              </AdvancedMarker>
            );
          })}

        {props.seleccion?.tipo === "nuevo" ? (
          <AdvancedMarker
            position={{ lat: props.seleccion.lat, lng: props.seleccion.lng }}
            title="Negocio nuevo"
            zIndex={30}
          >
            <div className="adm-pin-hit">
              <div className="adm-pin adm-pin--nuevo-manual adm-pin--activo" />
            </div>
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
