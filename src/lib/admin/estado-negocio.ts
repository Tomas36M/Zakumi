// Un solo lugar donde vive el candado de estado_fijado_manual y el avance
// forward-only de negocios.estado. Postgres compara el enum estado_negocio
// por orden de declaración (nuevo < contactado < respondido < interesado <
// cliente < descartado), así que `estado < nuevoEstado` ya es forward-only
// sin tabla de orden aparte. Nunca pasar "descartado" como nuevoEstado: al
// ser el último del enum, cualquier negocio "avanzaría" hacia él. SOLO
// SERVIDOR.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EstadoNegocio } from "./negocios";

/**
 * Avanza el estado de uno o más negocios en un solo UPDATE atómico. No toca
 * los que ya se fijaron a mano (`estado_fijado_manual`) ni los que ya están
 * en un estado igual o más avanzado. Nunca lanza.
 */
export async function avanzarEstadosNegocio(
  supabase: SupabaseClient,
  negocioIds: string[],
  nuevoEstado: EstadoNegocio,
): Promise<{ error: string | null }> {
  if (negocioIds.length === 0) return { error: null };

  const { error } = await supabase
    .from("negocios")
    .update({ estado: nuevoEstado })
    .in("id", negocioIds)
    .eq("estado_fijado_manual", false)
    .lt("estado", nuevoEstado);

  if (error) {
    console.error("[avanzarEstadosNegocio]", nuevoEstado, error.message);
    return { error: error.message };
  }
  return { error: null };
}

/** Azúcar para el caso más común: un solo negocio. */
export async function avanzarEstadoNegocio(
  supabase: SupabaseClient,
  negocioId: string,
  nuevoEstado: EstadoNegocio,
): Promise<{ error: string | null }> {
  return avanzarEstadosNegocio(supabase, [negocioId], nuevoEstado);
}
