import { NextResponse } from "next/server";
import { getSesionAdmin } from "@/lib/admin/dal";
import { obtenerPrompt } from "@/lib/bots/api";

// Lectura de una versión puntual del prompt (?version=N). La usa el editor
// para el diff cuando el guardado choca con un 409.
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
  const versionParam = new URL(request.url).searchParams.get("version");
  const version = versionParam === null ? undefined : Number(versionParam);
  if (version !== undefined && (!Number.isInteger(version) || version < 1)) {
    return NextResponse.json({ error: "version_invalida" }, { status: 400 });
  }

  const r = await obtenerPrompt(iid, version);
  if (!r.ok) {
    const status = r.error === "no_existe" ? 404 : 502;
    return NextResponse.json({ error: r.error }, { status });
  }
  return NextResponse.json(r.data);
}
