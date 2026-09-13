import { describe, expect, it } from "vitest";
import type { Cita360 } from "../consultas";
import {
  carriles,
  citaDesdeFormulario,
  diaBogotaDe,
  etiquetaSemana,
  formularioDesdeCita,
  HORA_INICIO,
  lunesDe,
  MINUTOS_GRILLA,
  posicionEnGrilla,
  rangoSemana,
  semanaVecina,
  validarCita,
} from "../semana";

function cita(extra: Partial<Cita360>): Cita360 {
  return {
    id: "c1",
    solicitudId: "c1",
    inicio: "2026-09-14T14:00:00.000Z",
    fin: "2026-09-14T14:30:00.000Z",
    nombre: null,
    telefono: null,
    telefonoAviso: null,
    servicio: null,
    detalle: null,
    meetUrl: null,
    linkGoogle: null,
    tieneEventoGoogle: false,
    origen: "voz",
    estado: "nueva",
    ...extra,
  };
}

describe("diaBogotaDe y lunesDe", () => {
  it("a las 19:00 de Bogotá ya es mañana en UTC, pero el día sigue siendo hoy", () => {
    // 2026-09-14 19:30 Bogotá = 2026-09-15 00:30Z
    expect(diaBogotaDe("2026-09-15T00:30:00Z")).toBe("2026-09-14");
  });

  it("el lunes de un domingo es el lunes anterior; el de un lunes, él mismo", () => {
    expect(lunesDe("2026-09-13")).toBe("2026-09-07"); // domingo
    expect(lunesDe("2026-09-14")).toBe("2026-09-14"); // lunes
    expect(lunesDe("2026-09-16")).toBe("2026-09-14"); // miércoles
  });

  it("la semana vecina cruza el mes sin sorpresas", () => {
    expect(semanaVecina("2026-09-28", 1)).toBe("2026-10-05");
    expect(semanaVecina("2026-10-05", -1)).toBe("2026-09-28");
  });
});

describe("rangoSemana", () => {
  const r = rangoSemana("2026-09-14", "2026-09-16");

  it("siete días con etiqueta corta y el de hoy marcado", () => {
    expect(r.dias.map((d) => d.fecha)).toEqual([
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
    ]);
    expect(r.dias[0].etiqueta).toBe("lun 14");
    expect(r.dias.filter((d) => d.esHoy).map((d) => d.fecha)).toEqual(["2026-09-16"]);
  });

  it("desde/hasta son medianoches de Bogotá en UTC, hasta exclusivo", () => {
    expect(r.desde).toBe("2026-09-14T05:00:00.000Z");
    expect(r.hasta).toBe("2026-09-21T05:00:00.000Z");
  });

  it("la etiqueta se acorta cuando comparten mes y se alarga cuando no", () => {
    expect(etiquetaSemana(r)).toBe("14 – 20 sep 2026");
    expect(etiquetaSemana(rangoSemana("2026-09-28", "2026-09-28"))).toBe("28 sep – 4 oct 2026");
    expect(etiquetaSemana(rangoSemana("2025-12-29", "2025-12-29"))).toBe(
      "29 dic 2025 – 4 ene 2026",
    );
  });
});

describe("posicionEnGrilla", () => {
  const semana = rangoSemana("2026-09-14", "2026-09-14");

  it("coloca una cita en su columna y sus minutos desde las 6:00 de Bogotá", () => {
    // 2026-09-16 09:00 Bogotá = 14:00Z (miércoles)
    const p = posicionEnGrilla(
      { inicio: "2026-09-16T14:00:00Z", fin: "2026-09-16T14:30:00Z" },
      semana,
    );
    expect(p).toEqual({
      columna: 2,
      desdeMin: (9 - HORA_INICIO) * 60,
      duracionMin: 30,
      recortada: false,
    });
  });

  it("una cita de otra semana no cae en la grilla", () => {
    expect(
      posicionEnGrilla({ inicio: "2026-09-22T14:00:00Z", fin: "2026-09-22T14:30:00Z" }, semana),
    ).toBeNull();
  });

  it("una cita fuera de horario se recorta y lo dice", () => {
    // 23:30 Bogotá = 04:30Z del día siguiente
    const p = posicionEnGrilla(
      { inicio: "2026-09-17T04:30:00Z", fin: "2026-09-17T05:00:00Z" },
      semana,
    );
    expect(p?.columna).toBe(2);
    expect(p?.recortada).toBe(true);
    expect((p?.desdeMin ?? 0) + (p?.duracionMin ?? 0)).toBeLessThanOrEqual(MINUTOS_GRILLA);
  });

  it("una cita de 10 minutos mide al menos lo mínimo tocable", () => {
    const p = posicionEnGrilla(
      { inicio: "2026-09-16T14:00:00Z", fin: "2026-09-16T14:10:00Z" },
      semana,
    );
    expect(p?.duracionMin).toBe(20);
    expect(p?.recortada).toBe(true);
  });
});

