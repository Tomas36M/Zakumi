import { NextResponse } from "next/server";
import { getSesion } from "@/lib/auth/sesion";
import { instanciaDelCliente } from "@/lib/portal/dal";
import { labsChat, labsHistorial, labsReset } from "@/lib/bots/api";

// Espejo del labs de /admin/api pero con el doble check del portal: sesión +
// propiedad de la instancia (un cliente jamás prueba el bot de otro).
// El turno corre síncrono en el bot (Claude + tools: 3-10 s) — sin
// maxDuration, Vercel corta la función a mitad de turno.
export const maxDuration = 60;

const SESSION = /^[a-z0-9-]{4,40}$/;

type Params = { params: Promise<{ id: string }> };

async function validar({ params }: Params) {
  const sesion = await getSesion();
  if (!sesion) {
    return { error: NextResponse.json({ error: "no_autorizado" }, { status: 401 }) };
  }
  const { id } = await params;
  const iid = await instanciaDelCliente(sesion, id);
  if (iid === null) {
    // 404 y no 403: no se revela si la instancia existe.
    return { error: NextResponse.json({ error: "no_existe" }, { status: 404 }) };
  }
  return { iid };
}

export async function POST(request: Request, ctx: Params) {
  const v = await validar(ctx);
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
  const v = await validar(ctx);
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
  const v = await validar(ctx);
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
