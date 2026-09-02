import { describe, expect, it } from "vitest";
import { agruparPorDia, type Cita360 } from "../consultas";

// 2026-09-01T15:00Z = martes 1 sep, 10:00 en Bogotá.
const AHORA = new Date("2026-09-01T15:00:00Z");

function cita(inicio: string, id = inicio): Cita360 {
  return {
    id,
    solicitudId: id,
    inicio,
    fin: inicio,
    nombre: "María",
    telefono: "+57300",
    servicio: "Bot de WhatsApp",
    detalle: null,
    meetUrl: null,
    linkGoogle: null,
    origen: "voz",
    estado: "nueva",
  };
}

describe("agruparPorDia", () => {
  it("separa hoy, mañana, esta semana y después", () => {
    const g = agruparPorDia(
      [
        cita("2026-09-01T21:00:00Z", "hoy"),      // hoy 16:00 Bogotá
        cita("2026-09-02T15:00:00Z", "manana"),   // mañana
        cita("2026-09-04T15:00:00Z", "semana"),   // viernes
        cita("2026-09-20T15:00:00Z", "despues"),
      ],
      AHORA,
    );
    expect(g.map((x) => x.titulo)).toEqual(["Hoy", "Mañana", "Esta semana", "Después"]);
    expect(g[0].citas[0].id).toBe("hoy");
    expect(g[3].citas[0].id).toBe("despues");
  });

  it("no devuelve grupos vacíos", () => {
    const g = agruparPorDia([cita("2026-09-20T15:00:00Z")], AHORA);
    expect(g).toHaveLength(1);
    expect(g[0].titulo).toBe("Después");
  });

  it("ordena por hora dentro del día", () => {
    const g = agruparPorDia(
      [cita("2026-09-01T22:00:00Z", "tarde"), cita("2026-09-01T20:00:00Z", "antes")],
      AHORA,
    );
    expect(g[0].citas.map((c) => c.id)).toEqual(["antes", "tarde"]);
  });

  it("una cita que ya pasó hoy sigue contando como de hoy", () => {
    const g = agruparPorDia([cita("2026-09-01T13:00:00Z", "temprano")], AHORA);
    expect(g[0].titulo).toBe("Hoy");
  });

  it("sin citas, sin grupos", () => {
    expect(agruparPorDia([], AHORA)).toEqual([]);
  });

  it("una cita de ayer no aparece en la agenda", () => {
    // 2026-08-31T19:00Z = ayer a las 14:00 en Bogotá
    const g = agruparPorDia([cita("2026-08-31T19:00:00Z", "ayer")], AHORA);
    expect(g).toHaveLength(0);
  });

  it("una cita de hoy muy temprano sigue siendo de hoy", () => {
    // 2026-09-01T12:00Z = hoy a las 07:00 en Bogotá (consultado a las 10:00)
    const g = agruparPorDia([cita("2026-09-01T12:00:00Z", "temprano")], AHORA);
    expect(g).toHaveLength(1);
    expect(g[0].titulo).toBe("Hoy");
    expect(g[0].citas[0].id).toBe("temprano");
  });
});
