import { describe, expect, it } from "vitest";
import { queQuedo, textoReunion, variablesReunion } from "../mensaje-lead";

const INICIO = "2026-09-13T19:00:00Z"; // domingo 13 sep 2026, 2:00 p. m. Bogotá

describe("queQuedo", () => {
  it("dice la fecha legible en hora de Bogotá al agendar o mover", () => {
    expect(queQuedo({ nombre: null, accion: "agendada", inicio: INICIO, meetUrl: null })).toMatch(
      /^agendada para el domingo, 13 de septiembre de 2026, 2:00/,
    );
    expect(queQuedo({ nombre: null, accion: "reprogramada", inicio: INICIO, meetUrl: null })).toMatch(
      /^reprogramada para el/,
    );
  });

  it("cancelada no lleva fecha, aunque venga una", () => {
    expect(queQuedo({ nombre: null, accion: "cancelada", inicio: INICIO, meetUrl: null })).toBe("cancelada");
  });
});

describe("textoReunion", () => {
  it("saluda por nombre, pone el Meet y cierra pidiendo respuesta", () => {
    const t = textoReunion({
      nombre: "María",
      accion: "reprogramada",
      inicio: INICIO,
      meetUrl: "https://meet.google.com/abc-defg-hij",
    });
    expect(t).toContain("Hola María, te escribe Zakumi");
    expect(t).toContain("Enlace de Meet: https://meet.google.com/abc-defg-hij");
    expect(t).toContain("responde a este mensaje");
  });

  it("sin nombre saluda a secas y al cancelar no manda Meet", () => {
    const t = textoReunion({ nombre: null, accion: "cancelada", inicio: null, meetUrl: "https://meet" });
    expect(t.startsWith("Hola, te escribe")).toBe(true);
    expect(t).not.toContain("Meet");
  });
});

describe("variablesReunion", () => {
  it("dos variables, sin saltos de línea, en el orden de la plantilla", () => {
    const v = variablesReunion({
      nombre: "María",
      accion: "agendada",
      inicio: INICIO,
      meetUrl: "https://meet.google.com/abc",
    });
    expect(v).toHaveLength(2);
    expect(v[0]).toMatch(/^agendada para el/);
    expect(v[1]).toBe("Enlace de Meet: https://meet.google.com/abc");
    for (const x of v) expect(x).not.toMatch(/\n/);
  });

  it("sin Meet (o cancelada) la segunda variable es el cierre", () => {
    expect(variablesReunion({ nombre: null, accion: "agendada", inicio: INICIO, meetUrl: null })[1]).toBe(
      "Te confirmamos por acá cualquier cambio.",
    );
    expect(variablesReunion({ nombre: null, accion: "cancelada", inicio: null, meetUrl: "x" })).toEqual([
      "cancelada",
      "Te confirmamos por acá cualquier cambio.",
    ]);
  });
});
