import { describe, expect, it } from "vitest";
import { inicioDiaBogota } from "../tipos";

describe("inicioDiaBogota", () => {
  it("un instante en la tarde de Bogotá cae al 05:00 UTC del mismo día", () => {
    // 2026-08-22 20:00 UTC = 15:00 en Bogotá → el día empezó a las 05:00 UTC.
    const r = inicioDiaBogota(new Date("2026-08-22T20:00:00Z"));
    expect(r.toISOString()).toBe("2026-08-22T05:00:00.000Z");
  });

  it("la madrugada UTC pertenece al día ANTERIOR de Bogotá", () => {
    // 2026-08-22 03:00 UTC = 22:00 del 21 en Bogotá.
    const r = inicioDiaBogota(new Date("2026-08-22T03:00:00Z"));
    expect(r.toISOString()).toBe("2026-08-21T05:00:00.000Z");
  });

  it("el borde exacto (05:00 UTC) ya es el día nuevo", () => {
    const r = inicioDiaBogota(new Date("2026-08-22T05:00:00Z"));
    expect(r.toISOString()).toBe("2026-08-22T05:00:00.000Z");
  });
});
