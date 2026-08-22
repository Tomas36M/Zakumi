import { NextResponse } from "next/server";
import { getSesionAdmin } from "@/lib/admin/dal";
import { listarInstancias } from "@/lib/bots/api";

// Lista corta para selects (vincular producto ↔ instancia del bot).
export async function GET() {
  const sesion = await getSesionAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }
  const r = await listarInstancias();
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: 502 });
  }
  return NextResponse.json({
    instancias: r.data.map((i) => ({
      id: i.id,
      slug: i.slug,
      nombre: i.nombre,
      activo: i.activo,
    })),
  });
}
