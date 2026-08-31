import { NextResponse } from "next/server";
import { verificarFirma } from "@/lib/voz/hmac";
import { parseEventoPostCall } from "@/lib/voz/webhook";
import { createSupabaseService } from "@/lib/voz/supabase-service";
import { avisarAdmin } from "@/lib/portal/avisos";

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
    lead?: boolean;
    agente_nombre?: string;
    sin_cliente?: boolean;
  };

  // Aviso de lead por WhatsApp — fire-and-forget: nunca tumba el 200.
  // Dos casos: se creó la venta en el portal (lead=true, cualquier canal
  // salvo prueba), o el agente es interno (Zak/demo, sin cliente): la RPC no
  // crea venta pero el prospecto es de Zakumi. Para el interno solo avisan
  // saliente/entrante — las sesiones de widget del agente interno son casi
  // siempre el lab del panel, y las pruebas nunca avisan.
  const d = evento.params.p_datos ?? {};
  const dir = evento.params.p_direccion;
  const hayDatosLead =
    (typeof d.lead_nombre === "string" && d.lead_nombre !== "") ||
    (typeof d.lead_telefono === "string" && d.lead_telefono !== "") ||
    d.lead_interesado === true;
  const debeAvisar =
    r.status === "ok" &&
    dir !== "prueba" &&
    (r.lead === true ||
      (r.sin_cliente === true &&
        hayDatosLead &&
        (dir === "saliente" || dir === "entrante")));
  if (debeAvisar) {
    // '' del extractor no es un teléfono: cae al número marcado del evento.
    const telLead =
      typeof d.lead_telefono === "string" && d.lead_telefono !== ""
        ? d.lead_telefono
        : evento.params.p_telefono;
    const quien = [d.lead_nombre, telLead]
      .filter((x): x is string => typeof x === "string" && x !== "")
      .join(" · ");
    await avisarAdmin(
      `🎙️ Lead por llamada de voz — ${r.agente_nombre ?? "agente"}\n` +
        `${quien || "sin datos de contacto"}\n` +
        `${evento.params.p_resumen ?? ""}`.trim(),
    );
  }

  return NextResponse.json({ status: r.status ?? "ok" });
}
