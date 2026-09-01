import { describe, expect, it } from "vitest";
import { parsearCita } from "../fecha";

// Todas las pruebas anclan "ahora" para que no caduquen con el tiempo.
const AHORA = new Date("2026-09-01T15:00:00Z"); // 10:00 en Bogotá

describe("parsearCita", () => {
  it("ancla una fecha sin zona a Bogotá (UTC-5)", () => {
    const r = parsearCita("2026-09-03T10:00", { ahora: AHORA });
    expect(r).toEqual({
      inicio: "2026-09-03T15:00:00.000Z",
      fin: "2026-09-03T15:30:00.000Z",
    });
  });

  it("acepta segundos y espacio en vez de T", () => {
    const r = parsearCita("2026-09-03 10:00:00", { ahora: AHORA });
    expect(r?.inicio).toBe("2026-09-03T15:00:00.000Z");
  });

  it("respeta la zona cuando el agente sí la manda", () => {
    const r = parsearCita("2026-09-03T15:00:00Z", { ahora: AHORA });
    expect(r?.inicio).toBe("2026-09-03T15:00:00.000Z");
  });

  it("respeta la duración pedida", () => {
    const r = parsearCita("2026-09-03T10:00", { ahora: AHORA, duracionMin: 45 });
    expect(r?.fin).toBe("2026-09-03T15:45:00.000Z");
  });

  it("descarta el pasado", () => {
    expect(parsearCita("2026-08-30T10:00", { ahora: AHORA })).toBeNull();
  });

  it("descarta fechas absurdamente lejanas (alucinación de año)", () => {
    expect(parsearCita("2027-09-03T10:00", { ahora: AHORA })).toBeNull();
  });

  it("descarta texto libre y valores que no son texto", () => {
    expect(parsearCita("el jueves por la tarde", { ahora: AHORA })).toBeNull();
    expect(parsearCita("", { ahora: AHORA })).toBeNull();
    expect(parsearCita(null, { ahora: AHORA })).toBeNull();
    expect(parsearCita(42, { ahora: AHORA })).toBeNull();
  });
});