describe("carriles", () => {
  it("dos citas que se pisan van en dos carriles del mismo grupo", () => {
    const m = carriles([
      cita({ id: "a", inicio: "2026-09-14T14:00:00Z", fin: "2026-09-14T15:00:00Z" }),
      cita({ id: "b", inicio: "2026-09-14T14:30:00Z", fin: "2026-09-14T15:00:00Z" }),
    ]);
    expect(m.get("a")).toEqual({ carril: 0, total: 2 });
    expect(m.get("b")).toEqual({ carril: 1, total: 2 });
  });

  it("tres solapadas en cadena reusan el carril que quedó libre", () => {
    const m = carriles([
      cita({ id: "a", inicio: "2026-09-14T14:00:00Z", fin: "2026-09-14T14:30:00Z" }),
      cita({ id: "b", inicio: "2026-09-14T14:15:00Z", fin: "2026-09-14T15:00:00Z" }),
      cita({ id: "c", inicio: "2026-09-14T14:30:00Z", fin: "2026-09-14T15:00:00Z" }),
    ]);
    expect(m.get("c")).toEqual({ carril: 0, total: 2 });
    expect(m.get("b")).toEqual({ carril: 1, total: 2 });
  });

  it("citas que no se tocan van solas, aunque sea el mismo día", () => {
    const m = carriles([
      cita({ id: "a", inicio: "2026-09-14T14:00:00Z", fin: "2026-09-14T14:30:00Z" }),
      cita({ id: "b", inicio: "2026-09-14T16:00:00Z", fin: "2026-09-14T16:30:00Z" }),
      cita({ id: "c", inicio: "2026-09-15T14:00:00Z", fin: "2026-09-15T14:30:00Z" }),
    ]);
    expect(m.get("a")).toEqual({ carril: 0, total: 1 });
    expect(m.get("b")).toEqual({ carril: 0, total: 1 });
    expect(m.get("c")).toEqual({ carril: 0, total: 1 });
  });
});

describe("citaDesdeFormulario ↔ formularioDesdeCita", () => {
  it("ida y vuelta en hora de Bogotá", () => {
    const c = citaDesdeFormulario({ fecha: "2026-09-16", hora: "09:00", duracionMin: 45 });
    expect(c).toEqual({ inicio: "2026-09-16T14:00:00.000Z", fin: "2026-09-16T14:45:00.000Z" });
    expect(formularioDesdeCita(c!)).toEqual({ fecha: "2026-09-16", hora: "09:00", duracionMin: 45 });
  });

  it("rechaza formularios incompletos o rotos", () => {
    expect(citaDesdeFormulario({ fecha: "", hora: "09:00", duracionMin: 30 })).toBeNull();
    expect(citaDesdeFormulario({ fecha: "2026-09-16", hora: "9", duracionMin: 30 })).toBeNull();
    expect(citaDesdeFormulario({ fecha: "2026-09-16", hora: "09:00", duracionMin: 0 })).toBeNull();
    expect(citaDesdeFormulario({ fecha: "2026-13-45", hora: "09:00", duracionMin: 30 })).toBeNull();
  });
});

describe("validarCita", () => {
  const ahora = new Date("2026-09-13T12:00:00Z");

  it("acepta una cita futura, corta y cercana", () => {
    expect(
      validarCita({ inicio: "2026-09-14T14:00:00Z", fin: "2026-09-14T14:30:00Z" }, ahora),
    ).toBeNull();
  });

  it("rechaza fin antes del inicio, pasado, muy lejos y muy larga", () => {
    expect(validarCita({ inicio: "2026-09-14T14:30:00Z", fin: "2026-09-14T14:00:00Z" }, ahora)).toMatch(/terminar/);
    expect(validarCita({ inicio: "2026-09-13T11:00:00Z", fin: "2026-09-13T11:30:00Z" }, ahora)).toMatch(/futuro/);
    expect(validarCita({ inicio: "2027-01-14T14:00:00Z", fin: "2027-01-14T14:30:00Z" }, ahora)).toMatch(/90 días/);
    expect(validarCita({ inicio: "2026-09-14T14:00:00Z", fin: "2026-09-15T00:00:00Z" }, ahora)).toMatch(/ocho horas/);
    expect(validarCita({ inicio: "basura", fin: "2026-09-14T14:30:00Z" }, ahora)).toMatch(/no se entiende/);
  });
});
