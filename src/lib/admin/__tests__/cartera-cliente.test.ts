import { describe, expect, it } from "vitest";
import { mrrDeProductos, resumenCliente, type ProductoContratado } from "../cartera";

function producto(extra: Partial<ProductoContratado>): ProductoContratado {
  return {
    id: "p1",
    cliente_id: "c1",
    tipo: "bot",
    nombre: "Bot",
    instancia_id: null,
    dominio: null,
    tarifa: 150_000,
    moneda: "COP",
    ciclo: "mensual",
    proxima_fecha: "2026-09-20",
    activo: true,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...extra,
  };
}

const HOY = "2026-09-13";

describe("mrrDeProductos", () => {
  it("suma mensuales, prorratea anuales y no cuenta únicos ni inactivos", () => {
    expect(
      mrrDeProductos([
        producto({ id: "a", tarifa: 150_000 }),
        producto({ id: "b", tarifa: 1_200_000, ciclo: "anual" }),
        producto({ id: "c", tarifa: 300_000, ciclo: "unico" }),
        producto({ id: "d", tarifa: 999_999, activo: false }),
      ]),
    ).toBe(250_000);
  });
});

describe("resumenCliente", () => {
  it("sin productos: cero de todo y sin programar", () => {
    expect(resumenCliente([], HOY)).toEqual({
      activos: 0,
      mrr: 0,
      proximaFecha: null,
      semaforo: "sin_programar",
    });
  });

  it("solo pagos únicos: MRR cero, pero la fecha programada cuenta", () => {
    const r = resumenCliente([producto({ ciclo: "unico", proxima_fecha: "2026-09-15" })], HOY);
    expect(r.mrr).toBe(0);
    expect(r.activos).toBe(1);
    expect(r.proximaFecha).toBe("2026-09-15");
    expect(r.semaforo).toBe("por_vencer");
  });

  it("la próxima fecha es la mínima entre los ACTIVOS; los inactivos no cuentan", () => {
    const r = resumenCliente(
      [
        producto({ id: "a", proxima_fecha: "2026-10-01" }),
        producto({ id: "b", proxima_fecha: "2026-09-25" }),
        producto({ id: "c", proxima_fecha: "2026-09-01", activo: false }),
      ],
      HOY,
    );
    expect(r.activos).toBe(2);
    expect(r.proximaFecha).toBe("2026-09-25");
    expect(r.semaforo).toBe("al_dia");
  });

  it("un cobro pasado pone el semáforo en vencido", () => {
    expect(resumenCliente([producto({ proxima_fecha: "2026-09-01" })], HOY).semaforo).toBe("vencido");
  });
});
