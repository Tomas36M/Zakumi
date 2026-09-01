"use client";

import { useEffect, useRef } from "react";
import { AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import { cajaDe, rectanguloAPuntos, type Punto } from "@/lib/admin/barrido";
import { ACENTO } from "@/components/admin/mapa/colores";

/**
 * Cómo se dibuja el área.
 *
 * - `rectangulo` (el que trae por defecto): un arrastre y el área está cerrada.
 *   Es la forma de casi todo lo que se barre ("este barrio"), y evita los
 *   veinte clics que el usuario reportó como el problema.
 * - `poligono`: clic por vértice, para áreas que un rectángulo no describe.
 */
export type ModoDibujo = "rectangulo" | "poligono";

const ESTILO = {
  fillColor: ACENTO,
  fillOpacity: 0.12,
  strokeColor: ACENTO,
  strokeWeight: 2,
  zIndex: 5,
};

type Props = {
  modo: ModoDibujo;
  /** Los vértices que lleva puestos el usuario. */
  trazo: readonly Punto[];
  /** El usuario editó la forma SOBRE el mapa (arrastró un vértice, movió una
   * esquina de la caja): reemplaza el trazo entero. Debe venir memoizado
   * (`useCallback` en el padre): está en las dependencias del efecto que crea
   * el overlay, y una función nueva en cada render lo recrearía —
   * parpadeando— en cada tecla que se pulse en el panel. */
  onTrazo: (puntos: Punto[]) => void;
  /** Clic sobre el relleno del polígono en curso. El relleno es clicable a
   * propósito (es lo que permite cerrar en el primer vértice), así que los
   * clics que no aterrizan en un tirador se reenvían como si fueran del mapa.
   * Memoizado, por lo mismo que `onTrazo`. */
  onAgregarPunto: (punto: Punto) => void;
  /** Clic en el primer vértice: la convención universal para cerrar un
   * contorno. Memoizado, por lo mismo que `onTrazo`. */
  onCerrarArea: () => void;
};

type PropsForma = Omit<Props, "modo">;

/**
 * El área que el usuario está dibujando, pintada sobre el mapa. Va DENTRO de
 * <MapCanvas> porque `useMap()` necesita el contexto del <APIProvider>.
 *
 * Se dibuja a mano y NO con `google.maps.drawing.DrawingManager`: esa librería
 * salió de la Maps JavaScript API en la v3.65 (en @types/google.maps@3.66 la
 * clase ya viene sin miembros y `DrawingManagerOptions` no existe). Polygon y
 * Rectangle sí siguen soportados, y son todo lo que se usa aquí.
 *
 * Cada modo es un componente aparte: montar y desmontar overlays al cambiar de
 * modo es trabajo de React, no de un `if` dentro de un efecto.
 */
export function TrazoEnCurso({ modo, ...resto }: Props) {
  return modo === "rectangulo" ? (
    <CajaEnCurso {...resto} />
  ) : (
    <ContornoEnCurso {...resto} />
  );
}

function puntosDeCamino(
  camino: google.maps.MVCArray<google.maps.LatLng>,
): Punto[] {
  return camino.getArray().map((p) => ({ lat: p.lat(), lng: p.lng() }));
}

/** Cuántos vértices comparten camino y trazo contados desde el principio.
 *
 * Con eso, aplicar el estado al overlay toca lo mínimo: si el trazo solo creció
 * por el final (un clic más), los tiradores que ya están puestos ni se
 * inmutan. No es cosmética — reescribir el camino entero mientras el usuario
 * arrastra un vértice destruye el tirador que tiene agarrado y le corta el
 * arrastre.
 *
 * La comparación es EXACTA porque el estado sale de estos mismos
 * `lat()`/`lng()`: no hay épsilon que valga. */
function comunesDesdeElPrincipio(
  camino: google.maps.MVCArray<google.maps.LatLng>,
  trazo: readonly Punto[],
): number {
  const tope = Math.min(camino.getLength(), trazo.length);
  let i = 0;
  while (i < tope) {
    const p = camino.getAt(i);
    if (p.lat() !== trazo[i].lat || p.lng() !== trazo[i].lng) break;
    i++;
  }
  return i;
}

/**
 * Modo contorno: clic por vértice, pero el polígono es EDITABLE — vértices que
 * se arrastran y tiradores intermedios que insertan uno nuevo. Eso es lo que
 * mata el "no puedo corregir un vértice mal puesto sin deshacer diez".
 */
function ContornoEnCurso({
  trazo,
  onTrazo,
  onAgregarPunto,
  onCerrarArea,
}: PropsForma) {
  const map = useMap();
  const camino = useRef<google.maps.MVCArray<google.maps.LatLng> | null>(null);
  // Lo que escribimos nosotros en el camino vuelve por los mismos eventos que
  // escuchamos: sin esta bandera, aplicar el estado dispara otro `onTrazo`.
  const aplicando = useRef(false);

  // El overlay se crea UNA vez y se le muta el camino: recrearlo en cada clic
  // hace parpadear el área entera.
  useEffect(() => {
    if (!map) return;
    const dibujo = new google.maps.Polygon({
      map,
      ...ESTILO,
      // Clicable a propósito (antes no lo era): es lo que deja cerrar el área
      // haciendo clic en el primer vértice.
      clickable: true,
      editable: true,
    });
    // Un anillo vacío, explícito: `getPath()` devuelve el primero, y un
    // polígono sin anillos no tiene ninguno que escuchar.
    dibujo.setPaths([[]]);
    // NUNCA `setPath`: ese método reemplaza el MVCArray y dejaría estas
    // escuchas colgadas de un array muerto. El camino se muta en su sitio.
    const ruta = dibujo.getPath();
    camino.current = ruta;

    const sincronizar = () => {
      if (aplicando.current) return;
      onTrazo(puntosDeCamino(ruta));
    };

    const escuchas = [
      // Las ediciones del usuario NO llegan a React solas: el camino es un
      // MVCArray y solo avisa por estos tres eventos.
      ruta.addListener("set_at", sincronizar),
      ruta.addListener("insert_at", sincronizar),
      ruta.addListener("remove_at", sincronizar),
      dibujo.addListener("click", (e: google.maps.PolyMouseEvent) => {
        if (e.vertex === 0 && ruta.getLength() >= 3) {
          onCerrarArea();
          return;
        }
        // Otro vértice (o un tirador intermedio): el usuario iba a arrastrar,
        // no a poner un vértice encima.
        if (e.vertex !== undefined || e.edge !== undefined) return;
        // Clic en el relleno: cuenta como clic en el mapa. Sin esto, el área
        // ya dibujada se tragaría los clics que la amplían.
        if (e.latLng) onAgregarPunto({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      }),
    ];

    // El cursor lo manda el mapa, no la clase CSS del contenedor: Google pone
    // su propia manita sobre el div de arrastre.
    map.setOptions({ draggableCursor: "crosshair" });

    return () => {
      escuchas.forEach((l) => l.remove());
      dibujo.setMap(null);
      camino.current = null;
      map.setOptions({ draggableCursor: null });
    };
  }, [map, onTrazo, onAgregarPunto, onCerrarArea]);

  // `map` va en las dependencias aunque no se use aquí: sin él, el orden de
  // los dos efectos (crear y luego pintar) sería lo único que garantiza que el
  // camino se aplique al overlay recién creado, y eso es un acoplamiento que se
  // rompe callado el día que alguien reordene.
  useEffect(() => {
    const ruta = camino.current;
    if (!ruta) return;
    const comunes = comunesDesdeElPrincipio(ruta, trazo);
    if (comunes === ruta.getLength() && comunes === trazo.length) return;
    aplicando.current = true;
    // Se quitan los que sobran por el final y se añaden los que faltan: en el
    // caso común —un clic más— no se toca ni un tirador de los ya puestos.
    while (ruta.getLength() > comunes) ruta.pop();
    for (let i = comunes; i < trazo.length; i++) {
      ruta.push(new google.maps.LatLng(trazo[i].lat, trazo[i].lng));
    }
    aplicando.current = false;
  }, [map, trazo]);

  return (
    <>
      {/* Con uno o dos vértices el polígono no se ve: los puntos son la única
          prueba de que el clic aterrizó. Desde el tercero los tiradores del
          polígono editable ya marcan cada vértice, y repetirlos aquí encima
          solo estorbaría al que quiere arrastrarlos. */}
      {trazo.length < 3 &&
        trazo.map((p, i) => (
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

function limitesDe(a: google.maps.LatLng, b: google.maps.LatLng) {
  // Con `extend` las esquinas pueden llegar en cualquier orden; el constructor
  // de dos argumentos exige suroeste y noreste, y un arrastre no los respeta.
  return new google.maps.LatLngBounds().extend(a).extend(b);
}

function puntosDeLimites(limites: google.maps.LatLngBounds): Punto[] | null {
  const so = limites.getSouthWest();
  const ne = limites.getNorthEast();
  return rectanguloAPuntos(
    { lat: so.lat(), lng: so.lng() },
    { lat: ne.lat(), lng: ne.lng() },
  );
}

/** Los mismos cuatro números, exactos: el trazo salió de estos getters. */
function mismosLimites(
  limites: google.maps.LatLngBounds | null,
  caja: google.maps.LatLngBoundsLiteral,
): boolean {
  if (!limites) return false;
  const so = limites.getSouthWest();
  const ne = limites.getNorthEast();
  return (
    so.lat() === caja.south &&
    so.lng() === caja.west &&
    ne.lat() === caja.north &&
    ne.lng() === caja.east
  );
}

/** Los controles del mapa (el zoom) viven DENTRO del mismo div que las
 * teselas: apretar ahí no puede empezar a dibujar una caja. */
function enUnControl(objetivo: EventTarget | null): boolean {
  return (
    objetivo instanceof Element &&
    objetivo.closest("button, a, .gmnoprint, .gm-style-cc") !== null
  );
}

/**
 * Modo rectángulo: se arrastra una caja y el área queda cerrada de un gesto.
 *
 * No hay nada de fábrica que haga esto sin `DrawingManager`, así que el
 * arrastre está hecho a mano sobre el DOM, y no sobre los eventos del mapa:
 * el mapa **no emite `mousedown` ni `mouseup`** — sus eventos de ratón son
 * click, dblclick, contextmenu, mousemove, mouseover y mouseout (verificado
 * contra la referencia de la Maps JavaScript API el 2026-09-01). El
 * `mousedown` se escucha en fase de CAPTURA sobre `map.getDiv()`, para que
 * ningún manejador interno de Google se lo quede antes, y el resto del gesto
 * en la ventana, que es donde el ratón se suelta la mitad de las veces.
 *
 * Del DOM llegan píxeles, no coordenadas: las traduce un `OverlayView` vacío,
 * que es la forma documentada de conseguir una proyección
 * (`fromContainerPixelToLatLng`). Cachear el último `mousemove` del mapa sería
 * más corto y estaría MAL: una rueda de zoom mueve el mapa bajo un puntero
 * quieto y la coordenada guardada deja de ser la de debajo del cursor.
 *
 * Mientras dura el arrastre hay que APAGAR el arrastre del mapa, porque si no
 * el navegador panea en vez de dibujar. Encenderlo de nuevo pasa por
 * `terminar()` y por la limpieza del efecto — un mapa que se quedó sin poder
 * moverse es peor bug que el que vinimos a arreglar.
 *
 * Es un gesto de RATÓN: en táctil no hay `mousedown` que valga y el camino es
 * el contorno libre, que se dibuja tocando.
 */
function CajaEnCurso({ trazo, onTrazo }: PropsForma) {
  const map = useMap();
  const caja = useRef<google.maps.Rectangle | null>(null);
  // Nuestro propio arrastre (el de dibujar), que no es el del usuario moviendo
  // una esquina de una caja ya hecha.
  const dibujando = useRef(false);
  const aplicando = useRef(false);

  useEffect(() => {
    if (!map) return;
    // Nace SIN eventos propios: mientras se arrastra, la caja crece justo
    // bajo el puntero y un overlay clicable ahí se quedaría con el `mousemove`
    // que el mapa necesita para seguirlo. Se vuelve clicable al terminar, que
    // es cuando hay que poder agarrarla.
    const rect = new google.maps.Rectangle({ ...ESTILO, clickable: false });
    caja.current = rect;
    let ancla: google.maps.LatLng | null = null;

    const div = map.getDiv();
    // Un overlay vacío, solo por su proyección: es la única API documentada
    // que traduce píxeles del contenedor a lat/lng. Los tres métodos van en
    // blanco a propósito — no pinta nada, no hay nada que añadir ni quitar.
    const proyector = new google.maps.OverlayView();
    proyector.onAdd = () => {};
    proyector.draw = () => {};
    proyector.onRemove = () => {};
    proyector.setMap(map);

    const posicion = (ev: MouseEvent): google.maps.LatLng | null => {
      const proyeccion = proyector.getProjection();
      if (!proyeccion) return null;
      const marco = div.getBoundingClientRect();
      return proyeccion.fromContainerPixelToLatLng(
        new google.maps.Point(ev.clientX - marco.left, ev.clientY - marco.top),
      );
    };

    const terminar = () => {
      if (!ancla) return;
      ancla = null;
      dibujando.current = false;
      // Lo PRIMERO, pase lo que pase después.
      map.setOptions({ draggable: true });
      const limites = rect.getBounds();
      const puntos = limites ? puntosDeLimites(limites) : null;
      if (!puntos) {
        // Un clic sin arrastrar no encierra área: se borra la caja de cero y
        // se sigue esperando el arrastre de verdad.
        rect.setMap(null);
        return;
      }
      // Ya hay área: ahora se ajusta con los tiradores de las esquinas y los
      // lados, o se mueve entera.
      rect.setOptions({ clickable: true, editable: true, draggable: true });
      onTrazo(puntos);
    };

    const empezar = (ev: MouseEvent) => {
      // El botón derecho abre el menú del navegador, no dibuja.
      if (ev.button !== 0) return;
      if (ancla || enUnControl(ev.target)) return;
      // Ya hay una caja: arrastrar el mapa vuelve a ser mover el mapa (que es
      // como se mira alrededor). Para dibujar otra está «Redibujar».
      if (rect.getMap() !== null) return;
      // Todavía sin proyección (el overlay se añade en el primer dibujado del
      // mapa): no se dibuja a ciegas.
      const inicio = posicion(ev);
      if (!inicio) return;
      ancla = inicio;
      dibujando.current = true;
      // Sin esto el navegador PANEA el mapa en vez de dibujar la caja.
      map.setOptions({ draggable: false });
      // Y sin esto el navegador intenta "arrastrar" las teselas como imágenes.
      ev.preventDefault();
      rect.setOptions({ clickable: false, editable: false, draggable: false });
      rect.setBounds(limitesDe(inicio, inicio));
      rect.setMap(map);
    };

    // En la ventana y no en el mapa: al arrastrar hacia afuera, la caja sigue
    // creciendo hasta donde va el ratón en vez de congelarse en el borde.
    const mover = (ev: MouseEvent) => {
      if (!ancla) return;
      const p = posicion(ev);
      if (p) rect.setBounds(limitesDe(ancla, p));
    };

    const escuchas = [
      rect.addListener("bounds_changed", () => {
        // Mientras dibujamos, la caja la manda el ratón y el estado espera al
        // mouseup: un `onTrazo` por cada píxel no aporta nada.
        if (aplicando.current || dibujando.current) return;
        const limites = rect.getBounds();
        const puntos = limites ? puntosDeLimites(limites) : null;
        if (puntos) onTrazo(puntos);
      }),
    ];

    // En captura: los manejadores internos de Google cuelgan más adentro del
    // div, y en burbuja podrían habérselo quedado antes.
    div.addEventListener("mousedown", empezar, true);
    window.addEventListener("mousemove", mover);
    // El `mouseup` va en la ventana, no en el mapa: el botón se suelta fuera
    // del mapa tan a menudo como dentro, y ahí el arrastre quedaría abierto
    // con el mapa clavado sin poder moverse.
    window.addEventListener("mouseup", terminar);
    map.setOptions({ draggableCursor: "crosshair" });

    return () => {
      div.removeEventListener("mousedown", empezar, true);
      window.removeEventListener("mousemove", mover);
      window.removeEventListener("mouseup", terminar);
      escuchas.forEach((l) => l.remove());
      proyector.setMap(null);
      rect.setMap(null);
      caja.current = null;
      // Incondicional: salir del dibujo, cambiar de modo o desmontar la
      // pantalla a media caja no puede dejar el mapa sin poder moverse.
      map.setOptions({ draggable: true, draggableCursor: null });
    };
  }, [map, onTrazo]);

  // `map` en las dependencias por lo mismo que en el modo contorno.
  useEffect(() => {
    const rect = caja.current;
    if (!map || !rect || dibujando.current) return;
    if (trazo.length === 0) {
      rect.setOptions({ clickable: false, editable: false, draggable: false });
      rect.setMap(null);
      return;
    }
    const { sur, norte, oeste, este } = cajaDe(trazo);
    const limites = { south: sur, north: norte, west: oeste, east: este };
    if (!mismosLimites(rect.getBounds(), limites)) {
      aplicando.current = true;
      rect.setBounds(limites);
      aplicando.current = false;
    }
    rect.setMap(map);
    rect.setOptions({ clickable: true, editable: true, draggable: true });
  }, [map, trazo]);

  return null;
}
