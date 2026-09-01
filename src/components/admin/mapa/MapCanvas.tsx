"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AdvancedMarker,
  APIProvider,
  ControlPosition,
  Map as GoogleMap,
  useMap,
} from "@vis.gl/react-google-maps";
import {
  esSinWeb,
  ESTADOS,
  type EstadoNegocio,
  type Negocio,
} from "@/lib/admin/negocios";
import type { ResultadoPlace } from "@/lib/admin/places";
import {
  cuentasPorTerritorio,
  resumenDeTerritorio,
  type Territorio,
} from "@/lib/admin/territorios";
import { cn } from "@/lib/cn";
import type { Seleccion } from "@/components/admin/prospeccion/TerritorioView";
import { ACENTO } from "./colores";
import { TarjetaTerritorio } from "./TarjetaTerritorio";

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

/** Separación en píxeles entre el cursor y la esquina de la tarjeta: acompaña
 * al puntero sin taparle justo el trozo de mapa que está señalando. */
const SEPARACION_TARJETA = 14;

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

/**
 * Pone la tarjeta junto al cursor, dentro del mapa.
 *
 * Se mide el nodo de verdad (`offsetWidth`/`offsetHeight`) en vez de asumir un
 * tamaño: las dos caras de la tarjeta —barrido y sin barrer— no miden lo
 * mismo, y un territorio pegado al borde del mapa no puede dejarla a medias
 * fuera. Si no cabe hacia la derecha o hacia abajo, salta al otro lado del
 * puntero, que es donde sí hay sitio.
 */
