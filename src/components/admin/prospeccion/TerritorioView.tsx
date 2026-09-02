"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { importarNegocios } from "@/lib/admin/actions";
import type { Negocio } from "@/lib/admin/negocios";
import type { ResultadoPlace } from "@/lib/admin/places";
import type { Punto } from "@/lib/admin/barrido";
import { VERTICES_MAX, type Territorio } from "@/lib/admin/territorios";
import { cn } from "@/lib/cn";
import { Button } from "@/components/admin/ui/Button";
import { MapCanvas } from "@/components/admin/mapa/MapCanvas";
import { SearchPanel } from "@/components/admin/mapa/SearchPanel";
import { BarridoProgreso, type AvisoBarrido } from "./BarridoProgreso";
import { DialogoBarrer } from "./DialogoBarrer";
import { DibujarTerritorio } from "./DibujarTerritorio";
import { FichaLateral } from "./FichaLateral";
import { PanelTerritorios } from "./PanelTerritorios";
import { modoInicial, TrazoEnCurso, type ModoDibujo } from "./TrazoEnCurso";

/** Qué está abierto en la isla derecha. Vive aquí porque MapCanvas lo
 * importa. */
export type Seleccion =
  | { tipo: "negocio"; id: string }
  | { tipo: "resultado"; placeId: string }
  | { tipo: "nuevo"; lat: number; lng: number }
  | null;

const ERRORES_BUSQUEDA: Record<string, string> = {
  cuota: "Google limitó las búsquedas por ahora. Espera unos minutos y vuelve a intentar.",
  consulta_invalida: "Escribe una búsqueda de 2 a 120 caracteres.",
  no_autorizado: "La sesión expiró. Recarga la página y entra de nuevo.",
};

// ≥1000px los paneles flotan como islas sobre el mapa (profundidad por capas).
const ISLA_FLOTANTE =
  "min-[1000px]:absolute min-[1000px]:top-8 min-[1000px]:z-10 min-[1000px]:max-h-[calc(100%-5rem)] min-[1000px]:rounded-isla min-[1000px]:border min-[1000px]:border-hairline min-[1000px]:bg-isla/95 min-[1000px]:p-4 min-[1000px]:backdrop-blur-sm";

/** Un barrido abierto: el id del territorio, las verticales confirmadas y las
 * llamadas que el usuario aprobó al confirmar. El territorio se busca vivo en
 * el array — el prop se renueva en cada router.refresh() del barrido y una
 * copia se quedaría con el contador viejo. */
export type BarridoAbierto = {
  territorioId: string;
  verticales: string[];
  llamadasAprobadas: number;
};

type Props = {
  negocios: Negocio[];
  territorios: Territorio[];
  /** La consulta de territorios falló: la lista vacía no es "no hay". */
  fallaTerritorios: boolean;
  /** Consultas a Google Places que este panel lleva registradas en el mes
   * calendario en curso. `null` = no se pudo leer, y NO es lo mismo que cero:
   * el diálogo de barrer no puede afirmar cuota gratis sobre un dato que no
   * tiene. Baja tal cual hasta `DialogoBarrer`. */
  consultasMes: number | null;
  /** El barrido abierto vive en el shell (las caras lo marcan). */
  barrido: BarridoAbierto | null;
  onBarrido: (barrido: BarridoAbierto | null) => void;
  /** El estado vivo del barrido, para que el shell lo pinte en la cara Leads
   * (donde esta cara está `hidden` y no se ve nada). Se pasa tal cual: tiene
   * que conservar su identidad entre renders. */
  onAvisoBarrido: (aviso: AvisoBarrido | null) => void;
  /** La cara está en segundo plano: se esconde, NUNCA se desmonta (adentro
   * puede haber un barrido en vuelo). */
  oculta: boolean;
};

