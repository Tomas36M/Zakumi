import { describe, expect, it } from "vitest";
import {
  parseConversacionEleven,
  parseVocesCompartidas,
  parseVocesWorkspace,
} from "../api";

// Solo el parser puro: el resto de api.ts es red y se prueba en el smoke.
describe("parseConversacionEleven", () => {
  it("mapea el shape documentado del GET /v1/convai/conversations/{id}", () => {
    const r = parseConversacionEleven({
      conversation_id: "conv_abc123",
      status: "in-progress",
      agent_id: "agent_xyz",
      transcript: [],
    });
    expect(r).toEqual({ conversation_id: "conv_abc123", status: "in-progress", turnos: [] });
  });

  // Lo que hace posible narrar la llamada mientras pasa: el mismo GET trae la
  // transcripción parcial, y crece turno a turno.
  it("trae los turnos ya transcritos de una llamada en curso", () => {
    const r = parseConversacionEleven({
      conversation_id: "conv_abc123",
      status: "in-progress",
      transcript: [
        { role: "agent", message: "¡Hola! Soy Zak, de Zakumi.", time_in_call_secs: 0 },
        { role: "user", message: "Cuéntame.", time_in_call_secs: 5 },
      ],
    });
    expect(r.turnos).toEqual([
      { role: "agent", message: "¡Hola! Soy Zak, de Zakumi." },
      { role: "user", message: "Cuéntame." },
    ]);
  });

  // Sin transcripción no hay narración, pero tampoco error: el UI pinta la
  // fase y espera. Por eso `turnos` es siempre un array.
  it("sin transcript en el json, turnos queda vacío", () => {
    expect(parseConversacionEleven({ conversation_id: "c_123456", status: "initiated" }).turnos)
      .toEqual([]);
    expect(parseConversacionEleven({ conversation_id: "c_123456", transcript: "rota" }).turnos)
      .toEqual([]);
  });

  it.each(["initiated", "processing", "done", "failed"] as const)(
    "acepta el status %s",
    (status) => {
      expect(parseConversacionEleven({ conversation_id: "c_123456", status }).status).toBe(
        status,
      );
    },
  );

  it("un status que no conocemos cae a 'desconocido' sin lanzar", () => {
    expect(
      parseConversacionEleven({ conversation_id: "c_123456", status: "queued-v2" }).status,
    ).toBe("desconocido");
  });

  it("json basura no lanza (parsers de voces incluidos)", () => {
    expect(parseVocesWorkspace(null)).toEqual([]);
    expect(parseVocesWorkspace({ voices: "x" })).toEqual([]);
    expect(parseVocesCompartidas(null)).toEqual([]);
    expect(parseVocesCompartidas({ voices: [null, 42] })).toEqual([]);
  });

  it("json basura no lanza: sin conversation_id queda vacío y desconocido", () => {
    expect(parseConversacionEleven(null)).toEqual({
      conversation_id: "",
      status: "desconocido",
      turnos: [],
    });
    expect(parseConversacionEleven("texto")).toEqual({
      conversation_id: "",
      status: "desconocido",
      turnos: [],
    });
    expect(parseConversacionEleven({ status: 42 })).toEqual({
      conversation_id: "",
      status: "desconocido",
      turnos: [],
    });
  });
});

describe("parseVocesWorkspace", () => {
  it("mapea labels con idioma y aplana etiquetas", () => {
    const r = parseVocesWorkspace({
      voices: [
        {
          voice_id: "v1",
          name: "Bella",
          preview_url: "https://x/p.mp3",
          labels: { language: "en", accent: "american", gender: "female", age: "middle_aged" },
        },
        { voice_id: "", name: "rota" },
      ],
    });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ voice_id: "v1", idioma: "en" });
    expect(r[0].etiquetas).toBe("american · female · middle_aged");
  });

  it("sin labels de idioma → idioma null", () => {
    const r = parseVocesWorkspace({ voices: [{ voice_id: "v2", name: "X", labels: {} }] });
    expect(r[0].idioma).toBeNull();
  });
});

describe("parseVocesCompartidas", () => {
  it("mapea el shape real del GET /v1/shared-voices", () => {
    const r = parseVocesCompartidas({
      voices: [
        {
          public_owner_id: "own1",
          voice_id: "vc1",
          name: "Graciela - Wise and Grounded",
          language: "es",
          locale: "es-AR",
          accent: "latin american",
          gender: "female",
          age: "middle_aged",
          use_case: "narrative_story",
          preview_url: "https://x/g.mp3",
        },
      ],
    });
    expect(r[0]).toEqual({
      public_owner_id: "own1",
      voice_id: "vc1",
      nombre: "Graciela - Wise and Grounded",
      idioma: "es",
      locale: "es-AR",
      etiquetas: "latin american · female · middle_aged · narrative_story",
      preview_url: "https://x/g.mp3",
    });
  });

  it("descarta filas sin voice_id o sin public_owner_id", () => {
    const r = parseVocesCompartidas({
      voices: [
        { public_owner_id: "", voice_id: "a", name: "x" },
        { public_owner_id: "b", voice_id: "", name: "y" },
      ],
    });
    expect(r).toEqual([]);
  });
});
