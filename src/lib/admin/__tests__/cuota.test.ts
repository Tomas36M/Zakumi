import { describe, expect, it } from "vitest";
import {
  CUOTA_GRATIS_MENSUAL,
  continuacionPideMonto,
  estadoDeCuota,
  llamadasCobradas,
  pagadasConfirmadas,
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

describe("continuacionPideMonto", () => {
  // Los tres caminos que llegan a la pausa, con la cuota mensual de 1.000.
  const gratisEntero = permisoDeBarrido(700, 1_000); // tope 1.000, 0 de pago
  const pagoEntero = permisoDeBarrido(500, 0); // tope 1.000, 1.000 de pago
  const mixto = permisoDeBarrido(700, 699); // tope 701, 2 de pago

  it("el barrido que arrancó gratis pide monto: no ha confirmado ni un peso", () => {
    expect(pagadasConfirmadas(gratisEntero, 1)).toBe(0);
    expect(continuacionPideMonto(gratisEntero, 1)).toBe(true);
  });

  it("el barrido que arrancó pagando NO pide monto: el tramo es lo ya autorizado", () => {
    // La exención de la spec, intacta: un peaje en cada tramo se vuelve
    // memoria muscular y deja de proteger.
    expect(pagadasConfirmadas(pagoEntero, 1)).toBe(1_000);
    expect(continuacionPideMonto(pagoEntero, 1)).toBe(false);
  });

  it("el mixto pide monto: US$ 0,04 escritos no confirman US$ 24,54", () => {
    expect(pagadasConfirmadas(mixto, 1)).toBe(2);
    expect(continuacionPideMonto(mixto, 1)).toBe(true);
  });

  it("igualdad exacta entre lo concedido y lo confirmado: no pide monto", () => {
    // pagoEntero concede 1.000 de pago y lleva 1.000 confirmadas.
    expect(pagadasConfirmadas(pagoEntero, 1)).toBe(pagoEntero.tope);
    expect(continuacionPideMonto(pagoEntero, 1)).toBe(false);
  });

  it("lo confirmado se acumula: tras teclear un monto no se cobra peaje por otro igual", () => {
    // El barrido gratis paga peaje una vez; su segundo tramo ya no.
    expect(continuacionPideMonto(gratisEntero, 2)).toBe(false);
    expect(pagadasConfirmadas(gratisEntero, 2)).toBe(1_000);
    // El mixto igual: 2 + 701 confirmadas contra 701 del tramo siguiente.
    expect(continuacionPideMonto(mixto, 2)).toBe(false);
    expect(pagadasConfirmadas(mixto, 2)).toBe(703);
  });

  it("un contador de permisos absurdo no regala la exención", () => {
    expect(continuacionPideMonto(gratisEntero, 0)).toBe(true);
    expect(continuacionPideMonto(gratisEntero, Number.NaN)).toBe(true);
  });
});
