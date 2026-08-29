import { NextResponse } from "next/server";
import { getSesionAdmin } from "@/lib/admin/dal";
import type { PlantillaZakFila } from "@/lib/admin/plantillas";

/**
 * Las filas de plantillas_zak para la pestaña Plantillas: la re-lectura
 * barata tras cada action (sin re-disparar las llamadas al bot de la page).
 * Lectura = route handler, no server action (se despachan en serie).
 */
export async function GET() {
  const sesion = await getSesionAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }
  const { data, error } = await sesion.supabase
    .from("plantillas_zak")
    .select("*")
    .order("orden", { ascending: true });
  if (error) {
    console.error("[api/zak/plantillas]:", error.message);
    return NextResponse.json({ error: "tabla" }, { status: 502 });
  }
  return NextResponse.json({ filas: (data ?? []) as PlantillaZakFila[] });
}
