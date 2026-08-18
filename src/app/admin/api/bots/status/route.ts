import { NextResponse } from "next/server";
import { getSesion } from "@/lib/admin/dal";
import { statusGlobal } from "@/lib/bots/api";

// Polling de BotsView (cada 30 s). La sesión evita que esto sea un proxy
// abierto hacia el bot; el token del bot vive solo en el servidor.
export async function GET() {
  const sesion = await getSesion();
  if (!sesion) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }
  const r = await statusGlobal();
  if (!r.ok) {
    // El detalle ya quedó en el log del servidor (lib/bots/api).
    return NextResponse.json({ error: r.error }, { status: 502 });
  }
  return NextResponse.json(r.data);
}
