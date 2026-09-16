"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { poligonoSeCruza, type PermisoBarrido, type Punto } from "@/lib/admin/barrido";
import { FILTRO_VACIO, filtrarLeads, type FiltroLeads } from "@/lib/admin/filtros-leads";
import type { EstadoCenso, Negocio } from "@/lib/admin/negocios";
import type { ResultadoPlace } from "@/lib/admin/places";
import {
  cuentasPorTerritorio,
  resumenDeTerritorio,
  VERTICES_MAX,
  type Territorio,
} from "@/lib/admin/territorios";
import { cn } from "@/lib/cn";
import type { TipoMapa } from "@/components/admin/mapa/ControlesMapa";
import { FiltrosMapa } from "@/components/admin/mapa/FiltrosMapa";
import { MapCanvas } from "@/components/admin/mapa/MapCanvas";
import { SearchPanel } from "@/components/admin/mapa/SearchPanel";
import { usePantallaCompleta } from "@/components/admin/mapa/usePantallaCompleta";
import { BarraTerritorio } from "./BarraTerritorio";
import { BarridoProgreso, type AvisoBarrido } from "./BarridoProgreso";
import { DialogoBarrer } from "./DialogoBarrer";
import { DibujarTerritorio } from "./DibujarTerritorio";
import { EncuadrarTerritorio, type Encuadre } from "./EncuadrarTerritorio";
import { FichaLateral } from "./FichaLateral";
import { FichaTerritorio } from "./FichaTerritorio";
import { modoInicial, TrazoEnCurso, type ModoDibujo } from "./TrazoEnCurso";
import { useBusquedaPlaces } from "./useBusquedaPlaces";

/** Qué está abierto en la isla derecha (o qué pin está activo). Vive aquí
 * porque MapCanvas lo importa. */
export type Seleccion =
  | { tipo: "negocio"; id: string }
  | { tipo: "resultado"; placeId: string }
  | { tipo: "nuevo"; lat: number; lng: number }
  | { tipo: "territorio"; id: string }
  | { tipo: "busqueda" }
  | null;

// ≥1000px la ficha flota como isla sobre el mapa (profundidad por capas).
const ISLA_FLOTANTE =
  "min-[1000px]:absolute min-[1000px]:top-8 min-[1000px]:right-8 min-[1000px]:z-10 min-[1000px]:w-[340px] min-[1000px]:max-h-[calc(100%-5rem)] min-[1000px]:rounded-isla min-[1000px]:border min-[1000px]:border-hairline min-[1000px]:bg-isla/95 min-[1000px]:p-4 min-[1000px]:backdrop-blur-sm";

/** Un barrido abierto: el id del territorio, las verticales confirmadas y el
 * permiso de gasto que se concedió al confirmar (lo aprobado, cuánto de eso no
 * se paga y el techo de llamadas emitidas). El territorio se busca vivo en el
 * array — el prop se renueva en cada router.refresh() del barrido y una copia
 * se quedaría con el contador viejo. */
export type BarridoAbierto = {
  territorioId: string;
  verticales: string[];
  permiso: PermisoBarrido;
};

type Props = {
  negocios: Negocio[];
  territorios: Territorio[];
  /** La consulta de territorios falló: la lista vacía no es "no hay". */
  fallaTerritorios: boolean;
  /** Consultas a Google Places del mes; `null` = no se pudo leer (baja tal
   * cual hasta `DialogoBarrer`, que no afirma cuota gratis sin dato). */
  consultasMes: number | null;
  /** El barrido abierto vive en el shell (las caras lo marcan). */
  barrido: BarridoAbierto | null;
  onBarrido: (barrido: BarridoAbierto | null) => void;
  /** El estado vivo del barrido, para que el shell lo pinte en la cara Leads.
   * Se pasa tal cual: tiene que conservar su identidad entre renders. */
  onAvisoBarrido: (aviso: AvisoBarrido | null) => void;
  /** La cara está en segundo plano: se esconde, NUNCA se desmonta (adentro
   * puede haber un barrido en vuelo). */
  oculta: boolean;
  /** La ficha del lead (modal) vive en el shell: aquí solo se pide abrirla. */
  onAbrirLead: (id: string) => void;
  /** El lead cuya ficha está abierta: su pin se pinta activo. */
  leadAbierto: string | null;
  /** `?territorio=<id>`: arrancar con su ficha abierta y el mapa encuadrado. */
  territorioInicial: string | null;
  /** Si la lista de pines viene topada: se dice DENTRO del mapa, en los filtros. */
  censo: EstadoCenso;
};

