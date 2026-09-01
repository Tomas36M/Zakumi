import { NextResponse } from "next/server";
import { verificarFirma } from "@/lib/voz/hmac";
import { parseEventoPostCall } from "@/lib/voz/webhook";
import { createSupabaseService } from "@/lib/voz/supabase-service";
import { avisarAdmin } from "@/lib/portal/avisos";
import { registrarSolicitudEntrante } from "@/lib/solicitudes/entrada";

// Webhook post-call de ElevenLabs — endpoint público (src/proxy.ts no cubre
// /api/** a propósito: aquí la puerta es la firma; el otro endpoint público
// es /api/zak/llamar, con token).
//
// Contrato de respuestas (calcado del lazo probado de Luci):
//   200 = procesado | duplicado | sin_agente | tipo no manejado
//         (para que ElevenLabs NO reintente lo que no va a cambiar)
//   401 = firma inválida        503 = falta el secret (no se procesa nada)
//   500 = error de DB → ElevenLabs reintenta si los retries están habilitados
//
// El workspace se comparte con Luci: un evento de un agente ajeno sale
// 'sin_agente' (200) desde la RPC, que solo conoce los agent_id de Zakumi.

export async function POST(request: Request) {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[voz webhook] falta ELEVENLABS_WEBHOOK_SECRET");
    return NextResponse.json({ error: "sin_configurar" }, { status: 503 });
  }

  // La firma cubre el raw body EXACTO: leerlo antes de cualquier parseo.
  const raw = await request.text();
  const firma = verificarFirma(raw, request.headers.get("elevenlabs-signature"), secret);
  if (!firma.ok) {
    console.error("[voz webhook] firma rechazada:", firma.motivo);
    return NextResponse.json({ error: "firma_invalida" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    // Firmado pero impronunciable: no va a mejorar con un reintento.
    return NextResponse.json({ status: "ignorado", razon: "json_invalido" });
  }

  const evento = parseEventoPostCall(json);
  if (evento.tipo === "ignorar") {
    return NextResponse.json({ status: "ignorado", razon: evento.razon });
  }

  const supabase = createSupabaseService();
  if (!supabase) {
    return NextResponse.json({ error: "sin_configurar" }, { status: 503 });
  }

  const { data, error } = await supabase.rpc("registrar_llamada_voz", evento.params);
  if (error) {
    console.error("[voz webhook] registrar_llamada_voz:", error.message);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  const r = (data ?? {}) as {
    status?: string;
    llamada_id?: string;
    lead?: boolean;
    agente_nombre?: string;
    sin_cliente?: boolean;
  };

  // Qué hacemos al colgar, según de quién sea el agente:
  //   - agente NUESTRO (sin_cliente): la persona es un prospecto de Zakumi →
  //     solicitud en la bandeja + cita + aviso (todo dentro de entrada.ts).
  //   - agente DE UN CLIENTE (lead): se comporta igual que siempre — la venta
  //     ya la creó la RPC en ventas_cliente y aquí solo sale el aviso.
  // 'prueba' (el lab del panel) nunca produce efectos comerciales. Del agente
  // interno solo cuentan saliente/entrante: sus sesiones de widget son casi
  // siempre el propio lab.
  const d = evento.params.p_datos ?? {};
  const dir = evento.params.p_direccion;
  const texto = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);

  const hayDatosLead =
    texto(d.lead_nombre) !== null ||
    texto(d.lead_telefono) !== null ||
    texto(d.lead_detalle) !== null ||
    texto(d.servicio_interes) !== null ||
    d.lead_interesado === true;

  if (r.status === "ok" && dir !== "prueba") {
    // '' del extractor no es un teléfono: cae al número marcado del evento.
    const telLead = texto(d.lead_telefono) ?? evento.params.p_telefono;

    if (r.sin_cliente === true && hayDatosLead && (dir === "saliente" || dir === "entrante")) {
      // La propia RPC devuelve el id de la fila que acaba de insertar en
      // llamadas_voz (v_llamada_id) — no hace falta ir a buscarlo aparte.
      await registrarSolicitudEntrante(supabase, {
        origen: "voz",
        claveOrigen: `voz:${evento.params.p_conversation_id}`,
        contacto: { nombre: texto(d.lead_nombre), telefono: telLead, email: null },
        servicioInteres: texto(d.servicio_interes),
        detalle: texto(d.lead_detalle) ?? evento.params.p_resumen,
        mejorHorario: texto(d.mejor_horario),
        citaCruda: d.cita_fecha_hora,
        llamadaId: r.llamada_id ?? null,
      });
    } else if (r.lead === true) {
      const quien = [d.lead_nombre, telLead]
        .filter((x): x is string => typeof x === "string" && x !== "")
        .join(" · ");
      await avisarAdmin(
        `🎙️ Lead por llamada de voz — ${r.agente_nombre ?? "agente"}\n` +
          `${quien || "sin datos de contacto"}\n` +
          `${evento.params.p_resumen ?? ""}`.trim(),
      );
    }
  }

  return NextResponse.json({ status: r.status ?? "ok" });
}
