import { NextResponse } from "next/server";
import { getSesion } from "@/lib/admin/dal";
import { labsChat, labsHistorial, labsReset } from "@/lib/bots/api";

// El turno del Labs corre síncrono en el bot (Claude + tools: 3-10 s), muy por
// encima del default de Vercel — sin esto, la función se corta a mitad de turno.
export const maxDuration = 60;

const SESSION = /^[a-z0-9-]{4,40}$/;

type Params = { params: Promise<{ id: string }> };

async function validar(request: Request, { params }: Params) {
  const sesion = await getSesion();
  if (!sesion) {
    return { error: NextResponse.json({ error: "no_autorizado" }, { status: 401 }) };
  }
  const { id } = await params;
  const iid = Number(id);
  if (!Number.isInteger(iid) || iid <= 0) {
    return { error: NextResponse.json({ error: "bot_invalido" }, { status: 400 }) };
  }
  return { iid };
}

export async function POST(request: Request, ctx: Params) {
  const v = await validar(request, ctx);
  if ("error" in v) return v.error;

  let payload: { session?: unknown; mensaje?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "peticion_invalida" }, { status: 400 });
  }
  const session = typeof payload.session === "string" ? payload.session : "";
  const mensaje = typeof payload.mensaje === "string" ? payload.mensaje.trim() : "";
  if (!SESSION.test(session) || !mensaje) {
    return NextResponse.json({ error: "peticion_invalida" }, { status: 400 });
  }

  const r = await labsChat(v.iid, session, mensaje);
  if (!r.ok) {
    const status = r.error === "no_existe" ? 404 : 502;
    return NextResponse.json({ error: r.error }, { status });
  }
  return NextResponse.json(r.data);
}

export async function GET(request: Request, ctx: Params) {
  const v = await validar(request, ctx);
  if ("error" in v) return v.error;

  const session = new URL(request.url).searchParams.get("session") ?? "";
  if (!SESSION.test(session)) {
    return NextResponse.json({ error: "peticion_invalida" }, { status: 400 });
  }
  const r = await labsHistorial(v.iid, session);
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: 502 });
  }
  return NextResponse.json(r.data);
}

export async function DELETE(request: Request, ctx: Params) {
  const v = await validar(request, ctx);
  if ("error" in v) return v.error;

  const session = new URL(request.url).searchParams.get("session") ?? "";
  if (!SESSION.test(session)) {
    return NextResponse.json({ error: "peticion_invalida" }, { status: 400 });
  }
  const r = await labsReset(v.iid, session);
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
