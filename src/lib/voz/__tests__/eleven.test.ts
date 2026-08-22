import { describe, expect, it } from "vitest";
import { normalizarTelefono, payloadAgente, payloadBatch, payloadLlamadaUnica } from "../eleven";
import { seccionesVacias } from "../guias";
import { EXTRACCION_LEAD, LLM_VOZ, TTS_MODEL_VOZ } from "../tipos";

const CONFIG = {
  nombre: "Agente Demo",
  voiceId: "voz123",
  primerMensaje: "¡Hola! Soy el asistente virtual de Demo.",
  secciones: seccionesVacias(),
  extraccion: [...EXTRACCION_LEAD],
};

describe("payloadAgente", () => {
  it("arma el payload COMPLETO: un PATCH parcial borraría tools/overrides", () => {
    const p = payloadAgente(CONFIG) as Record<string, any>;
    // Pins verificados en producción (Luci): español exige flash v2_5.
    expect(p.conversation_config.tts.model_id).toBe(TTS_MODEL_VOZ);
    expect(p.conversation_config.agent.prompt.llm).toBe(LLM_VOZ);
    expect(p.conversation_config.agent.language).toBe("es");
    // end_call SIEMPRE presente o el agente no puede colgar.
    expect(p.conversation_config.agent.prompt.tools).toEqual([
      expect.objectContaining({ name: "end_call", params: { system_tool_type: "end_call" } }),
    ]);
    // Placeholders: sin ellos una llamada con variables no valida.
    expect(
      p.conversation_config.agent.dynamic_variables.dynamic_variable_placeholders,
    ).toHaveProperty("telefono");
    expect(p.platform_settings.overrides.conversation_config_override.tts.voice_id).toBe(true);
  });

  it("la extracción tipada viaja como data_collection {clave: {type, description}}", () => {
    const p = payloadAgente(CONFIG) as Record<string, any>;
    expect(p.platform_settings.data_collection.lead_nombre).toEqual({
      type: "string",
      description: expect.stringContaining("null"),
    });
    expect(p.platform_settings.data_collection.lead_interesado.type).toBe("boolean");
  });
});

describe("payloads de llamada", () => {
  it("llamada única: agent + número + variables", () => {
    const p = payloadLlamadaUnica({
      agentIdEleven: "agent_x",
      phoneNumberId: "phnum_x",
      telefono: "+573001234567",
      variables: { agente_id: "uuid", origen: "zakumi_prueba", telefono: "+573001234567" },
    }) as Record<string, any>;
    expect(p.to_number).toBe("+573001234567");
    expect(p.conversation_initiation_client_data.dynamic_variables.origen).toBe("zakumi_prueba");
  });

  it("batch: recipients con variables por destino y concurrencia 1", () => {
    const p = payloadBatch({
      agentIdEleven: "agent_x",
      phoneNumberId: "phnum_x",
      nombreBatch: "zakumi-demo-1",
      destinos: [
        { telefono: "+573001234567", variables: { agente_id: "u", origen: "zakumi_salida", telefono: "+573001234567" } },
        { telefono: "+573007654321", variables: { agente_id: "u", origen: "zakumi_salida", telefono: "+573007654321" } },
      ],
    }) as Record<string, any>;
    expect(p.target_concurrency_limit).toBe(1);
    expect(p.scheduled_time_unix).toBeNull();
    expect(p.recipients).toHaveLength(2);
    expect(p.recipients[1].phone_number).toBe("+573007654321");
    expect(
      p.recipients[0].conversation_initiation_client_data.dynamic_variables.telefono,
    ).toBe("+573001234567");
  });
});

describe("normalizarTelefono", () => {
  it("acepta E.164, agrega +57 a celulares colombianos y limpia formato", () => {
    expect(normalizarTelefono("+573001234567")).toBe("+573001234567");
    expect(normalizarTelefono("3001234567")).toBe("+573001234567");
    expect(normalizarTelefono("573001234567")).toBe("+573001234567");
    expect(normalizarTelefono(" 300 123-45.67 ")).toBe("+573001234567");
    expect(normalizarTelefono("+12132773044")).toBe("+12132773044");
  });

  it("rechaza lo irrecuperable", () => {
    expect(normalizarTelefono("")).toBeNull();
    expect(normalizarTelefono("60123456")).toBeNull(); // fijo nacional sin indicativo: ambiguo
    expect(normalizarTelefono("hola")).toBeNull();
    expect(normalizarTelefono("+03001234567")).toBeNull();
  });
});
