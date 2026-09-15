import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pago } from "./cartera";
import type { Nota } from "./negocios";

// Lecturas de las fichas en modal del panel, con el cliente de SERVIDOR.
// Antes se hacían desde el navegador (FichaLeadNotas, PagosRecientes), y eso
// obligaba a mandar el SDK de Supabase (~250 KB sin comprimir) a cuatro rutas
// del admin. Las exponen los handlers de /admin/api/negocios/[id]/notas y
// /admin/api/clientes/[id]/pagos.
//
// En las dos, `null` = la consulta falló: la ficha lo dice con un banner en
// vez de pintar una lista vacía que no es.

/** Tope de la lista "Pagos recientes" de la ficha del cliente. */
export const PAGOS_RECIENTES = 20;

/** Las notas de un negocio (a mano y automáticas), las más nuevas primero. */
export async function notasDeNegocio(
  supabase: SupabaseClient,
  negocioId: string,
): Promise<Nota[] | null> {
  const { data, error } = await supabase
    .from("notas")
    .select("*")
    .eq("negocio_id", negocioId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[fichas] notas del negocio:", error.message);
    return null;
  }
  return (data as Nota[]) ?? [];
}

/**
 * Los últimos pagos de TODOS los productos de un cliente, los más recientes
 * primero. Los productos se buscan acá por `cliente_id`: el servidor no
 * confía en una lista de ids que mande el navegador.
 */
export async function pagosRecientesDeCliente(
  supabase: SupabaseClient,
  clienteId: string,
): Promise<Pago[] | null> {
  const productos = await supabase
    .from("productos_contratados")
    .select("id")
    .eq("cliente_id", clienteId);
  if (productos.error) {
    console.error("[fichas] productos del cliente:", productos.error.message);
    return null;
  }

  const ids = ((productos.data as { id: string }[]) ?? []).map((p) => p.id);
  if (ids.length === 0) return [];

  const pagos = await supabase
    .from("pagos")
    .select("*")
    .in("producto_id", ids)
    .order("fecha", { ascending: false })
    .limit(PAGOS_RECIENTES);
  if (pagos.error) {
    console.error("[fichas] pagos del cliente:", pagos.error.message);
    return null;
  }
  return (pagos.data as Pago[]) ?? [];
}
