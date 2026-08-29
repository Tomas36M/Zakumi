// SOLO SERVIDOR: lee el catálogo vivo de verticales desde Supabase.
// La tabla plantillas_zak (supabase/plantillas.sql) es la fuente; el catálogo
// estático de zak.ts queda como seed y FALLBACK — si la tabla no existe aún o
// Supabase falla, todo sigue funcionando con lo hardcodeado (deploy seguro
// antes de correr el SQL).

import type { Sesion } from "@/lib/auth/sesion";
import { verticalDeFila, type PlantillaZakFila } from "./plantillas";
import {
  TODOS_LOS_VERTICALES,
  VERTICAL_GENERICO,
  VERTICALES_PROSPECCION,
  type VerticalProspeccion,
} from "./zak";

export type CatalogoVerticales = {
  /** Los 10 verticales de nicho, en el orden del matching (sin el genérico). */
  verticales: readonly VerticalProspeccion[];
  generico: VerticalProspeccion;
  /** verticales + genérico al final: lo que consumen selector y saludos. */
  todos: readonly VerticalProspeccion[];
  /** Las filas crudas de plantillas_zak ([] = tabla sin encender: fallback). */
  filas: PlantillaZakFila[];
};

const ESTATICO: CatalogoVerticales = {
  verticales: VERTICALES_PROSPECCION,
  generico: VERTICAL_GENERICO,
  todos: TODOS_LOS_VERTICALES,
  filas: [],
};

export async function catalogoVerticales(
  supabase: Sesion["supabase"],
): Promise<CatalogoVerticales> {
  try {
    const { data, error } = await supabase
      .from("plantillas_zak")
      .select("*")
      .order("orden", { ascending: true });
    if (error || !data || data.length === 0) {
      if (error) console.error("[catalogoVerticales]:", error.message);
      return ESTATICO;
    }
    const filas = data as PlantillaZakFila[];
    const todos = filas.map(verticalDeFila);
    const generico = todos.find((v) => v.slug === "generico") ?? VERTICAL_GENERICO;
    const verticales = todos.filter((v) => v.slug !== "generico");
    return { verticales, generico, todos: [...verticales, generico], filas };
  } catch (e) {
    console.error("[catalogoVerticales]:", e);
    return ESTATICO;
  }
}