/**
 * La cara Territorio: el mapa a lienzo completo, donde se dibuja un área, se
 * estima lo que cuesta barrerla y se ve avanzar el barrido. Un territorio se
 * abre tocando su polígono; su ficha (y la de un resultado suelto o un alta
 * manual) flota a la derecha. La ficha de un lead es el modal del shell.
 */
export function TerritorioView({
  negocios,
  territorios,
  fallaTerritorios,
  consultasMes,
  barrido,
  onBarrido,
  onAvisoBarrido,
  oculta,
  onAbrirLead,
  leadAbierto,
  territorioInicial,
  censo,
}: Props) {
  const router = useRouter();
  const busqueda = useBusquedaPlaces();
  const [seleccion, setSeleccion] = useState<Seleccion>(
    territorioInicial ? { tipo: "territorio", id: territorioInicial } : null,
  );
  const [encuadre, setEncuadre] = useState<Encuadre | null>(
    territorioInicial ? { id: territorioInicial, n: 0 } : null,
  );
  const [modoCaptura, setModoCaptura] = useState(false);
  // Null = no se está dibujando. El rectángulo es el modo por defecto con
  // ratón; en pantalla táctil manda `modoInicial()`.
  const [modo, setModo] = useState<ModoDibujo | null>(null);
  const [trazo, setTrazo] = useState<Punto[]>([]);
  // El diálogo del nombre vive AQUÍ porque se abre desde dos sitios: el botón
  // de la barra y el clic en el primer vértice sobre el mapa.
  const [nombrando, setNombrando] = useState(false);
  const [aEstimarId, setAEstimarId] = useState<string | null>(null);
  // Los filtros del mapa recortan los pines con la MISMA regla que la lista
  // de Leads; las cifras de la ficha de un territorio siguen contando todo.
  const [filtros, setFiltros] = useState<FiltroLeads>(FILTRO_VACIO);
  const [tipoMapa, setTipoMapa] = useState<TipoMapa>("roadmap");
  const [pantallaCompleta, alternarPantallaCompleta] = usePantallaCompleta();
  const negociosVisibles = useMemo(() => filtrarLeads(negocios, filtros), [negocios, filtros]);

  // El pin de un negocio abre su ficha en el modal del shell; el pin activo
  // del mapa es el del lead abierto.
  const seleccionMapa: Seleccion = leadAbierto ? { tipo: "negocio", id: leadAbierto } : seleccion;

  const resultadoSeleccionado = useMemo(() => {
    if (seleccion?.tipo !== "resultado") return null;
    return busqueda.resultados.find((r) => r.placeId === seleccion.placeId) ?? null;
  }, [seleccion, busqueda.resultados]);

  // Los territorios abiertos se buscan VIVOS en el array: el prop se renueva en
  // cada router.refresh() y una copia guardada en estado mostraría el contador
  // de llamadas de hace un minuto — justo el número que no puede mentir.
  //
  // Pero la última lectura buena se recuerda: `page.tsx` degrada una consulta
  // fallida a [], y perder la referencia a media faena desmontaría la banda
  // (abortando el barrido) para que el refresh siguiente la remontara y
  // disparara `arrancar` OTRA VEZ, sin que nadie lo confirmara.
  const vivo = barrido ? (territorios.find((t) => t.id === barrido.territorioId) ?? null) : null;
  const [ultimoVivo, setUltimoVivo] = useState<Territorio | null>(null);
  if (vivo !== null && vivo !== ultimoVivo) setUltimoVivo(vivo);
  const territorioBarrido =
    vivo ?? (barrido && ultimoVivo?.id === barrido.territorioId ? ultimoVivo : null);

  const aEstimar = aEstimarId ? (territorios.find((t) => t.id === aEstimarId) ?? null) : null;

  // El territorio con la ficha abierta se resalta; con un barrido abierto, ESE
  // manda sobre el resaltado (es el que se está gastando plata en barrer).
  const territorioResaltado = seleccion?.tipo === "territorio" ? seleccion.id : null;
  const territorioActivo = barrido?.territorioId ?? territorioResaltado;
  const territorioSeleccionado = territorioResaltado
    ? (territorios.find((t) => t.id === territorioResaltado) ?? null)
    : null;

  // Los números de la ficha salen del MISMO recuento que la tarjeta del hover.
  const cuentas = useMemo(() => cuentasPorTerritorio(negocios), [negocios]);
  const cruzado = useMemo(
    () => (territorioSeleccionado ? poligonoSeCruza(territorioSeleccionado.poligono) : false),
    [territorioSeleccionado],
  );

  // Memoizado: va en las dependencias del efecto que dibuja los polígonos en
  // MapCanvas, y una función nueva en cada render los redibujaría todos.
  // Tocar el polígono abierto lo cierra.
  const onSeleccionarTerritorio = useCallback((id: string) => {
    setSeleccion((s) => (s?.tipo === "territorio" && s.id === id ? null : { tipo: "territorio", id }));
  }, []);

  // Los tres van en las dependencias del efecto que crea el overlay del trazo.
  const agregarPunto = useCallback((punto: Punto) => {
    setTrazo((t) => {
      // El tope de vértices lo valida también el servidor; aquí evita que un
      // trazo absurdo cuelgue la pestaña al estimar.
      if (t.length >= VERTICES_MAX) return t;
      // Un clic sobre el área ya dibujada llega por el polígono, y si además
      // llegara por el mapa serían dos vértices idénticos de un solo clic.
      const ultimo = t[t.length - 1];
      if (ultimo && ultimo.lat === punto.lat && ultimo.lng === punto.lng) return t;
      return [...t, punto];
    });
  }, []);
  const reemplazarTrazo = useCallback((puntos: Punto[]) => setTrazo(puntos), []);
  const cerrarArea = useCallback(() => setNombrando(true), []);

  async function importar(aImportar: ResultadoPlace[]) {
    const ids = await busqueda.importar(aImportar);
    if (!ids) return;
    if (seleccion?.tipo === "resultado" && ids.has(seleccion.placeId)) {
      setSeleccion({ tipo: "busqueda" });
    }
    router.refresh(); // los negocios llegan por props del server
  }

  function alternarDibujo() {
    setModoCaptura(false);
    setTrazo([]);
    setNombrando(false);
    setModo((m) => (m === null ? modoInicial() : null));
  }

  function alternarCaptura() {
    // Dibujar y capturar se disputan el MISMO clic del mapa: encender uno
    // apaga el otro.
    setModo(null);
    setModoCaptura((m) => !m);
    if (seleccion?.tipo === "nuevo") setSeleccion(null);
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col",
        oculta && "hidden",
        // Pantalla completa por CSS: la cara entera (barra, banda del barrido,
        // mapa y ficha) se pega a la ventana; los modales siguen encima.
        pantallaCompleta && "fixed inset-0 z-40 bg-isla",
      )}
    >
      <BarraTerritorio
        dibujando={modo !== null}
        onDibujar={alternarDibujo}
        buscando={seleccion?.tipo === "busqueda"}
        onBuscar={() => setSeleccion((s) => (s?.tipo === "busqueda" ? null : { tipo: "busqueda" }))}
        capturando={modoCaptura}
        onCapturar={alternarCaptura}
        fallaTerritorios={fallaTerritorios}
      />

      {modo && (
        <div className="shrink-0 px-5 pt-3">
          <DibujarTerritorio
            modo={modo}
            onModo={(nuevo) => {
              setModo(nuevo);
              // Del rectángulo al contorno la caja sigue siendo un polígono de
              // cuatro vértices y se puede seguir editando; al revés no hay
              // conversión honesta (DibujarTerritorio lo confirma antes).
              if (nuevo === "rectangulo") setTrazo([]);
            }}
            trazo={trazo}
            nombrando={nombrando}
            onNombrando={setNombrando}
            onDeshacer={() => setTrazo((t) => t.slice(0, -1))}
            onLimpiar={() => setTrazo([])}
            onDescartar={() => {
              setModo(null);
              setTrazo([]);
              setNombrando(false);
            }}
            onGuardado={() => {
              setModo(null);
              setTrazo([]);
              setNombrando(false);
              router.refresh();
            }}
          />
        </div>
      )}

      {/* En banda, no flotando: mientras se gasta plata, el progreso no compite
          con el mapa por la atención ni se esconde tras un panel. */}
      {territorioBarrido && barrido && (
        <div className="shrink-0 px-5 pt-3">
          <BarridoProgreso
            key={territorioBarrido.id}
            territorio={territorioBarrido}
            verticales={barrido.verticales}
            permiso={barrido.permiso}
            fallaTerritorios={fallaTerritorios}
            onAviso={onAvisoBarrido}
            onCerrar={() => onBarrido(null)}
          />
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col gap-aire p-5">
        {/* El mapa es el protagonista: en desktop ocupa el lienzo entero. */}
        <div className="relative min-h-[50vh] overflow-hidden rounded-isla min-[1000px]:absolute min-[1000px]:inset-5 min-[1000px]:min-h-0">
          <MapCanvas
            negocios={negociosVisibles}
            resultados={busqueda.resultados}
            seleccion={seleccionMapa}
            territorios={territorios}
            territorioActivo={territorioActivo}
            onSeleccionarTerritorio={onSeleccionarTerritorio}
            tipoMapa={tipoMapa}
            onTipoMapa={setTipoMapa}
            pantallaCompleta={pantallaCompleta}
            onPantallaCompleta={alternarPantallaCompleta}
            // En MapCanvas esto solo pone el cursor en cruz, y dibujar también
            // es "toca el mapa": el puntero tiene que decirlo.
            modoCaptura={modoCaptura || modo !== null}
            onSeleccionar={(s) => {
              if (s?.tipo === "negocio") {
                onAbrirLead(s.id);
                return;
              }
              setSeleccion(s);
            }}
            onClickMapa={(lat, lng) => {
              // En rectángulo el clic no pone nada: el área sale del arrastre,
              // que TrazoEnCurso escucha sobre el mapa.
              if (modo === "poligono") {
                agregarPunto({ lat, lng });
                return;
              }
              if (modo === null && modoCaptura) {
                setSeleccion({ tipo: "nuevo", lat, lng });
                setModoCaptura(false);
              }
            }}
          >
            {/* Van DENTRO del mapa: useMap() necesita el contexto del APIProvider. */}
            {modo && (
              <TrazoEnCurso
                modo={modo}
                trazo={trazo}
                onTrazo={reemplazarTrazo}
                onAgregarPunto={agregarPunto}
                onCerrarArea={cerrarArea}
              />
            )}
            <EncuadrarTerritorio encuadre={encuadre} territorios={territorios} visible={!oculta} />
          </MapCanvas>
          {/* Fuera del APIProvider a propósito: no necesita el mapa, y así el
              sitio del mapa sigue siendo solo del mapa. */}
          <FiltrosMapa
            filtro={filtros}
            onCambiar={setFiltros}
            negocios={negocios}
            territorios={territorios}
            visibles={negociosVisibles.length}
            censo={censo}
          />
        </div>

        <aside
          className={cn(
            "barra-fina min-h-0 overflow-y-auto",
            ISLA_FLOTANTE,
            seleccion === null && "min-[1000px]:hidden",
          )}
          aria-label="Detalle"
        >
          {seleccion?.tipo === "territorio" && territorioSeleccionado ? (
            <FichaTerritorio
              territorio={territorioSeleccionado}
              resumen={resumenDeTerritorio(territorioSeleccionado, cuentas)}
              cruzado={cruzado}
              barriendoId={barrido?.territorioId ?? null}
              onBarrer={() => setAEstimarId(territorioSeleccionado.id)}
              onCentrar={() =>
                setEncuadre((e) => ({ id: territorioSeleccionado.id, n: (e?.n ?? 0) + 1 }))
              }
              onCerrar={() => setSeleccion(null)}
              onCambio={() => router.refresh()}
              onEliminado={() => {
                setSeleccion(null);
                router.refresh();
              }}
            />
          ) : seleccion?.tipo === "busqueda" ? (
            <SearchPanel
              resultados={busqueda.resultados}
              buscando={busqueda.buscando}
              importando={busqueda.importando}
              error={busqueda.error}
              seleccionPlaceId={null}
              onBuscar={busqueda.buscar}
              onImportar={importar}
              onSeleccionar={(placeId) => setSeleccion({ tipo: "resultado", placeId })}
            />
          ) : (
            <FichaLateral
              seleccion={seleccion}
              resultado={resultadoSeleccionado}
              importando={busqueda.importando}
              onImportar={importar}
              onCreado={(id) => {
                // El pin nuevo ya es un lead: se abre su ficha como a cualquiera.
                setSeleccion(null);
                onAbrirLead(id);
                router.refresh();
              }}
              // Cerrar un resultado vuelve a la lista de la búsqueda.
              onCerrar={() =>
                setSeleccion(seleccion?.tipo === "resultado" ? { tipo: "busqueda" } : null)
              }
            />
          )}
        </aside>

        {seleccion === null ? (
          // Donde aparecerá la ficha: pista en píldora, no una columna vacía.
          <p className="pointer-events-none absolute top-8 right-8 z-10 hidden rounded-full border border-hairline bg-isla/90 px-4 py-2 text-xs text-tinta-60 backdrop-blur-sm min-[1000px]:block">
            Toca un territorio, un pin o un resultado para ver su ficha.
          </p>
        ) : null}
      </div>

      {aEstimar && (
        <DialogoBarrer
          territorio={aEstimar}
          consultasMes={consultasMes}
          onCerrar={() => setAEstimarId(null)}
          onConfirmar={(verticales, permiso) => {
            onBarrido({ territorioId: aEstimar.id, verticales, permiso });
            setAEstimarId(null);
          }}
        />
      )}
    </div>
  );
}
