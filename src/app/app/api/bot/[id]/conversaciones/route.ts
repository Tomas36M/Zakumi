import { NextResponse } from "next/server";
import { getSesion } from "@/lib/auth/sesion";
import { instanciaDelCliente } from "@/lib/portal/dal";
import { listarConversaciones } from "@/lib/bots/api";

// SOLO LECTURA: el cliente ve las conversaciones de SU bot. Pausar, enviar
// manual y borrar historial son operaciones del admin y no existen aquí.
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
