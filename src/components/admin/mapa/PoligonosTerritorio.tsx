"use client";

import { useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import type { Territorio } from "@/lib/admin/territorios";
import { ACENTO } from "./colores";

/**
 * Dónde está el ratón, según el evento DOM que Google adjunta a los suyos.
 *
 * No hace falta proyectar nada: `domEvent` trae las coordenadas de pantalla
 * del evento real. Un evento de teclado o táctil no las trae, y ahí no hay
 * tarjeta que colocar (el hover no existe con el dedo).
 */
function coordenadasDom(e: google.maps.PolyMouseEvent): { x: number; y: number } | null {
  const dom = e.domEvent;
  if (!dom || !("clientX" in dom)) return null;
  return { x: dom.clientX, y: dom.clientY };
}

type Props = {
  territorios: Territorio[];
  activo: string | null;
  /** El territorio bajo el cursor: se resalta IGUAL que el activo (mismo
   * lenguaje visual, una sola forma de decir "este"). */
  encima: string | null;
  /** Capturando un punto nuevo o dibujando un territorio: el clic es para el
   * mapa, no para el relleno de un territorio ya guardado. */
  modoCaptura: boolean;
  onSeleccionar: (id: string) => void;
  /** El cursor está sobre un territorio, en estas coordenadas de pantalla.
   * Memoizado en el padre, como `onSeleccionar`. */
  onEncima: (id: string, clientX: number, clientY: number) => void;
  /** El cursor salió de `id`; con `null`, cerrar pase lo que pase (los
   * polígonos se están destruyendo y ya no van a avisar de nada). */
  onFuera: (id: string | null) => void;
};

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
export function PoligonosTerritorio({
  territorios,
  activo,
  encima,
  modoCaptura,
  onSeleccionar,
  onEncima,
  onFuera,
}: Props) {
  const map = useMap();
  const overlays = useRef(new Map<string, google.maps.Polygon>());

  useEffect(() => {
    if (!map) return;
    const creados = new Map<string, google.maps.Polygon>();
    const escuchas: google.maps.MapsEventListener[] = [];
    for (const t of territorios) {
      const poligono = new google.maps.Polygon({
        map,
        paths: t.poligono,
        fillColor: ACENTO,
        strokeColor: ACENTO,
        // Bajo los pines: el territorio es el escenario, no el actor.
        zIndex: 0,
      });
      escuchas.push(
        poligono.addListener("click", () => onSeleccionar(t.id)),
        // `mouseover` da el primer punto y `mousemove` la sigue: un territorio
        // es un ÁREA, y una tarjeta clavada donde entró el cursor se ve
        // abandonada en cuanto uno se mueve por dentro.
        poligono.addListener("mouseover", (e: google.maps.PolyMouseEvent) => {
          const p = coordenadasDom(e);
          if (p) onEncima(t.id, p.x, p.y);
        }),
        poligono.addListener("mousemove", (e: google.maps.PolyMouseEvent) => {
          const p = coordenadasDom(e);
          if (p) onEncima(t.id, p.x, p.y);
        }),
        poligono.addListener("mouseout", () => onFuera(t.id)),
      );
      creados.set(t.id, poligono);
    }
    overlays.current = creados;
    return () => {
      // Las escuchas se quitan a mano (no basta con `setMap(null)`): es la
      // misma disciplina de TrazoEnCurso, y aquí además son cuatro por
      // territorio.
      escuchas.forEach((l) => l.remove());
      creados.forEach((o) => o.setMap(null));
      overlays.current = new Map();
      // Los polígonos que iban a avisar del `mouseout` ya no existen: sin
      // esto la tarjeta se quedaría flotando sobre un mapa que ya no la
      // sostiene, enseñando cifras de un área que el cursor ya no señala.
      //
      // Cuesta un parpadeo: `territorios` es un array nuevo en cada
      // `router.refresh()` (o sea en cada tanda de un barrido), y ahí la
      // tarjeta se cierra aunque el cursor no se haya movido. Vuelve sola con
      // el primer `mousemove`. Preferimos el parpadeo a un número viejo: en
      // esta pantalla los contadores no mienten.
      onFuera(null);
    };
  }, [map, territorios, onSeleccionar, onEncima, onFuera]);

  // El resaltado y la clicabilidad se mutan sobre los overlays YA creados —
  // depende de `territorios` para alcanzar también a los que el efecto de
  // arriba acaba de crear en este mismo commit, sin recrear nada.
  useEffect(() => {
    for (const [id, poligono] of overlays.current) {
      const esActivo = id === activo || id === encima;
      poligono.setOptions({
        fillOpacity: esActivo ? 0.14 : 0.05,
        strokeOpacity: esActivo ? 0.9 : 0.35,
        strokeWeight: esActivo ? 2 : 1,
        // Igual que TrazoEnCurso: un relleno clicable se roba el clic que
        // "Añadir manual" o dibujar un territorio nuevo esperan del mapa. Y de
        // paso apaga el hover: sin clicabilidad no hay `mouseover` ni
        // `mouseout`, así que la tarjeta la cierra MapCanvas al entrar al modo.
        clickable: !modoCaptura,
      });
    }
  }, [territorios, activo, encima, modoCaptura]);

  return null;
}
