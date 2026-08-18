import { describe, expect, it } from "vitest";
import {
  CICLOS,
  TIPOS_PRODUCTO,
  descripcionVencimiento,
  formatearCOP,
  ordenarPorUrgencia,
  semaforoCobro,
  siguienteFecha,
} from "../cartera";
import type { ProductoConCliente } from "../cartera";

describe("semaforoCobro", () => {
  const hoy = "2026-08-12";

  it("sin fecha programada → sin_programar", () => {
    expect(semaforoCobro(null, hoy)).toBe("sin_programar");
  });

  it("fecha pasada → vencido", () => {
    expect(semaforoCobro("2026-08-11", hoy)).toBe("vencido");
    expect(semaforoCobro("2026-07-01", hoy)).toBe("vencido");
  });

  it("HOY exacto → por_vencer (todavía se puede cobrar a tiempo)", () => {
    expect(semaforoCobro("2026-08-12", hoy)).toBe("por_vencer");
  });

  it("dentro de la ventana de aviso (7 días) → por_vencer", () => {
    expect(semaforoCobro("2026-08-19", hoy)).toBe("por_vencer");
  });

  it("después de la ventana → al_dia", () => {
    expect(semaforoCobro("2026-08-20", hoy)).toBe("al_dia");
    expect(semaforoCobro("2026-12-01", hoy)).toBe("al_dia");
  });

  it("la ventana de aviso es configurable", () => {
    expect(semaforoCobro("2026-08-14", hoy, 1)).toBe("al_dia");
    expect(semaforoCobro("2026-08-13", hoy, 1)).toBe("por_vencer");
  });

  it("cruza fin de mes sin sorpresas (comparación de strings ISO)", () => {
    expect(semaforoCobro("2026-09-01", "2026-08-28")).toBe("por_vencer");
  });
});

describe("siguienteFecha", () => {
  it("mensual: mes siguiente, mismo día", () => {
    expect(siguienteFecha("2026-01-15", "mensual")).toBe("2026-02-15");
  });

  it("mensual con clamp de fin de mes: 31 ene → 28 feb", () => {
    expect(siguienteFecha("2026-01-31", "mensual")).toBe("2026-02-28");
  });

  it("mensual en bisiesto: 31 ene 2028 → 29 feb 2028", () => {
    expect(siguienteFecha("2028-01-31", "mensual")).toBe("2028-02-29");
  });

  it("mensual de diciembre pasa de año", () => {
    expect(siguienteFecha("2026-12-15", "mensual")).toBe("2027-01-15");
  });

  it("anual: año siguiente", () => {
    expect(siguienteFecha("2026-08-12", "anual")).toBe("2027-08-12");
  });

  it("anual desde 29 feb → 28 feb del siguiente", () => {
    expect(siguienteFecha("2028-02-29", "anual")).toBe("2029-02-28");
  });

  it("pago único no se reprograma", () => {
    expect(siguienteFecha("2026-08-12", "unico")).toBeNull();
  });
});

describe("ordenarPorUrgencia", () => {
  const p = (id: string, proxima: string | null): ProductoConCliente =>
    ({
      id,
      proxima_fecha: proxima,
      cliente_id: "c",
      tipo: "bot",
      nombre: id,
      instancia_id: null,
      dominio: null,
      tarifa: 100000,
      moneda: "COP",
      ciclo: "mensual",
      activo: true,
      created_at: "",
      updated_at: "",
      clientes: { id: "c", nombre: "Cliente" },
    }) as ProductoConCliente;

  it("vencidos primero (el más viejo de primeras), sin_programar al final", () => {
    const orden = ordenarPorUrgencia([
      p("al-dia", "2026-12-01"),
      p("sin-fecha", null),
      p("vencido-viejo", "2026-06-01"),
      p("por-vencer", "2026-08-14"),
      p("vencido-reciente", "2026-08-10"),
    ]).map((x) => x.id);
    expect(orden).toEqual([
      "vencido-viejo",
      "vencido-reciente",
      "por-vencer",
      "al-dia",
      "sin-fecha",
    ]);
  });
});

describe("descripcionVencimiento", () => {
  const hoy = "2026-08-12";
  it("describe en español claro", () => {
    expect(descripcionVencimiento("2026-08-12", hoy)).toBe("hoy");
    expect(descripcionVencimiento("2026-08-13", hoy)).toBe("mañana");
    expect(descripcionVencimiento("2026-08-19", hoy)).toBe("en 7 días");
    expect(descripcionVencimiento("2026-08-11", hoy)).toBe("venció ayer");
    expect(descripcionVencimiento("2026-08-01", hoy)).toBe("venció hace 11 días");
    expect(descripcionVencimiento(null, hoy)).toBe("sin programar");
  });
});

describe("formatearCOP", () => {
  it("pesos sin decimales con separador es-CO", () => {
    expect(formatearCOP(129900)).toMatch(/129\.900/);
    expect(formatearCOP(129900)).not.toMatch(/,00/);
  });
});

describe("constantes y regla editorial", () => {
  it("los 6 tipos de producto y los 3 ciclos tienen label es-CO", () => {
    expect(TIPOS_PRODUCTO.map((t) => t.valor)).toEqual([
      "bot", "web", "crm", "voz", "mantenimiento", "otro",
    ]);
    expect(CICLOS.map((c) => c.valor)).toEqual(["mensual", "anual", "unico"]);
    for (const x of [...TIPOS_PRODUCTO, ...CICLOS]) {
      expect(x.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("REGLA: ningún copy contiene la palabra 'stack'", () => {
    const copys = [...TIPOS_PRODUCTO, ...CICLOS].map((x) => x.label).join(" ");
    expect(copys).not.toMatch(/\bstack\b/i);
  });
});
