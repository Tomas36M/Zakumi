import { describe, expect, it } from "vitest";
import { presupuestoDeEmisiones } from "../presupuesto-barrido";

describe("presupuestoDeEmisiones", () => {
  it("concede exactamente el límite y ni una más", () => {
    const p = presupuestoDeEmisiones(3);
    expect(p.emitir()).toBe(true);
    expect(p.emitir()).toBe(true);
    expect(p.emitir()).toBe(true);
    expect(p.agotado()).toBe(true);
    expect(p.emitir()).toBe(false);
    expect(p.emitidas()).toBe(3);
  });

  it("no está agotado mientras quede una", () => {
    const p = presupuestoDeEmisiones(2);
    p.emitir();
    expect(p.agotado()).toBe(false);
  });

  it("sin límite nunca se agota", () => {
    const p = presupuestoDeEmisiones(undefined);
    for (let i = 0; i < 10_000; i++) expect(p.emitir()).toBe(true);
    expect(p.agotado()).toBe(false);
  });

  it("cero, negativo o basura no conceden nada: en plata, la duda frena", () => {
    for (const limite of [0, -5, Number.NaN]) {
      const p = presupuestoDeEmisiones(limite);
      expect(p.agotado()).toBe(true);
      expect(p.emitir()).toBe(false);
    }
  });

  it("un límite con decimales se redondea hacia abajo", () => {
    const p = presupuestoDeEmisiones(2.9);
    expect(p.emitir()).toBe(true);
    expect(p.emitir()).toBe(true);
    expect(p.emitir()).toBe(false);
  });

  it("una emisión negada no cuenta", () => {
    const p = presupuestoDeEmisiones(1);
    p.emitir();
    p.emitir();
    expect(p.emitidas()).toBe(1);
  });
});
