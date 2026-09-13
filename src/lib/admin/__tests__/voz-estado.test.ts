import { describe, expect, it } from "vitest";
import { estadoVozZak } from "../voz-estado";

const listo = { agent_id_eleven: "agent_1", activo: true, phone_number_id_eleven: null };

describe("estadoVozZak", () => {
  it("sin fila no hay agente", () => {
    expect(estadoVozZak(null, true)).toBe("sin_agente");
  });

  it("sin id de ElevenLabs está sin sincronizar, aunque esté activo", () => {
    expect(estadoVozZak({ ...listo, agent_id_eleven: null }, true)).toBe("sin_sincronizar");
  });

  it("apagado gana sobre el número", () => {
    expect(estadoVozZak({ ...listo, activo: false }, true)).toBe("apagada");
  });

  it("lista si el número viene del entorno O del agente", () => {
    expect(estadoVozZak(listo, true)).toBe("lista");
    expect(estadoVozZak({ ...listo, phone_number_id_eleven: "phnum_1" }, false)).toBe("lista");
  });

  it("sin ningún número saliente, falta el paso 7 del runbook", () => {
    expect(estadoVozZak(listo, false)).toBe("sin_numero");
  });
});
