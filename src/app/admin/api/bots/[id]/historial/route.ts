import { NextResponse } from "next/server";
import { getSesionAdmin } from "@/lib/admin/dal";
import { historial } from "@/lib/bots/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await getSesionAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const iid = Number(id);
  if (!Number.isInteger(iid) || iid <= 0) {
    return NextResponse.json({ error: "bot_invalido" }, { status: 400 });
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
