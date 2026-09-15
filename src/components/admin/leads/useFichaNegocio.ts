"use client";

import { useEffect, useState } from "react";
import { fichaConLista, type EstadoFicha, type FichaFetch } from "@/lib/admin/ficha-fetch";
import type { Negocio } from "@/lib/admin/negocios";

/**
 * El negocio de la ficha abierta (`?lead=`) para un dueño que ya tiene una
 * lista cargada. Si el lead está en `cargados`, sale de ahí; si no —la lista de
 * Leads pagina la base entera y el lead puede ser de cualquier página—, se trae
 * por GET /admin/api/negocios/[id].
 *
 * Mismo patrón que el chat de Zak: un solo estado, escrito desde la
 * continuación async, y cargando / fallo / ya no existe derivados
 * (`fichaConLista`). `recargar` vuelve a pedir la fila traída por id después
 * de editarla en la ficha.
 */
export function useFichaNegocio(
  leadId: string | null,
  cargados: readonly Negocio[],
): EstadoFicha & { recargar: () => void } {
  const enLista = leadId === null ? null : (cargados.find((n) => n.id === leadId) ?? null);
  const falta = leadId !== null && enLista === null;
  const [ultimo, setUltimo] = useState<FichaFetch | null>(null);
  const [version, setVersion] = useState(0);

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
    ...fichaConLista(leadId, enLista, ultimo),
    recargar: () => setVersion((v) => v + 1),
  };
}
