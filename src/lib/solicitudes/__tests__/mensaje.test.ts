import { describe, expect, it } from "vitest";
import {
  construirAviso,
  PLANTILLA_AVISO_RESCATE,
  PLANTILLA_AVISO_SOLICITUD,
  variablesAviso,
  variablesAvisoRescate,
  type DatosAviso,
} from "../mensaje";

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

describe("variablesAviso (plantilla aviso_solicitud)", () => {
  it("son exactamente las 4 del cuerpo aprobado en Meta: canal, contacto, servicio, detalle", () => {
    expect(PLANTILLA_AVISO_SOLICITUD).toBe("aviso_solicitud");
    const v = variablesAviso(BASE);
    expect(v).toHaveLength(4);
    expect(v[0]).toBe("llamada de voz");
    expect(v[1]).toBe("María Pérez · +573001112233");
    expect(v[2]).toBe("Bot de WhatsApp");
    expect(v[3]).toContain("Quiere un bot para su restaurante, 3 sedes");
  });

  it("con cita, el detalle lleva la fecha en Bogotá y el Meet, y conserva lo que pidió", () => {
    const v = variablesAviso({
      ...BASE,
      cita: { inicio: "2026-09-03T15:00:00.000Z", fin: "2026-09-03T15:30:00.000Z" },
      meetUrl: "https://meet.google.com/abc-defg-hij",
      choque: true,
    });
    expect(v[3]).toMatch(/10:00/);
    expect(v[3]).toContain("https://meet.google.com/abc-defg-hij");
    expect(v[3]).toContain("choca");
    expect(v[3]).toContain("3 sedes");
  });

  it("sin servicio ni detalle dice algo, nunca deja el hueco vacío", () => {
    const v = variablesAviso({ ...BASE, servicio: null, detalle: null, nombre: null, telefono: null });
    expect(v[1]).toBe("sin datos de contacto");
    expect(v[2]).toBe("por definir");
    expect(v[3]).toBe("sin más detalle");
  });

  it("la fecha sin parsear y el mejor horario también caben en el detalle", () => {
    const v = variablesAviso({ ...BASE, detalle: null, citaTextoCrudo: "el jueves en la tarde", mejorHorario: "mañanas" });
    expect(v[3]).toContain("el jueves en la tarde");
    expect(v[3]).toContain("mañanas");
  });
});

describe("variablesAvisoRescate (plantilla aviso_prospecto_perdido)", () => {
  it("son las 3 del cuerpo aprobado: canal, motivo, datos", () => {
    expect(PLANTILLA_AVISO_RESCATE).toBe("aviso_prospecto_perdido");
    const v = variablesAvisoRescate({
      origen: "whatsapp",
      motivo: "db",
      nombre: "Rodolfo",
      telefono: "+573001112233",
      detalle: "quería hablar con Olga",
    });
    expect(v).toEqual([
      "conversación de WhatsApp",
      "la base de datos no lo guardó",
      "Rodolfo · +573001112233 · «quería hablar con Olga»",
    ]);
  });

  it("sin nada capturado lo dice en vez de mandar vacío", () => {
    const v = variablesAvisoRescate({ origen: "voz", motivo: "sin_contacto", nombre: null, telefono: null, detalle: null });
    expect(v[2]).toBe("sin datos de contacto");
  });
});
