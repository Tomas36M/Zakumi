import { NextResponse } from "next/server";
import { getSesion } from "@/lib/admin/dal";
import { listarConversaciones } from "@/lib/bots/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await getSesion();
  if (!sesion) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const iid = Number(id);
  if (!Number.isInteger(iid) || iid <= 0) {
    return NextResponse.json({ error: "bot_invalido" }, { status: 400 });
  }
  const offset = Math.max(
    Number(new URL(request.url).searchParams.get("offset") ?? 0) || 0,
    0,
  );

  const r = await listarConversaciones(iid, { limit: 50, offset });
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: 502 });
  }
  return NextResponse.json({ conversaciones: r.data });
}
