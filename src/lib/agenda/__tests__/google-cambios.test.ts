import { describe, expect, it } from "vitest";
import { cuerpoReprogramacion, resultadoDeStatus } from "../google";

describe("cuerpoReprogramacion", () => {
  it("manda solo inicio y fin, con la zona del negocio", () => {
    expect(cuerpoReprogramacion("2026-09-14T14:00:00.000Z", "2026-09-14T14:30:00.000Z")).toEqual({
      start: { dateTime: "2026-09-14T14:00:00.000Z", timeZone: "America/Bogota" },
      end: { dateTime: "2026-09-14T14:30:00.000Z", timeZone: "America/Bogota" },
    });
  });
});

describe("resultadoDeStatus", () => {
  it("2xx es ok (incluido el 204 del DELETE)", () => {
    expect(resultadoDeStatus(200)).toBe("ok");
    expect(resultadoDeStatus(204)).toBe("ok");
  });

  it("404 y 410 son «ya no existe», no un error", () => {
    expect(resultadoDeStatus(404)).toBe("no_existe");
    expect(resultadoDeStatus(410)).toBe("no_existe");
  });

  it("todo lo demás es error", () => {
    expect(resultadoDeStatus(401)).toBe("error");
    expect(resultadoDeStatus(403)).toBe("error");
    expect(resultadoDeStatus(500)).toBe("error");
  });
});
