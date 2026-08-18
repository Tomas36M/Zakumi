"use client";

import { useEffect, useState, useTransition } from "react";
import { vincularInstancia } from "@/lib/admin/cartera-actions";

type InstanciaCorta = { id: number; slug: string; nombre: string; activo: boolean };

type Props = {
  productoId: string;
  onVinculado: () => void;
};

/** Selector inline para enlazar un producto bot con su instancia real. */
export function VincularBot({ productoId, onVinculado }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [instancias, setInstancias] = useState<InstanciaCorta[] | null>(null);
  const [eleccion, setEleccion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, startGuardar] = useTransition();

  useEffect(() => {
    if (!abierto || instancias !== null) return;
    let activo = true;
    void (async () => {
      try {
        const res = await fetch("/admin/api/bots/instancias");
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { instancias: InstanciaCorta[] };
        if (activo) setInstancias(data.instancias);
      } catch {
        if (activo) {
          setInstancias([]);
          setError("No hay conexión con el bot para listar las instancias.");
        }
      }
    })();
    return () => {
      activo = false;
    };
  }, [abierto, instancias]);

  if (!abierto) {
    return (
      <button type="button" className="adm-cta-ghost" onClick={() => setAbierto(true)}>
        Vincular bot
      </button>
    );
  }

  return (
    <div className="adm-vincular">
      {instancias === null && <span className="adm-ficha-sin">Cargando bots…</span>}
      {instancias && instancias.length > 0 && (
        <>
          <select
            className="adm-select"
            value={eleccion}
            onChange={(e) => setEleccion(e.target.value)}
          >
            <option value="">— elige la instancia —</option>
            {instancias.map((i) => (
              <option key={i.id} value={String(i.id)}>
                {i.nombre} ({i.slug}){i.activo ? "" : " · apagado"}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="adm-cta"
            disabled={guardando || !eleccion}
            onClick={() => {
              setError(null);
              startGuardar(async () => {
                const res = await vincularInstancia(productoId, eleccion);
                if (res.error) {
                  setError(res.error);
                  return;
                }
                onVinculado();
              });
            }}
          >
            {guardando ? "Guardando…" : "Vincular"}
          </button>
        </>
      )}
      {instancias?.length === 0 && !error && (
        <span className="adm-ficha-sin">No hay bots creados todavía.</span>
      )}
      {error && (
        <span className="adm-error" role="alert">
          {error}
        </span>
      )}
      <button type="button" className="adm-cta-ghost" onClick={() => setAbierto(false)}>
        Cancelar
      </button>
    </div>
  );
}
