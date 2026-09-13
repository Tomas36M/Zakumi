"use client";

import { useState } from "react";
import { importarNegocios } from "@/lib/admin/actions";
import type { ResultadoPlace } from "@/lib/admin/places";

const ERRORES_BUSQUEDA: Record<string, string> = {
  cuota: "Google limitó las búsquedas por ahora. Espera unos minutos y vuelve a intentar.",
  consulta_invalida: "Escribe una búsqueda de 2 a 120 caracteres.",
  no_autorizado: "La sesión expiró. Recarga la página y entra de nuevo.",
};

/**
 * La búsqueda suelta de texto en Google Places y la importación de sus
 * resultados al CRM. Vive aparte del mapa porque es la única parte de la cara
 * Territorio que habla con la red por su cuenta.
 */
export function useBusquedaPlaces() {
  const [resultados, setResultados] = useState<ResultadoPlace[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buscar(query: string) {
    setBuscando(true);
    setError(null);
    try {
      const res = await fetch("/admin/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(ERRORES_BUSQUEDA[data.error as string] ?? "La búsqueda falló. Intenta de nuevo.");
        return;
      }
      setResultados(data.resultados ?? []);
      if ((data.resultados ?? []).length === 0) {
        setError("Google no encontró nada con esa búsqueda.");
      }
    } catch {
      setError("Sin conexión con el servidor. Intenta de nuevo.");
    } finally {
      setBuscando(false);
    }
  }

  /** Los placeIds que quedaron importados, o null si falló. */
  async function importar(aImportar: ResultadoPlace[]): Promise<Set<string> | null> {
    setImportando(true);
    setError(null);
    try {
      const res = await importarNegocios(aImportar);
      if ("error" in res) {
        setError(res.error);
        return null;
      }
      const ids = new Set(aImportar.map((r) => r.placeId));
      setResultados((prev) =>
        prev.map((r) => (ids.has(r.placeId) ? { ...r, yaImportado: true } : r)),
      );
      return ids;
    } finally {
      setImportando(false);
    }
  }

  return { resultados, buscando, importando, error, buscar, importar };
}