/**
 * La cara Territorio: el mapa donde se dibuja un área, se estima lo que cuesta
 * barrerla y se ve avanzar el barrido.
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
}: Props) {
  const router = useRouter();
  const [resultados, setResultados] = useState<ResultadoPlace[]>([]);
  const [seleccion, setSeleccion] = useState<Seleccion>(null);
  const [modoCaptura, setModoCaptura] = useState(false);
  // Null = no se está dibujando. El rectángulo es el modo por defecto con
  // ratón: casi todo lo que se barre es "este barrio", y eso es un arrastre,
  // no veinte clics. En pantalla táctil manda `modoInicial()`, porque ahí el
  // arrastre no existe.
  const [modo, setModo] = useState<ModoDibujo | null>(null);
  const [trazo, setTrazo] = useState<Punto[]>([]);
  // El diálogo del nombre vive AQUÍ porque se abre desde dos sitios: el botón
  // de la barra y el clic en el primer vértice sobre el mapa.
  const [nombrando, setNombrando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const [aEstimarId, setAEstimarId] = useState<string | null>(null);
  // Clic sobre un polígono del mapa: solo lo resalta (más opacidad), no abre
  // nada — no hay ficha de territorio todavía. Mientras hay un barrido
  // abierto, ESE territorio manda (ver `territorioActivo` más abajo): es el
  // que se está gastando plata en barrer ahora mismo.
  const [territorioResaltado, setTerritorioResaltado] = useState<string | null>(
    null,
  );

  const negocioSeleccionado = useMemo(() => {
    if (seleccion?.tipo !== "negocio") return null;
    return negocios.find((n) => n.id === seleccion.id) ?? null;
  }, [seleccion, negocios]);

  const resultadoSeleccionado = useMemo(() => {
    if (seleccion?.tipo !== "resultado") return null;
    return resultados.find((r) => r.placeId === seleccion.placeId) ?? null;
  }, [seleccion, resultados]);

  // Los territorios abiertos se buscan VIVOS en el array: el prop se renueva en
  // cada router.refresh() y una copia guardada en estado mostraría el contador
  // de llamadas de hace un minuto — justo el número que no puede mentir.
  //
  // Pero la última lectura buena se recuerda: `page.tsx` degrada una consulta
  // fallida a [], y perder la referencia a media faena desmontaría la banda
  // (abortando el barrido) para que el refresh siguiente la remontara y
  // disparara `arrancar` OTRA VEZ, sin que nadie lo confirmara.
  const vivo = barrido
    ? (territorios.find((t) => t.id === barrido.territorioId) ?? null)
    : null;
  const [ultimoVivo, setUltimoVivo] = useState<Territorio | null>(null);
  if (vivo !== null && vivo !== ultimoVivo) setUltimoVivo(vivo);
  const territorioBarrido =
    vivo ??
    (barrido && ultimoVivo?.id === barrido.territorioId ? ultimoVivo : null);

  const aEstimar = aEstimarId
    ? (territorios.find((t) => t.id === aEstimarId) ?? null)
    : null;

  // El territorio con el barrido abierto manda sobre el resaltado a mano: es
  // el que de verdad importa mientras se está gastando plata en él.
  const territorioActivo = barrido?.territorioId ?? territorioResaltado;

  // Memoizado: va en las dependencias del efecto que dibuja los polígonos en
  // MapCanvas, y una función nueva en cada render los redibujaría todos en
  // cada tecla que se pulse en el panel.
  const onSeleccionarTerritorio = useCallback((id: string) => {
    setTerritorioResaltado((actual) => (actual === id ? null : id));
  }, []);

  // Los tres van en las dependencias del efecto que crea el overlay del trazo:
  // una función nueva en cada render lo recrearía —parpadeando— en cada tecla
  // que se pulse en el panel.
  const agregarPunto = useCallback((punto: Punto) => {
    setTrazo((t) => {
      // El tope de vértices lo valida también el servidor; aquí evita que un
      // trazo absurdo cuelgue la pestaña al estimar.
      if (t.length >= VERTICES_MAX) return t;
      // Un clic sobre el área ya dibujada llega por el polígono, y si además
      // llegara por el mapa serían dos vértices idénticos de un solo clic.
      // Nadie pone dos vértices en el mismo punto a propósito.
      const ultimo = t[t.length - 1];
      if (ultimo && ultimo.lat === punto.lat && ultimo.lng === punto.lng) return t;
      return [...t, punto];
    });
  }, []);

  const reemplazarTrazo = useCallback((puntos: Punto[]) => {
    setTrazo(puntos);
  }, []);

  const cerrarArea = useCallback(() => {
    setNombrando(true);
  }, []);

  async function buscar(query: string) {
    setBuscando(true);
    setErrorBusqueda(null);
    try {
      const res = await fetch("/admin/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorBusqueda(
          ERRORES_BUSQUEDA[data.error as string] ?? "La búsqueda falló. Intenta de nuevo.",
        );
        return;
      }
      setResultados(data.resultados ?? []);
      if ((data.resultados ?? []).length === 0) {
        setErrorBusqueda("Google no encontró nada con esa búsqueda.");
      }
    } catch {
      setErrorBusqueda("Sin conexión con el servidor. Intenta de nuevo.");
    } finally {
      setBuscando(false);
    }
  }

  async function importar(aImportar: ResultadoPlace[]) {
    setImportando(true);
    setErrorBusqueda(null);
    try {
      const res = await importarNegocios(aImportar);
      if ("error" in res) {
        setErrorBusqueda(res.error);
        return;
      }
      const ids = new Set(aImportar.map((r) => r.placeId));
      setResultados((prev) =>
        prev.map((r) => (ids.has(r.placeId) ? { ...r, yaImportado: true } : r)),
      );
      if (seleccion?.tipo === "resultado" && ids.has(seleccion.placeId)) {
        setSeleccion(null);
      }
      router.refresh(); // los negocios llegan por props del server
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", oculta && "hidden")}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <span className="text-xs text-tinta-40">
          Dibuja un área, mira lo que cuesta barrerla y confírmalo. Cada tesela es
          una llamada a Google que se paga.
        </span>
        <Button
          variante={modoCaptura ? "primaria" : "fantasma"}
          onClick={() => {
            // Dibujar y capturar se disputan el MISMO clic del mapa: encender
            // uno apaga el otro.
            setModo(null);
            setModoCaptura((m) => !m);
            if (seleccion?.tipo === "nuevo") setSeleccion(null);
          }}
        >
          {modoCaptura ? "Toca el mapa para ubicarlo" : "Añadir manual"}
        </Button>
      </div>

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
            llamadasAprobadas={barrido.llamadasAprobadas}
            fallaTerritorios={fallaTerritorios}
            onAviso={onAvisoBarrido}
            onCerrar={() => onBarrido(null)}
          />
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col gap-aire p-5">
        <aside
          className={cn(
            "barra-fina min-h-0 overflow-y-auto min-[1000px]:left-8 min-[1000px]:w-80",
            ISLA_FLOTANTE,
          )}
          aria-label="Territorios y búsqueda"
        >
          <PanelTerritorios
            territorios={territorios}
            negocios={negocios}
            fallaCarga={fallaTerritorios}
            dibujando={modo !== null}
            onDibujar={() => {
              setModoCaptura(false);
              setTrazo([]);
              setNombrando(false);
              setModo((m) => (m === null ? modoInicial() : null));
            }}
            barriendoId={barrido?.territorioId ?? null}
            onBarrer={(t) => setAEstimarId(t.id)}
          />

          {/* El buscador de texto sigue siendo útil para consultas sueltas,
              pero ya no es el protagonista: colapsado por defecto. */}
          <div className="mt-4 border-t border-hairline pt-3">
            <button
              type="button"
              aria-expanded={buscadorAbierto}
              onClick={() => setBuscadorAbierto((b) => !b)}
              className="flex w-full items-center gap-1.5 text-sm font-semibold text-tinta-60 transition-colors hover:text-tinta"
            >
              {buscadorAbierto ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              Búsqueda suelta
            </button>
            {buscadorAbierto && (
              <div className="mt-3">
                <SearchPanel
                  resultados={resultados}
                  buscando={buscando}
                  importando={importando}
                  error={errorBusqueda}
                  seleccionPlaceId={
                    seleccion?.tipo === "resultado" ? seleccion.placeId : null
                  }
                  onBuscar={buscar}
                  onImportar={importar}
                  onSeleccionar={(placeId) => setSeleccion({ tipo: "resultado", placeId })}
                />
              </div>
            )}
          </div>
        </aside>

        {/* El mapa es el protagonista: en desktop ocupa el lienzo entero. */}
        <div className="relative min-h-[50vh] overflow-hidden rounded-isla min-[1000px]:absolute min-[1000px]:inset-5 min-[1000px]:min-h-0">
          <MapCanvas
            negocios={negocios}
            resultados={resultados}
            seleccion={seleccion}
            territorios={territorios}
            territorioActivo={territorioActivo}
            onSeleccionarTerritorio={onSeleccionarTerritorio}
            // En MapCanvas esto solo pone el cursor en cruz, y dibujar también
            // es "toca el mapa": el puntero tiene que decirlo.
            modoCaptura={modoCaptura || modo !== null}
            onSeleccionar={setSeleccion}
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
            {/* Va DENTRO del mapa: useMap() necesita el contexto del APIProvider. */}
            {modo && (
              <TrazoEnCurso
                modo={modo}
                trazo={trazo}
                onTrazo={reemplazarTrazo}
                onAgregarPunto={agregarPunto}
                onCerrarArea={cerrarArea}
              />
            )}
          </MapCanvas>
        </div>

        <aside
          className={cn(
            "barra-fina min-h-0 overflow-y-auto min-[1000px]:right-8 min-[1000px]:w-[340px]",
            ISLA_FLOTANTE,
            seleccion === null && "min-[1000px]:hidden",
          )}
          aria-label="Detalle"
        >
          <FichaLateral
            seleccion={seleccion}
            negocio={negocioSeleccionado}
            resultado={resultadoSeleccionado}
            importando={importando}
            onImportar={importar}
            onSeleccionar={setSeleccion}
            onCerrar={() => setSeleccion(null)}
            onCambio={() => router.refresh()}
          />
        </aside>

        {seleccion === null ? (
          // Donde aparecerá la ficha: pista en píldora, no una columna vacía.
          <p className="pointer-events-none absolute top-8 right-8 z-10 hidden rounded-full border border-hairline bg-isla/90 px-4 py-2 text-xs text-tinta-60 backdrop-blur-sm min-[1000px]:block">
            Toca un pin o un resultado para ver su ficha.
          </p>
        ) : null}
      </div>

      {aEstimar && (
        <DialogoBarrer
          territorio={aEstimar}
          consultasMes={consultasMes}
          onCerrar={() => setAEstimarId(null)}
          onConfirmar={(verticales, llamadasAprobadas) => {
            onBarrido({ territorioId: aEstimar.id, verticales, llamadasAprobadas });
            setAEstimarId(null);
          }}
        />
      )}
    </div>
  );
}
