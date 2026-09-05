import { describe, expect, it } from "vitest";
import {
  CUOTA_GRATIS_MENSUAL,
  continuacionPideMonto,
  estadoDeCuota,
  llamadasCobradas,
  pagadasAprobadas,
  permisoDeBarrido,
  restanteDeCuota,
} from "../barrido";

describe("restanteDeCuota", () => {
  it("sin consumo, queda la cuota entera", () => {
    expect(restanteDeCuota(0)).toBe(CUOTA_GRATIS_MENSUAL);
  });

  it("descuenta lo consumido", () => {
    expect(restanteDeCuota(300)).toBe(CUOTA_GRATIS_MENSUAL - 300);
  });

  it("nunca devuelve negativo: pasarse de la cuota deja cero, no deuda", () => {
    expect(restanteDeCuota(CUOTA_GRATIS_MENSUAL + 500)).toBe(0);
  });

  it("justo en el tope deja cero", () => {
    expect(restanteDeCuota(CUOTA_GRATIS_MENSUAL)).toBe(0);
  });
});

describe("estadoDeCuota", () => {
  it("no está agotada mientras quede una", () => {
    expect(estadoDeCuota(CUOTA_GRATIS_MENSUAL - 1)).toEqual({
      consumidas: CUOTA_GRATIS_MENSUAL - 1,
      restantes: 1,
      agotada: false,
    });
  });

  it("agotada exactamente en el tope", () => {
    expect(estadoDeCuota(CUOTA_GRATIS_MENSUAL).agotada).toBe(true);
  });

  it("un consumo negativo o basura se trata como cero, no rompe la pantalla", () => {
    expect(estadoDeCuota(-5).restantes).toBe(CUOTA_GRATIS_MENSUAL);
    expect(estadoDeCuota(Number.NaN).restantes).toBe(CUOTA_GRATIS_MENSUAL);
  });
});

describe("llamadasCobradas", () => {
  it("lo que cabe en lo gratis no se cobra", () => {
    expect(llamadasCobradas(300, 700)).toBe(0);
  });

  it("cobra solo lo que se pasa de la línea", () => {
    expect(llamadasCobradas(1_000, 300)).toBe(700);
  });

  it("sin nada gratis se cobra todo", () => {
    expect(llamadasCobradas(500, 0)).toBe(500);
  });

  it("justo en la línea todavía no cobra nada", () => {
    expect(llamadasCobradas(700, 700)).toBe(0);
  });

  it("basura o negativos no producen cobros fantasma", () => {
    expect(llamadasCobradas(Number.NaN, 100)).toBe(0);
    expect(llamadasCobradas(-5, 100)).toBe(0);
    expect(llamadasCobradas(50, Number.NaN)).toBe(50);
    expect(llamadasCobradas(50, -100)).toBe(50);
  });
});

describe("permisoDeBarrido", () => {
  it("la tanda que cabe entera en la cuota: el techo es la línea del gratis", () => {
    // Sin esto la subdivisión llegaba a 1.400 emitidas —400 facturadas— por una
    // tanda que el diálogo había juzgado gratis y no había pedido confirmar.
    expect(permisoDeBarrido(700, 1_000)).toEqual({
      llamadas: 700,
      gratis: 1_000,
      tope: 1_000,
    });
  });

  it("la tanda que se paga entera: el margen del 2× de siempre", () => {
    expect(permisoDeBarrido(500, 0)).toEqual({ llamadas: 500, gratis: 0, tope: 1_000 });
  });

  it("la frontera 699/700: el margen es del gasto aprobado, no de la tanda", () => {
    // El usuario escribe US$ 0,04 (una consulta de pago). Un techo de 1.400
    // habría autorizado ~701 pagadas ≈ US$ 24,54 con esa confirmación de
    // cuatro centavos.
    expect(permisoDeBarrido(700, 699)).toEqual({
      llamadas: 700,
      gratis: 699,
      tope: 701,
    });
  });

  it("sin dato del consumo del mes se trata todo como pagado", () => {
    expect(permisoDeBarrido(700, null)).toEqual({ llamadas: 700, gratis: 0, tope: 1_400 });
  });

  it("el techo nunca queda por debajo de lo aprobado", () => {
    for (const [llamadas, restantes] of [
      [700, 699],
      [700, 1_000],
      [500, 0],
      [1, 0],
    ] as const) {
      expect(permisoDeBarrido(llamadas, restantes).tope).toBeGreaterThanOrEqual(llamadas);
    }
  });

  it("basura en cualquiera de los dos lados no concede permiso de más", () => {
    expect(permisoDeBarrido(Number.NaN, 100)).toEqual({
      llamadas: 0,
      gratis: 100,
      tope: 100,
    });
    expect(permisoDeBarrido(300, Number.NaN)).toEqual({
      llamadas: 300,
      gratis: 0,
      tope: 600,
    });
  });
});

describe("pagadasAprobadas", () => {
  it("es lo que el usuario NOMBRÓ al confirmar: las llamadas de pago de la tanda, sin el margen", () => {
    // 500 de pago con techo 1.000: aprobó 500 (US$ 17,50), no 1.000.
    expect(pagadasAprobadas(permisoDeBarrido(500, 0))).toBe(500);
  });

  it("una tanda que cabe en lo gratis no aprobó ningún pago", () => {
    expect(pagadasAprobadas(permisoDeBarrido(700, 1_000))).toBe(0);
  });

  it("en el mixto es solo lo que se pasa de la línea", () => {
    expect(pagadasAprobadas(permisoDeBarrido(700, 699))).toBe(1);
  });
});

describe("continuacionPideMonto", () => {
  // Al frenarse un barrido, TODO lo que sigue se paga: el tramo de la
  // continuación es una tanda de pago sobre lo que queda en la cola
  // (`permisoDeBarrido(faltan, 0)`), y se compara contra lo que el usuario
  // lleva confirmado con el monto escrito.
  it("el barrido que arrancó gratis pide monto: no ha confirmado ni un peso", () => {
    expect(continuacionPideMonto(permisoDeBarrido(300, 0), 0)).toBe(true);
  });

  it("un tramo que no supera lo confirmado sigue con un clic (la exención de la spec)", () => {
    // Confirmó 500 de pago; quedan 400 en la cola.
    expect(continuacionPideMonto(permisoDeBarrido(400, 0), 500)).toBe(false);
  });

  it("igual a lo confirmado tampoco pide", () => {
    expect(continuacionPideMonto(permisoDeBarrido(500, 0), 500)).toBe(false);
  });

  it("un tramo mayor que lo confirmado pide monto aunque ya se haya tecleado antes", () => {
    // El margen del 2× NO cuenta como confirmado: aprobó 500, el tramo de 800 se teclea.
    expect(continuacionPideMonto(permisoDeBarrido(800, 0), 500)).toBe(true);
  });

  it("el mixto: US$ 0,04 escritos no confirman los 698 que quedan", () => {
    const inicial = permisoDeBarrido(700, 699);
    expect(continuacionPideMonto(permisoDeBarrido(698, 0), pagadasAprobadas(inicial))).toBe(true);
  });

  it("basura en lo confirmado se trata como cero", () => {
    expect(continuacionPideMonto(permisoDeBarrido(1, 0), Number.NaN)).toBe(true);
    expect(continuacionPideMonto(permisoDeBarrido(1, 0), -3)).toBe(true);
  });
});
