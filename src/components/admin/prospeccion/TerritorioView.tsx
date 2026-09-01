"use client";

import { useMemo, useState } from "react";
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
import { BarridoProgreso } from "./BarridoProgreso";
import { DialogoBarrer } from "./DialogoBarrer";
import { DibujarTerritorio } from "./DibujarTerritorio";
import { FichaLateral } from "./FichaLateral";
import { PanelTerritorios } from "./PanelTerritorios";
import { TrazoEnCurso } from "./TrazoEnCurso";

/** Qué está abierto en la isla derecha. Vive aquí (y no en MapaView, que la
 * Task 14 borra) porque MapCanvas lo importa. */
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

type Props = {
  negocios: Negocio[];
  territorios: Territorio[];
  /** La cara está en segundo plano: se esconde, NUNCA se desmonta (adentro
   * puede haber un barrido en vuelo). */
  oculta: boolean;
};

/** Un barrido abierto: el id del territorio y las verticales confirmadas. El
 * territorio se busca vivo en el array — el prop se renueva en cada
 * router.refresh() del barrido y una copia se quedaría con el contador viejo. */
type BarridoAbierto = { territorioId: string; verticales: string[] };

/**
 * La cara Territorio: el mapa donde se dibuja un área, se estima lo que cuesta
 * barrerla y se ve avanzar el barrido.
 */
export function TerritorioView({ negocios, territorios, oculta }: Props) {
  const router = useRouter();
  const [resultados, setResultados] = useState<ResultadoPlace[]>([]);
  const [seleccion, setSeleccion] = useState<Seleccion>(null);
  const [modoCaptura, setModoCaptura] = useState(false);
  const [dibujando, setDibujando] = useState(false);
  const [trazo, setTrazo] = useState<Punto[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const [aEstimarId, setAEstimarId] = useState<string | null>(null);
  const [barrido, setBarrido] = useState<BarridoAbierto | null>(null);

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
  const territorioBarrido = barrido
    ? (territorios.find((t) => t.id === barrido.territorioId) ?? null)
    : null;
  const aEstimar = aEstimarId
    ? (territorios.find((t) => t.id === aEstimarId) ?? null)
    : null;

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
            setDibujando(false);
            setModoCaptura((m) => !m);
            if (seleccion?.tipo === "nuevo") setSeleccion(null);
          }}
        >
          {modoCaptura ? "Toca el mapa para ubicarlo" : "Añadir manual"}
        </Button>
      </div>

      {dibujando && (
        <div className="shrink-0 px-5 pt-3">
          <DibujarTerritorio
            trazo={trazo}
            onDeshacer={() => setTrazo((t) => t.slice(0, -1))}
            onDescartar={() => {
              setDibujando(false);
              setTrazo([]);
            }}
            onGuardado={() => {
              setDibujando(false);
              setTrazo([]);
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
            onCerrar={() => setBarrido(null)}
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
            dibujando={dibujando}
            onDibujar={() => {
              setModoCaptura(false);
              setTrazo([]);
              setDibujando((d) => !d);
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
            // En MapCanvas esto solo pone el cursor en cruz, y dibujar también
            // es "toca el mapa": el puntero tiene que decirlo.
            modoCaptura={modoCaptura || dibujando}
            onSeleccionar={setSeleccion}
            onClickMapa={(lat, lng) => {
              if (dibujando) {
                // El tope de vértices lo valida también el servidor; aquí evita
                // que un trazo absurdo cuelgue la pestaña al estimar.
                setTrazo((t) => (t.length >= VERTICES_MAX ? t : [...t, { lat, lng }]));
                return;
              }
              if (modoCaptura) {
                setSeleccion({ tipo: "nuevo", lat, lng });
                setModoCaptura(false);
              }
            }}
          >
            {/* Va DENTRO del mapa: useMap() necesita el contexto del APIProvider. */}
            {dibujando && <TrazoEnCurso trazo={trazo} />}
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
          onCerrar={() => setAEstimarId(null)}
          onConfirmar={(verticales) => {
            setBarrido({ territorioId: aEstimar.id, verticales });
            setAEstimarId(null);
          }}
        />
      )}
    </div>
  );
}
