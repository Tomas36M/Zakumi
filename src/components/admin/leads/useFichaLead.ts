"use client";

import { useParametroUrl } from "@/components/admin/ui/useParametroUrl";

/**
 * `?lead=<id>`: qué ficha de lead está abierta. Vive en la URL para que el
 * enlace se pueda compartir (y para que Zak pueda saltar al CRM con
 * `linkFichaLead`). Se escribe con replaceState al abrir Y al cerrar: un push
 * dejaría una entrada fantasma que reabre el modal con «atrás».
 *
 * El dueño es el shell de cada página, nunca una vista: en Prospección la
 * cara Territorio está siempre montada y la de Leads solo a veces — dos
 * modales leyendo el mismo parámetro se abrirían a la vez.
 */
export function useFichaLead(): [
  leadId: string | null,
  abrir: (id: string | null) => void,
] {
  return useParametroUrl("lead");
}
