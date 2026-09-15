"use client";

import { useEffect, useState } from "react";
import { fichaConLista, type EstadoFicha, type FichaFetch } from "@/lib/admin/ficha-fetch";
import type { Negocio } from "@/lib/admin/negocios";

/**
 * El negocio de la ficha abierta (`?lead=`). Si el lead está en `cargados` (la
 * lista que ya tiene el dueño de la página), sale de ahí; si no —la lista de
 * Leads pagina la base entera y el lead puede ser de cualquier página, o el
 * dueño no tiene lista, como el chat de Zak—, se trae por
 * GET /admin/api/negocios/[id].
 *
 * Un solo estado para el fetch, escrito desde la continuación async (nada de
 * setState síncrono en el efecto), y cargando / fallo / ya no existe derivados
 * (`fichaConLista`, con tests). `recargar` vuelve a pedir la fila traída por id
 * después de editarla en la ficha.
 */
export function useFichaNegocio(
  leadId: string | null,
  cargados: readonly Negocio[],
): EstadoFicha & { recargar: () => void } {
  const enLista = leadId === null ? null : (cargados.find((n) => n.id === leadId) ?? null);
  const falta = leadId !== null && enLista === null;
  const [ultimo, setUltimo] = useState<FichaFetch | null>(null);
  const [version, setVersion] = useState(0);
  // La última fila de la lista que se vio para el lead. Si un refresh lo saca
  // de la lista (más filas nuevas que el tope), la ficha sigue con esa fila
  // mientras llega el fetch, en vez de volver al esqueleto y desmontar el
  // formulario a medio escribir. Se ajusta en render y solo cuando cambia
  // (patrón de React para guardar algo de renders anteriores).
  const [visto, setVisto] = useState<Negocio | null>(null);
  if (enLista !== null && enLista !== visto) setVisto(enLista);

  useEffect(() => {
    if (!falta || leadId === null) return;
    let cancelado = false;
    void (async () => {
      let negocio: Negocio | null = null;
      let fallo = false;
      try {
        const res = await fetch(`/admin/api/negocios/${leadId}`);
        // Un id malformado (400: un ?lead= cortado o editado a mano) no puede
        // existir: es «ya no existe», no un fallo que se arregle reintentando.
        if (res.status !== 400) {
          if (!res.ok) throw new Error(String(res.status));
          negocio = ((await res.json()) as { negocio: Negocio | null }).negocio;
        }
      } catch {
        fallo = true;
      }
      if (!cancelado) setUltimo({ leadId, negocio, fallo });
    })();
    return () => {
      cancelado = true;
    };
  }, [falta, leadId, version]);

  return {
    ...fichaConLista(leadId, enLista, ultimo, visto),
    recargar: () => setVersion((v) => v + 1),
  };
}
