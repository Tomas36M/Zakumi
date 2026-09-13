import { describe, expect, it } from "vitest";
import { validarCambiosSolicitud } from "../solicitudes";

const DE_VOZ = { user_id: null, producto_id: null };
const DEL_PORTAL = { user_id: "u1", producto_id: null };

describe("validarCambiosSolicitud", () => {
  it("sin cambios devuelve una fila vacía", () => {
    expect(validarCambiosSolicitud({}, DE_VOZ)).toEqual({ fila: {} });
  });

  it("recorta y limpia el nombre y el mensaje; vacío es null", () => {
    expect(
      validarCambiosSolicitud({ contacto_nombre: "  María  ", mensaje: "   " }, DE_VOZ),
    ).toEqual({ fila: { contacto_nombre: "María", mensaje: null } });
  });

  it("normaliza el teléfono a E.164", () => {
    expect(validarCambiosSolicitud({ contacto_telefono: "310 123 4567" }, DE_VOZ)).toEqual({
      fila: { contacto_telefono: "+573101234567" },
    });
  });

  it("un teléfono ilegible se rechaza", () => {
    expect(validarCambiosSolicitud({ contacto_telefono: "abc" }, DE_VOZ)).toMatchObject({
      error: expect.stringMatching(/teléfono/),
    });
  });

  it("una solicitud sin cuenta no puede quedarse sin teléfono; una del portal sí", () => {
    expect(validarCambiosSolicitud({ contacto_telefono: "" }, DE_VOZ)).toMatchObject({
      error: expect.stringMatching(/necesita teléfono/),
    });
    expect(validarCambiosSolicitud({ contacto_telefono: "" }, DEL_PORTAL)).toEqual({
      fila: { contacto_telefono: null },
    });
  });

  it("el correo necesita arroba", () => {
    expect(validarCambiosSolicitud({ contacto_email: "sin-arroba" }, DE_VOZ)).toMatchObject({
      error: expect.stringMatching(/correo/),
    });
    expect(validarCambiosSolicitud({ contacto_email: " a@b.co " }, DE_VOZ)).toEqual({
      fila: { contacto_email: "a@b.co" },
    });
  });

  it("el servicio tiene que existir en el catálogo («por definir» vale)", () => {
    expect(validarCambiosSolicitud({ servicio_slug: "no-existe" }, DE_VOZ)).toMatchObject({
      error: expect.stringMatching(/catálogo/),
    });
    expect(validarCambiosSolicitud({ servicio_slug: "por-definir" }, DE_VOZ)).toEqual({
      fila: { servicio_slug: "por-definir" },
    });
  });

  it("con producto contratado el servicio no se cambia", () => {
    expect(
      validarCambiosSolicitud({ servicio_slug: "por-definir" }, { user_id: null, producto_id: "p1" }),
    ).toMatchObject({ error: expect.stringMatching(/producto contratado/) });
  });
});
