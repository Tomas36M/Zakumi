import { describe, expect, it } from "vitest";
import { parseConversacionEleven } from "../api";

// Solo el parser puro: el resto de api.ts es red y se prueba en el smoke.
describe("parseConversacionEleven", () => {
  it("mapea el shape documentado del GET /v1/convai/conversations/{id}", () => {
    const r = parseConversacionEleven({
      conversation_id: "conv_abc123",
      status: "in-progress",
      agent_id: "agent_xyz",
      transcript: [],
    });
    expect(r).toEqual({ conversation_id: "conv_abc123", status: "in-progress" });
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

  it("json basura no lanza: sin conversation_id queda vacío y desconocido", () => {
    expect(parseConversacionEleven(null)).toEqual({
      conversation_id: "",
      status: "desconocido",
    });
    expect(parseConversacionEleven("texto")).toEqual({
      conversation_id: "",
      status: "desconocido",
    });
    expect(parseConversacionEleven({ status: 42 })).toEqual({
      conversation_id: "",
      status: "desconocido",
    });
  });
});
