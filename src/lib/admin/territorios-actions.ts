"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "./dal";
import { filasDeTerritorio, poligonoValido, NOMBRE_MAX } from "./territorios";
import type { Punto } from "./barrido";

export async function crearTerritorio(
  nombre: string,
  poligono: Punto[],
): Promise<{ id: string } | { error: string }> {
  const { supabase } = await verifySession();

  if (typeof nombre !== "string" || nombre.trim().length === 0) {
    return { error: "Ponle un nombre al territorio." };
  }
  if (!Array.isArray(poligono) || !poligonoValido(poligono)) {
    return { error: "Dibuja un área válida y más chica que un departamento." };
  }

  const { data, error } = await supabase
    .from("territorios")
    .insert(filasDeTerritorio(poligono, nombre))
    .select("id")
    .single();

  if (error) {
    console.error("[territorios] error creando:", error.message);
    return { error: "No se pudo guardar el territorio." };
  }

  revalidatePath("/admin/prospeccion");
  return { id: data.id as string };
}

export async function renombrarTerritorio(
  id: string,
  nombre: string,
): Promise<{ ok: true } | { error: string }> {
  const { supabase } = await verifySession();
  const limpio = typeof nombre === "string" ? nombre.trim().slice(0, NOMBRE_MAX) : "";
  if (limpio.length === 0) return { error: "El nombre no puede quedar vacío." };

  const { error } = await supabase
    .from("territorios")
    .update({ nombre: limpio })
    .eq("id", id);

  if (error) {
    console.error("[territorios] error renombrando:", error.message);
    return { error: "No se pudo renombrar." };
  }
  revalidatePath("/admin/prospeccion");
  return { ok: true };
}

export async function eliminarTerritorio(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const { supabase } = await verifySession();
  // Los negocios NO se borran: territorio_id es ON DELETE SET NULL. Borrar un
  // territorio tira el mapa del barrido, nunca los leads que produjo.
  const { error } = await supabase.from("territorios").delete().eq("id", id);
  if (error) {
    console.error("[territorios] error eliminando:", error.message);
    return { error: "No se pudo eliminar el territorio." };
  }
  revalidatePath("/admin/prospeccion");
  return { ok: true };
}
