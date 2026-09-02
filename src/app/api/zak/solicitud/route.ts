import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { registrarSolicitudEntrante } from "@/lib/solicitudes/entrada";
import { createSupabaseService } from "@/lib/voz/supabase-service";

// Zak (el bot de WhatsApp, Flask en Railway) cierra una conversación con
// intención de contratar: su tool registrar_solicitud hace POST aquí con el
// token compartido ZAK_VOZ_TOKEN — el mismo de /api/zak/llamar, misma
// contraparte y un secreto menos que rotar.
//
// Tercer endpoint público del repo (fuera del matcher del proxy a propósito):
// la puerta es el token, no la sesión. La DB entra por service-role.
//
// Body: { telefono, ref?, nombre?, email?, servicio?, detalle?, mejor_horario?,
//         cita? }. Respuestas: 200 {status: 'creada'|'duplicada'} · 400 body
// malo · 401 token malo · 500 error de dominio · 503 sin configurar.

function tokenValido(header: string | null, esperado: string): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  // sha256 de ambos lados: compara en tiempo constante sin filtrar longitud.
  const a = createHash("sha256").update(header.slice(7)).digest();
  const b = createHash("sha256").update(esperado).digest();
  return timingSafeEqual(a, b);
}

const texto = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

export async function POST(request: Request) {
  const esperado = process.env.ZAK_VOZ_TOKEN;
  if (!esperado) {
    console.error("[zak solicitud] falta ZAK_VOZ_TOKEN");
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
  const telefono = texto(b.telefono);
  if (!telefono) {
    return NextResponse.json({ error: "falta_telefono" }, { status: 400 });
  }

  const supabase = createSupabaseService();
  if (!supabase) {
    return NextResponse.json({ error: "sin_configurar" }, { status: 503 });
  }

  // Sin `ref` del bot, la clave de idempotencia se ancla al teléfono y al día:
  // dos cierres del mismo chat el mismo día son el mismo interés, no dos.
  const ref = texto(b.ref) ?? `${telefono}:${new Date().toISOString().slice(0, 10)}`;

  const r = await registrarSolicitudEntrante(supabase, {
    origen: "whatsapp",
    claveOrigen: `wa:${ref}`,
    contacto: { nombre: texto(b.nombre), telefono, email: texto(b.email) },
    servicioInteres: texto(b.servicio),
    detalle: texto(b.detalle),
    mejorHorario: texto(b.mejor_horario),
    citaCruda: b.cita,
    conversacion: telefono,
  });

  if (r.estado === "error") {
    console.error("[zak solicitud] no se registró:", r.motivo);
    return NextResponse.json({ error: r.motivo }, { status: 500 });
  }
  return NextResponse.json({ status: r.estado });
}
