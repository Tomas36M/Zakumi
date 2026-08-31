import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { despacharLlamadaZak } from "@/lib/voz/despacho";
import { createSupabaseService } from "@/lib/voz/supabase-service";

// Zak (el bot de WhatsApp, Flask en Railway) dispara una llamada de voz: su
// tool llamar_por_voz hace POST aquí con el token compartido ZAK_VOZ_TOKEN.
// Segundo endpoint público del repo (junto a /api/voz/webhook, fuera del
// matcher del proxy a propósito): la puerta es el token, no la sesión — la
// DB entra por service-role y el handler SOLO despacha con el agente es_zak.
//
// Body: { telefono, nombre_contacto?, negocio_id?, motivo? }. Respuestas:
// 200 {ok, conversation_id} · 409 {error} (dominio: cap, sin número, tel
// inválido) · 401 token malo · 400 body malo · 503 sin configurar.

function tokenValido(header: string | null, esperado: string): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  // sha256 de ambos lados: compara en tiempo constante sin filtrar longitud.
  const a = createHash("sha256").update(header.slice(7)).digest();
  const b = createHash("sha256").update(esperado).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const esperado = process.env.ZAK_VOZ_TOKEN;
  if (!esperado) {
    console.error("[zak llamar] falta ZAK_VOZ_TOKEN");
    return NextResponse.json({ error: "sin_configurar" }, { status: 503 });
  }
  if (!tokenValido(request.headers.get("authorization"), esperado)) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const telefono = typeof b.telefono === "string" ? b.telefono.trim() : "";
  if (!telefono) {
    return NextResponse.json({ error: "falta_telefono" }, { status: 400 });
  }
  if (typeof b.motivo === "string" && b.motivo) {
    console.log("[zak llamar] motivo del bot:", b.motivo.slice(0, 200));
  }

  const supabase = createSupabaseService();
  if (!supabase) {
    return NextResponse.json({ error: "sin_configurar" }, { status: 503 });
  }

  const r = await despacharLlamadaZak(supabase, {
    telefono,
    nombreContacto: typeof b.nombre_contacto === "string" ? b.nombre_contacto : undefined,
    negocioId: typeof b.negocio_id === "string" ? b.negocio_id : undefined,
  });
  if ("error" in r) {
    // infra (config/red/DB) → 503: es un problema de operación, no un "no" de
    // negocio — el bot debe reintentar/escalar, no decirle al prospecto que no.
    return NextResponse.json({ error: r.error }, { status: r.infra ? 503 : 409 });
  }
  return NextResponse.json({ ok: true, conversation_id: r.conversationId });
}
