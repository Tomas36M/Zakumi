"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { importarNegocios } from "@/lib/admin/actions";
import { CIUDADES, type Ciudad, type Negocio } from "@/lib/admin/negocios";
import type { ResultadoPlace } from "@/lib/admin/places";
import { Button } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { IconButton } from "@/components/admin/ui/IconButton";
import { Tabs } from "@/components/admin/ui/Tabs";
import { FichaNegocio } from "./FichaNegocio";
import { MapCanvas } from "./MapCanvas";
import { NuevoNegocioForm } from "./NuevoNegocioForm";
import { SearchPanel } from "./SearchPanel";

export type Seleccion =
  | { tipo: "negocio"; id: string }
  | { tipo: "resultado"; placeId: string }
  | { tipo: "nuevo"; lat: number; lng: number }
  | null;

const ERRORES_BUSQUEDA: Record<string, string> = {
  cuota:
    "Google limitó las búsquedas por ahora. Espera unos minutos y vuelve a intentar.",
  consulta_invalida: "Escribe una búsqueda de 2 a 120 caracteres.",
  no_autorizado: "La sesión expiró. Recarga la página y entra de nuevo.",
};

const PESTANAS_CIUDAD = CIUDADES.map((c) => ({ id: c.valor, label: c.label }));

export function MapaView({ negocios }: { negocios: Negocio[] }) {
  const router = useRouter();
  const [resultados, setResultados] = useState<ResultadoPlace[]>([]);
  const [seleccion, setSeleccion] = useState<Seleccion>(null);
  const [ciudadActiva, setCiudadActiva] = useState<Exclude<Ciudad, "otra"> | null>(
    "madrid",
  );
  const [modoCaptura, setModoCaptura] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);

  const negocioSeleccionado = useMemo(() => {
    if (seleccion?.tipo !== "negocio") return null;
    return negocios.find((n) => n.id === seleccion.id) ?? null;
  }, [seleccion, negocios]);

  const resultadoSeleccionado = useMemo(() => {
    if (seleccion?.tipo !== "resultado") return null;
    return resultados.find((r) => r.placeId === seleccion.placeId) ?? null;
  }, [seleccion, resultados]);

  async function buscar(query: string) {
    setBuscando(true);
    setErrorBusqueda(null);
    try {
      const res = await fetch("/admin/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, ciudad: ciudadActiva ?? undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorBusqueda(
          ERRORES_BUSQUEDA[data.error as string] ??
            "La búsqueda falló. Intenta de nuevo.",
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
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <div role="group" aria-label="Ciudad activa">
          <Tabs
            pestanas={PESTANAS_CIUDAD}
            activa={ciudadActiva ?? "madrid"}
            onCambiar={setCiudadActiva}
          />
        </div>
        <span className="text-xs text-tinta-40">
          <strong className="text-tinta-85">{negocios.length}</strong> negocios en la
          base
        </span>
        <Button
          variante={modoCaptura ? "primaria" : "fantasma"}
          onClick={() => {
            setModoCaptura((m) => !m);
            if (seleccion?.tipo === "nuevo") setSeleccion(null);
          }}
        >
          {modoCaptura ? "Toca el mapa para ubicarlo" : "Añadir manual"}
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-aire p-5 min-[1000px]:grid-cols-[320px_minmax(0,1fr)_340px]">
        <aside
          className="barra-fina min-h-0 overflow-y-auto"
          aria-label="Búsqueda de negocios"
        >
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
            onSeleccionar={(placeId) =>
              setSeleccion({ tipo: "resultado", placeId })
            }
          />
        </aside>

        <div className="relative min-h-[50vh] overflow-hidden rounded-isla min-[1000px]:min-h-0">
          <MapCanvas
            negocios={negocios}
            resultados={resultados}
            seleccion={seleccion}
            ciudadActiva={ciudadActiva}
            modoCaptura={modoCaptura}
            onSeleccionar={setSeleccion}
            onClickMapa={(lat, lng) => {
              if (modoCaptura) {
                setSeleccion({ tipo: "nuevo", lat, lng });
                setModoCaptura(false);
              }
            }}
          />
        </div>

        <aside className="barra-fina min-h-0 overflow-y-auto" aria-label="Detalle">
          {negocioSeleccionado ? (
            <FichaNegocio
              key={negocioSeleccionado.id}
              negocio={negocioSeleccionado}
              onCambio={() => router.refresh()}
              onCerrar={() => setSeleccion(null)}
            />
          ) : seleccion?.tipo === "negocio" ? (
            <EmptyState titulo="Actualizando…" />
          ) : resultadoSeleccionado ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-tinta">
                    {resultadoSeleccionado.nombre}
                  </h2>
                  <p className="text-xs text-tinta-40">Resultado sin importar</p>
                </div>
                <IconButton etiqueta="Cerrar" onClick={() => setSeleccion(null)}>
                  <X className="h-4 w-4" />
                </IconButton>
              </div>
              {resultadoSeleccionado.direccion ? (
                <p className="text-sm text-tinta-60">
                  {resultadoSeleccionado.direccion}
                </p>
              ) : null}
              <p className="text-sm text-tinta">
                {resultadoSeleccionado.telefono ?? "Sin teléfono"}
              </p>
              <Button
                variante="primaria"
                className="self-start"
                disabled={importando}
                onClick={() => importar([resultadoSeleccionado])}
              >
                {importando ? "Importando…" : "Importar al CRM"}
              </Button>
            </div>
          ) : seleccion?.tipo === "nuevo" ? (
            <NuevoNegocioForm
              lat={seleccion.lat}
              lng={seleccion.lng}
              ciudadSugerida={ciudadActiva}
              onCreado={(id) => {
                setSeleccion({ tipo: "negocio", id });
                router.refresh();
              }}
              onCancelar={() => setSeleccion(null)}
            />
          ) : (
            <EmptyState titulo="Toca un pin del mapa o un resultado de la búsqueda para ver su ficha." />
          )}
        </aside>
      </div>
    </div>
  );
}
