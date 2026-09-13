import { describe, expect, it } from "vitest";
import {
  FOLLETO_MAX_BYTES,
  rutaFolleto,
  rutaFolletoValida,
  validarFolleto,
} from "../plantillas";

describe("validarFolleto", () => {
  it("acepta PNG y JPG de hasta 5 MB", () => {
    expect(validarFolleto("image/png", 514_130)).toBeNull();
    expect(validarFolleto("image/jpeg", FOLLETO_MAX_BYTES)).toBeNull();
  });

  it("rechaza otros tipos, vacíos y los que pasan de 5 MB diciendo cuánto pesan", () => {
    expect(validarFolleto("application/pdf", 1000)).toMatch(/PNG o JPG/);
    expect(validarFolleto("image/png", 0)).toMatch(/vacío/);
    expect(validarFolleto("image/png", 5_385_145)).toMatch(/5,1 MB|5\.1 MB/);
  });
});

describe("rutaFolleto / rutaFolletoValida", () => {
  it("la ruta lleva la carpeta de la plantilla, un nombre nuevo y la extensión del tipo", () => {
    expect(rutaFolleto("generico", "image/jpeg", 1789300000000)).toBe("generico/1789300000000.jpg");
    expect(rutaFolleto("generico", "image/png", 1789300000000)).toBe("generico/1789300000000.png");
  });

  it("lo que produce rutaFolleto pasa la validación; lo demás no", () => {
    expect(rutaFolletoValida("generico", rutaFolleto("generico", "image/jpeg", Date.now()))).toBe(true);
    expect(rutaFolletoValida("generico", "restaurante/1789300000000.jpg")).toBe(false);
    expect(rutaFolletoValida("generico", "generico/../otro/1789300000000.jpg")).toBe(false);
    expect(rutaFolletoValida("generico", "generico/1789300000000.pdf")).toBe(false);
    expect(rutaFolletoValida("generico", "generico/abc.jpg")).toBe(false);
  });
});
