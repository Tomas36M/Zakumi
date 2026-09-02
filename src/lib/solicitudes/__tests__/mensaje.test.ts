import { describe, expect, it } from "vitest";
import { construirAviso, type DatosAviso } from "../mensaje";

const BASE: DatosAviso = {
  origen: "voz",
  nombre: "María Pérez",
  telefono: "+573001112233",
  servicio: "Bot de WhatsApp",
  detalle: "Quiere un bot para su restaurante, 3 sedes",
  mejorHorario: null,
  cita: null,
  citaTextoCrudo: null,
  meetUrl: null,
  choque: false,
  urlPanel: "https://zakumistudio.com/admin/solicitudes",
};

describe("construirAviso", () => {
  it("arma el aviso base con contacto, servicio y detalle", () => {
    const t = construirAviso(BASE);
    expect(t).toContain("Nueva solicitud — llamada de voz");
    expect(t).toContain("María Pérez · +573001112233");
    expect(t).toContain("Servicio: Bot de WhatsApp");
    expect(t).toContain("Quiere un bot para su restaurante, 3 sedes");
    expect(t).toContain("https://zakumistudio.com/admin/solicitudes");
  });

  it("dice el canal correcto para WhatsApp", () => {
    expect(construirAviso({ ...BASE, origen: "whatsapp" })).toContain(
      "Nueva solicitud — conversación de WhatsApp",
    );
  });

  it("muestra la cita en hora de Bogotá con el link de Meet", () => {
    const t = construirAviso({
      ...BASE,
      cita: { inicio: "2026-09-03T15:00:00.000Z", fin: "2026-09-03T15:30:00.000Z" },
      meetUrl: "https://meet.google.com/abc-defg-hij",
    });
    // 15:00Z = 10:00 en Bogotá
    expect(t).toMatch(/10:00/);
    expect(t).toContain("septiembre");
    expect(t).toContain("https://meet.google.com/abc-defg-hij");
  });

  it("marca el choque de horario sin esconder la cita", () => {
    const t = construirAviso({
      ...BASE,
      cita: { inicio: "2026-09-03T15:00:00.000Z", fin: "2026-09-03T15:30:00.000Z" },
      choque: true,
    });
    expect(t).toContain("⚠️");
    expect(t).toMatch(/10:00/);
  });

  it("pide poner la hora a mano cuando la fecha no se pudo entender", () => {
    const t = construirAviso({ ...BASE, citaTextoCrudo: "el jueves por la tarde" });
    expect(t).toContain("el jueves por la tarde");
    expect(t).toContain("ponle hora tú");
    expect(t).not.toContain("meet.google.com");
  });

  it("no deja líneas de campos vacíos", () => {
    const t = construirAviso({
      ...BASE,
      nombre: null,
      servicio: null,
      detalle: null,
    });
    expect(t).toContain("+573001112233");
    expect(t).not.toContain("Servicio:");
    expect(t).not.toContain("null");
    expect(t).not.toMatch(/\n\n\n/);
  });
});
