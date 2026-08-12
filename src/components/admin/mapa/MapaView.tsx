"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { importarNegocios } from "@/lib/admin/actions";
import { CIUDADES, type Ciudad, type Negocio } from "@/lib/admin/negocios";
import type { ResultadoPlace } from "@/lib/admin/places";
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
    <div className="adm-mapa">
      <div className="adm-toolbar">
        <div className="adm-chips" role="group" aria-label="Ciudad activa">
          {CIUDADES.map((c) => (
            <button
              key={c.valor}
              type="button"
              className={
                ciudadActiva === c.valor ? "adm-chip adm-chip--activa" : "adm-chip"
              }
              onClick={() => setCiudadActiva(c.valor)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <span className="adm-toolbar-conteo">
          <strong className="adm-cifra">{negocios.length}</strong> negocios en la
          base
        </span>
        <button
          type="button"
          className={modoCaptura ? "adm-cta" : "adm-cta-ghost"}
          onClick={() => {
            setModoCaptura((m) => !m);
            if (seleccion?.tipo === "nuevo") setSeleccion(null);
          }}
        >
          {modoCaptura ? "Toca el mapa para ubicarlo" : "Añadir manual"}
        </button>
      </div>

      <div className="adm-map-layout">
        <aside className="adm-panel-busqueda" aria-label="Búsqueda de negocios">
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

        <div className="adm-map-canvas">
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

        <aside className="adm-ficha" aria-label="Detalle">
          {negocioSeleccionado ? (
            <FichaNegocio
              key={negocioSeleccionado.id}
              negocio={negocioSeleccionado}
              onCambio={() => router.refresh()}
              onCerrar={() => setSeleccion(null)}
            />
          ) : seleccion?.tipo === "negocio" ? (
            <p className="adm-ficha-vacia">Actualizando…</p>
          ) : resultadoSeleccionado ? (
            <div className="adm-ficha-contenido">
              <div className="adm-ficha-cabecera">
                <div>
                  <h2 className="adm-ficha-nombre">
                    {resultadoSeleccionado.nombre}
                  </h2>
                  <p className="adm-ficha-meta">Resultado sin importar</p>
                </div>
                <button
                  type="button"
                  className="adm-ficha-cerrar"
                  aria-label="Cerrar"
                  onClick={() => setSeleccion(null)}
                >
                  ×
                </button>
              </div>
              {resultadoSeleccionado.direccion ? (
                <p className="adm-ficha-direccion">
                  {resultadoSeleccionado.direccion}
                </p>
              ) : null}
              <p className="adm-ficha-telefono">
                {resultadoSeleccionado.telefono ?? "Sin teléfono"}
              </p>
              <button
                className="adm-cta"
                type="button"
                disabled={importando}
                onClick={() => importar([resultadoSeleccionado])}
              >
                {importando ? "Importando…" : "Importar al CRM"}
              </button>
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
            <p className="adm-ficha-vacia">
              Toca un pin del mapa o un resultado de la búsqueda para ver su
              ficha.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
