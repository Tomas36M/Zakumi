import { describe, expect, it } from "vitest";
import { parseEventoPostCall } from "../webhook";

/** Evento post_call_transcription con el shape de los fixtures de la doc
 * oficial (los mismos que usa Luci). */
function evento(sobrescribir: Record<string, unknown> = {}, dv: Record<string, unknown> | null = null) {
  return {
    type: "post_call_transcription",
    event_timestamp: 1_782_000_000,
    data: {
      agent_id: "agent_zakumi_1",
      conversation_id: "conv_abc",
      status: "done",
      has_audio: true,
      transcript: [
        { role: "agent", message: "¡Hola! Soy el asistente virtual de Demo.", time_in_call_secs: 0 },
        { role: "user", message: "Hola, quiero una cita.", time_in_call_secs: 4 },
      ],
      metadata: { start_time_unix_secs: 1_781_999_900, call_duration_secs: 41, cost: 320 },
      analysis: {
        data_collection_results: {
          lead_nombre: { data_collection_id: "lead_nombre", value: "Marta", rationale: "lo dijo" },
          lead_interesado: { data_collection_id: "lead_interesado", value: null, rationale: "no claro" },
        },
        evaluation_criteria_results: {
          objetivo_cumplido: { criteria_id: "objetivo_cumplido", result: "success" },
        },
        call_successful: "success",
        transcript_summary: "Marta pidió una cita.",
      },
      conversation_initiation_client_data: {
        dynamic_variables: dv ?? { agente_id: "uuid-1", origen: "zakumi_salida", telefono: "+573001234567" },
      },
      ...sobrescribir,
    },
  };
}

describe("parseEventoPostCall", () => {
  it("mapea el evento completo a los parámetros de la RPC", () => {
    const r = parseEventoPostCall(evento());
    if (r.tipo !== "llamada") throw new Error("debió parsear");
    expect(r.params.p_agent_id_eleven).toBe("agent_zakumi_1");
    expect(r.params.p_conversation_id).toBe("conv_abc");
    expect(r.params.p_direccion).toBe("saliente");
    expect(r.params.p_telefono).toBe("+573001234567");
    expect(r.params.p_estado).toBe("done");
    expect(r.params.p_resultado).toBe("success");
    expect(r.params.p_duracion_seg).toBe(41);
    expect(r.params.p_costo_creditos).toBe(320);
    expect(r.params.p_resumen).toBe("Marta pidió una cita.");
    // data_collection_results se aplana a {clave: value} — el value puede ser null.
    expect(r.params.p_datos).toEqual({ lead_nombre: "Marta", lead_interesado: null });
    expect(r.params.p_transcript).toEqual([
      { role: "agent", message: "¡Hola! Soy el asistente virtual de Demo." },
      { role: "user", message: "Hola, quiero una cita." },
    ]);
    expect(r.params.p_tiene_audio).toBe(true);
    expect(r.params.p_iniciada_en).toBe(new Date(1_781_999_900 * 1000).toISOString());
  });

  it("infiere la dirección: prueba > batch/salida > entrante > widget", () => {
    const prueba = parseEventoPostCall(
      evento({}, { origen: "zakumi_prueba", telefono: "+573001234567" }),
    );
    expect(prueba.tipo === "llamada" && prueba.params.p_direccion).toBe("prueba");
    expect(prueba.tipo === "llamada" && prueba.esPrueba).toBe(true);

    const batch = parseEventoPostCall(
      evento({ metadata: { batch_call: { batch_call_id: "batch_9" } } }, {}),
    );
    if (batch.tipo !== "llamada") throw new Error("debió parsear");
    expect(batch.params.p_direccion).toBe("saliente");
    expect(batch.params.p_batch_id).toBe("batch_9");

    const entrante = parseEventoPostCall(evento({}, { system__caller_id: "+573109998877" }));
    if (entrante.tipo !== "llamada") throw new Error("debió parsear");
    expect(entrante.params.p_direccion).toBe("entrante");
    expect(entrante.params.p_telefono).toBe("+573109998877");

    const widget = parseEventoPostCall(evento({}, {}));
    expect(widget.tipo === "llamada" && widget.params.p_direccion).toBe("widget");
  });

  it("call_initiation_failure → fallo_inicio (y tolera analysis ausente)", () => {
    const r = parseEventoPostCall({
      type: "call_initiation_failure",
      data: {
        agent_id: "agent_zakumi_1",
        conversation_id: "conv_fail",
        failure_reason: "no-answer",
      },
    });
    if (r.tipo !== "llamada") throw new Error("debió parsear");
    expect(r.params.p_estado).toBe("fallo_inicio");
    expect(r.params.p_resultado).toBeNull();
    expect(r.params.p_datos).toBeNull();
  });

  it("normaliza un call_successful desconocido a 'unknown' (el check del SQL no rebota)", () => {
    const r = parseEventoPostCall(
      evento({ analysis: { call_successful: "rarisimo", transcript_summary: null } }),
    );
    expect(r.tipo === "llamada" && r.params.p_resultado).toBe("unknown");
  });

  it("ignora sin lanzar: tipos no manejados, basura y eventos incompletos", () => {
    expect(parseEventoPostCall({ type: "post_call_audio", data: { full_audio: "..." } }).tipo).toBe("ignorar");
    expect(parseEventoPostCall(null).tipo).toBe("ignorar");
    expect(parseEventoPostCall("texto").tipo).toBe("ignorar");
    expect(parseEventoPostCall({ type: "post_call_transcription", data: {} }).tipo).toBe("ignorar");
  });
});

describe("parseEventoPostCall — campos de solicitud y cita", () => {
  it("aplana servicio_interes y cita_fecha_hora como el resto de la extracción", () => {
    const r = parseEventoPostCall(
      evento({
        analysis: {
          data_collection_results: {
            lead_nombre: { value: "María" },
            lead_detalle: { value: "Quiere un bot para su restaurante" },
            servicio_interes: { value: "bot de WhatsApp" },
            cita_fecha_hora: { value: "2026-09-03T10:00" },
            cita_confirmada: { value: true },
          },
          call_successful: "success",
          transcript_summary: "María quiere un bot.",
        },
      }),
    );
    if (r.tipo !== "llamada") throw new Error("debió parsear");
    expect(r.params.p_datos).toEqual({
      lead_nombre: "María",
      lead_detalle: "Quiere un bot para su restaurante",
      servicio_interes: "bot de WhatsApp",
      cita_fecha_hora: "2026-09-03T10:00",
      cita_confirmada: true,
    });
  });
});
