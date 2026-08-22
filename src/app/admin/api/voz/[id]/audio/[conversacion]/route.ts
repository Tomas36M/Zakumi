import { NextResponse } from "next/server";
import { getSesionAdmin } from "@/lib/admin/dal";
import { audioConversacion } from "@/lib/voz/api";

// Proxy del audio de una llamada: la URL de ElevenLabs exige la API key, que
// jamás baja al browser. Solo admin, solo conversaciones que existen en
// llamadas_voz del agente pedido, y sin caché (audio de clientes).

export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONVERSACION = /^[A-Za-z0-9_-]{6,80}$/;

type Params = { params: Promise<{ id: string; conversacion: string }> };

export async function GET(_request: Request, { params }: Params) {
  const sesion = await getSesionAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }

  const { id, conversacion } = await params;
  if (!UUID.test(id) || !CONVERSACION.test(conversacion)) {
    return NextResponse.json({ error: "peticion_invalida" }, { status: 400 });
  }

  const { data: llamada, error } = await sesion.supabase
    .from("llamadas_voz")
    .select("tiene_audio")
    .eq("agente_id", id)
    .eq("conversation_id", conversacion)
    .maybeSingle();
  if (error) {
    console.error("[voz audio]", error.message);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }
  if (!llamada) {
    return NextResponse.json({ error: "no_existe" }, { status: 404 });
  }

  const r = await audioConversacion(conversacion);
  if (!r.ok) {
    const status = r.error === "no_existe" ? 404 : 502;
    return NextResponse.json({ error: r.error }, { status });
  }

  return new Response(r.data.body, {
    headers: {
      "Content-Type": r.data.headers.get("Content-Type") ?? "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
