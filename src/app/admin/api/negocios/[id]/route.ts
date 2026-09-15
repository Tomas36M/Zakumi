import { NextResponse } from "next/server";
import { getSesionAdmin } from "@/lib/admin/dal";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Un negocio completo por id — a diferencia de /admin/api/zak/fichas
 * (columnas chicas, por teléfono), trae la fila entera para la ficha
 * completa (FichaLeadModal) cuando el caller no tiene ya la lista de
 * negocios en memoria (hoy: el chat de Zak).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await getSesionAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }
  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "id_invalido" }, { status: 400 });
  }

  const { data, error } = await sesion.supabase
    .from("negocios")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[api/negocios/[id]]:", error.message);
    return NextResponse.json({ error: "crm" }, { status: 502 });
  }
  return NextResponse.json({ negocio: data });
}
