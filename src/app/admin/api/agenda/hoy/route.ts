import { NextResponse } from "next/server";
import { getSesionAdmin } from "@/lib/admin/dal";
import { agruparPorDia, proximasCitas } from "@/lib/agenda/consultas";

// El contador del sidebar. getSesionAdmin (no getSesion a secas): un
// registrado del portal no puede contar las citas de la casa.
export async function GET() {
  const sesion = await getSesionAdmin();
  if (!sesion) return NextResponse.json({ error: "no_autorizado" }, { status: 401 });

  const grupos = agruparPorDia(await proximasCitas(sesion.supabase, 50));
  const hoy = grupos.find((g) => g.titulo === "Hoy")?.citas.length ?? 0;
  return NextResponse.json({ hoy });
}
