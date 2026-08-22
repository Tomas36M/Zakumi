import { NextResponse } from "next/server";
import { getSesion } from "@/lib/auth/sesion";
import { instanciaDelCliente } from "@/lib/portal/dal";
import { historial } from "@/lib/bots/api";

// SOLO LECTURA (ver conversaciones/route.ts).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await getSesion();
  if (!sesion) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const iid = await instanciaDelCliente(sesion, id);
  if (iid === null) {
    return NextResponse.json({ error: "no_existe" }, { status: 404 });
  }
  const telefono = (new URL(request.url).searchParams.get("telefono") ?? "").trim();
  if (!telefono) {
    return NextResponse.json({ error: "telefono_obligatorio" }, { status: 400 });
  }

  const r = await historial(iid, telefono);
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: 502 });
  }
  return NextResponse.json(r.data);
}