function colocarTarjeta(
  tarjeta: HTMLDivElement | null,
  marco: HTMLDivElement | null,
  clientX: number,
  clientY: number,
) {
  if (!tarjeta || !marco) return;
  const caja = marco.getBoundingClientRect();
  // Coordenadas dentro del mapa: `marco` es el `offsetParent` de la tarjeta.
  const x = clientX - caja.left;
  const y = clientY - caja.top;
  const izquierda =
    x + SEPARACION_TARJETA + tarjeta.offsetWidth <= caja.width
      ? x + SEPARACION_TARJETA
      : x - SEPARACION_TARJETA - tarjeta.offsetWidth;
  const arriba =
    y + SEPARACION_TARJETA + tarjeta.offsetHeight <= caja.height
      ? y + SEPARACION_TARJETA
      : y - SEPARACION_TARJETA - tarjeta.offsetHeight;
  // Un mapa más chico que la tarjeta (móvil angosto): pegada al borde antes
  // que fuera de la vista.
  tarjeta.style.transform = `translate(${Math.round(Math.max(0, izquierda))}px, ${Math.round(
    Math.max(0, arriba),
  )}px)`;
}

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
  encima,
  modoCaptura,
  onSeleccionar,
  onEncima,
  onFuera,
}: {
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
}) {
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
  const territorios = props.territorios ?? SIN_TERRITORIOS;
  const modoCaptura = props.modoCaptura;

  // Qué territorio tiene el cursor encima. Solo el ID: la POSICIÓN vive en un
  // ref y se aplica al nodo a mano (ver `alEncima`), porque un `setState` por
  // cada píxel del `mousemove` volvería a renderizar los cientos de pines del
  // mapa sesenta veces por segundo.
  const [encima, setEncima] = useState<{ id: string } | null>(null);
  const raton = useRef({ x: 0, y: 0 });
  const marco = useRef<HTMLDivElement | null>(null);
  const tarjeta = useRef<HTMLDivElement | null>(null);

  // Los números del hover salen del MISMO recuento que la lista de la
  // izquierda (`cuentasPorTerritorio`), no de un bucle propio.
  const cuentas = useMemo(
    () => cuentasPorTerritorio(props.negocios),
    [props.negocios],
  );

  const alEncima = useCallback((id: string, x: number, y: number) => {
    raton.current = { x, y };
    // Mientras no cambie de territorio, la tarjeta sigue al cursor sin pasar
    // por React: el nodo ya está montado y solo cambia su `transform`.
    colocarTarjeta(tarjeta.current, marco.current, x, y);
    setEncima((actual) => (actual?.id === id ? actual : { id }));
  }, []);

  const alFuera = useCallback((id: string | null) => {
    setEncima((actual) => {
      if (actual === null) return null;
      // Con dos territorios pegados, el `mouseout` del que se deja puede
      // llegar DESPUÉS del `mouseover` del que se entra: cerrar a ciegas
      // apagaría la tarjeta recién abierta.
      if (id !== null && actual.id !== id) return actual;
      return null;
    });
  }, []);

  // La tarjeta se coloca en su propio ref: corre justo después de montarla y
  // antes de pintar, así que no hay ni un fotograma en la esquina del mapa. Un
  // `useLayoutEffect` haría lo mismo, pero avisa por consola al renderizar en
  // el servidor.
  const refTarjeta = useCallback((nodo: HTMLDivElement | null) => {
    tarjeta.current = nodo;
    colocarTarjeta(nodo, marco.current, raton.current.x, raton.current.y);
  }, []);

  // Dibujar un territorio o "Añadir manual" apaga la clicabilidad de los
  // polígonos (PoligonosTerritorio): dejan de llegarles eventos de ratón, o sea
  // que el `mouseout` que cerraría la tarjeta NO va a llegar nunca. Se cierra
  // aquí, durante el render y no en un efecto — es el mismo ajuste de estado
  // ante un prop que hace TerritorioView con el territorio del barrido vivo.
  if (modoCaptura && encima !== null) setEncima(null);

  const territorioEncima = encima
    ? (territorios.find((t) => t.id === encima.id) ?? null)
    : null;

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
      {/* Un marco propio, hermano del mapa: es el `offsetParent` de la
          tarjeta, y así el hover no se cuela dentro del div que Google se
          reserva para sus teselas. */}
      <div
        ref={marco}
        className="relative h-full w-full"
        // Salir del mapa de un tirón (hacia el panel, hacia otra pestaña) no
        // siempre le llega al polígono como `mouseout`: la tarjeta no puede
        // quedarse clavada sobre un mapa que ya nadie está señalando.
        onMouseLeave={() => setEncima(null)}
      >
        <GoogleMap
          className={cn("h-full w-full", modoCaptura && "cursor-crosshair")}
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
            territorios={territorios}
            activo={props.territorioActivo ?? null}
            encima={encima?.id ?? null}
            modoCaptura={modoCaptura}
            onSeleccionar={props.onSeleccionarTerritorio ?? noSeleccionarTerritorio}
            onEncima={alEncima}
            onFuera={alFuera}
          />

          {props.negocios.map((n) => {
            const activo =
              props.seleccion?.tipo === "negocio" && props.seleccion.id === n.id;
            return (
              <AdvancedMarker
                key={n.id}
                position={{ lat: n.lat, lng: n.lng }}
                title={`${n.nombre} — ${LABEL_ESTADO.get(n.estado) ?? n.estado}${
                  esSinWeb(n) ? " — sin sitio web" : ""
                }`}
                zIndex={activo ? 20 : 1}
                onClick={() => props.onSeleccionar({ tipo: "negocio", id: n.id })}
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

        {/* Fuera del <GoogleMap> a propósito: sus hijos van dentro del div de
            las teselas, que Google reordena a su antojo. Y `pointer-events-none`
            porque la tarjeta viaja pegada al cursor: si atrapara el ratón se
            robaría el `mousemove` del polígono que la mantiene viva y
            parpadearía sola.

            `modoCaptura` la esconde además del ajuste que la cierra: mientras
            se dibuja un área, el mapa es un lienzo y nada flota encima. */}
        {territorioEncima && !modoCaptura ? (
          <div
            // `key` por territorio: cambiar de área remonta la tarjeta y su
            // `ref` la vuelve a colocar MIDIENDO el contenido nuevo. Las dos
            // caras no miden lo mismo, y pasar de una corta a una larga junto
            // al borde de abajo la dejaría cortada hasta el siguiente
            // `mousemove`.
            key={territorioEncima.id}
            ref={refTarjeta}
            className="pointer-events-none absolute top-0 left-0 z-20 w-64 rounded-fila border border-hairline bg-isla/95 p-3 backdrop-blur-sm"
          >
            <TarjetaTerritorio
              territorio={territorioEncima}
              resumen={resumenDeTerritorio(territorioEncima, cuentas)}
            />
          </div>
        ) : null}
      </div>
    </APIProvider>
  );
}
