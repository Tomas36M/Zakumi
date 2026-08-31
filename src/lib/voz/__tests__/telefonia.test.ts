import { describe, expect, it } from "vitest";
import { parseNumerosEleven } from "../api";
import { parseNumerosDisponibles } from "../twilio";

describe("parseNumerosEleven", () => {
  it("mapea el listado del workspace y su agente asignado", () => {
    const r = parseNumerosEleven([
      {
        phone_number_id: "phnum_123",
        phone_number: "+13055550123",
        label: "Zakumi",
        assigned_agent: { agent_id: "agent_abc" },
      },
      { phone_number_id: "phnum_456", phone_number: "+573001112233", label: "Cliente" },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0].agente_asignado).toBe("agent_abc");
    expect(r[1].agente_asignado).toBeNull();
  });

  it("json que no es lista (o filas sin id) no lanza", () => {
    expect(parseNumerosEleven(null)).toEqual([]);
    expect(parseNumerosEleven({ phone_numbers: [] })).toEqual([]);
    expect(parseNumerosEleven([{ phone_number: "+1305" }])).toEqual([]);
  });
});

describe("parseNumerosDisponibles", () => {
  it("mapea el shape de Twilio y marca la capacidad de voz", () => {
    const r = parseNumerosDisponibles({
      available_phone_numbers: [
        {
          friendly_name: "(305) 555-0123",
          phone_number: "+13055550123",
          locality: "Miami",
          region: "FL",
          capabilities: { voice: true, SMS: true },
        },
        {
          friendly_name: "sin voz",
          phone_number: "+13055550999",
          capabilities: { voice: false },
        },
      ],
    });
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ numero: "+13055550123", localidad: "Miami", voz: true });
    expect(r[1].voz).toBe(false);
    expect(r[1].localidad).toBeNull();
  });

  it("respuesta vacía o basura no lanza", () => {
    expect(parseNumerosDisponibles(null)).toEqual([]);
    expect(parseNumerosDisponibles({ available_phone_numbers: "x" })).toEqual([]);
    expect(parseNumerosDisponibles({ available_phone_numbers: [{ locality: "X" }] })).toEqual([]);
  });
});
