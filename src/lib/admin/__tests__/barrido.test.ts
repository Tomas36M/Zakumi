import { describe, expect, it } from "vitest";
import {
  cajaDe,
  celdaTocaPoligono,
  claveTesela,
  claveTrabajo,
  esSaturada,
  estimarBarrido,
  puntoEnPoligono,
  subdividir,
  teselar,
  PRECIO_POR_LLAMADA_USD,
  RADIO_BASE,
  type Punto,
} from "../barrido";

// Cuadrado de ~2.2 km de lado sobre Madrid, Cundinamarca.
const CUADRADO: Punto[] = [
  { lat: 4.72, lng: -74.28 },
  { lat: 4.72, lng: -74.26 },
  { lat: 4.74, lng: -74.26 },
  { lat: 4.74, lng: -74.28 },
];

// Una "L" cóncava: sirve para probar que el ray casting no se cree convexo.
const ELE: Punto[] = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 4 },
  { lat: 2, lng: 4 },
  { lat: 2, lng: 2 },
  { lat: 4, lng: 2 },
  { lat: 4, lng: 0 },
];

describe("puntoEnPoligono", () => {
  it("dice que sí para un punto claramente adentro", () => {
    expect(puntoEnPoligono({ lat: 4.73, lng: -74.27 }, CUADRADO)).toBe(true);
  });

  it("dice que no para un punto claramente afuera", () => {
    expect(puntoEnPoligono({ lat: 4.75, lng: -74.27 }, CUADRADO)).toBe(false);
  });

  it("respeta la concavidad: el hueco de una L queda afuera", () => {
    expect(puntoEnPoligono({ lat: 1, lng: 1 }, ELE)).toBe(true);
    expect(puntoEnPoligono({ lat: 3, lng: 3 }, ELE)).toBe(false);
  });

  it("no explota con un punto exactamente sobre un vértice", () => {
    // El ray casting no define el borde; solo exigimos que no lance.
    expect(typeof puntoEnPoligono({ lat: 4.72, lng: -74.28 }, CUADRADO)).toBe(
      "boolean",
    );
  });
});

describe("cajaDe", () => {
  it("saca la caja envolvente del polígono", () => {
    expect(cajaDe(CUADRADO)).toEqual({
      sur: 4.72,
      norte: 4.74,
      oeste: -74.28,
      este: -74.26,
    });
  });
});

describe("teselar", () => {
  it("cubre el polígono sin huecos: todo punto interior cae en alguna tesela", () => {
    const teselas = teselar(CUADRADO);
    const muestras: Punto[] = [];
    for (let i = 1; i < 10; i++) {
      for (let j = 1; j < 10; j++) {
        muestras.push({
          lat: 4.72 + (0.02 * i) / 10,
          lng: -74.28 + (0.02 * j) / 10,
        });
      }
    }
    for (const p of muestras) {
      const cubierto = teselas.some((t) => distanciaM(t.centro, p) <= t.radio);
      expect(cubierto, `sin cubrir: ${p.lat},${p.lng}`).toBe(true);
    }
  });

  it("descarta las celdas que no tocan el polígono", () => {
    // Franja delgada en diagonal: su caja envolvente es enorme comparada
    // con el área real, así que teselar debe botar la mayoría de celdas.
    const franja: Punto[] = [
      { lat: 4.72, lng: -74.28 },
      { lat: 4.7205, lng: -74.28 },
      { lat: 4.74, lng: -74.26 },
      { lat: 4.7395, lng: -74.26 },
    ];
    const conRecorte = teselar(franja).length;
    const caja = cajaDe(franja);
    const sinRecorte = teselar([
      { lat: caja.sur, lng: caja.oeste },
      { lat: caja.sur, lng: caja.este },
      { lat: caja.norte, lng: caja.este },
      { lat: caja.norte, lng: caja.oeste },
    ]).length;
    // Una diagonal cruza ~7 de las 16 celdas de la caja: el umbral prueba
    // que el recorte muerde de verdad sin atarse a un conteo exacto.
    expect(conRecorte).toBeLessThan(sinRecorte * 0.75);
  });

  it("un polígono degenerado no explota ni devuelve vacío", () => {
    const punto: Punto[] = [
      { lat: 4.73, lng: -74.27 },
      { lat: 4.73, lng: -74.27 },
      { lat: 4.73, lng: -74.27 },
    ];
    expect(teselar(punto).length).toBeGreaterThanOrEqual(1);
  });

  it("usa el radio base por defecto", () => {
    expect(teselar(CUADRADO)[0].radio).toBe(RADIO_BASE);
  });
});

describe("subdividir", () => {
  it("parte una tesela en 4 de la mitad del radio", () => {
    const t = { centro: { lat: 4.73, lng: -74.27 }, radio: 400, clave: "x" };
    const hijas = subdividir(t);
    expect(hijas).toHaveLength(4);
    expect(hijas.every((h) => h.radio === 200)).toBe(true);
    expect(new Set(hijas.map((h) => h.clave)).size).toBe(4);
  });

  it("las hijas cubren el cuadrado de la madre", () => {
    const t = { centro: { lat: 4.73, lng: -74.27 }, radio: 400, clave: "x" };
    const hijas = subdividir(t);
    // El centro de la madre queda cubierto por alguna hija.
    expect(hijas.some((h) => distanciaM(h.centro, t.centro) <= h.radio)).toBe(true);
  });
});

describe("estimarBarrido", () => {
  it("multiplica teselas por verticales y aplica el precio verificado", () => {
    const e = estimarBarrido(31, 10);
    expect(e.llamadas).toBe(310);
    expect(e.costoUsd).toBeCloseTo(310 * PRECIO_POR_LLAMADA_USD, 5);
    expect(e.llamadasMax).toBeGreaterThan(e.llamadas);
    expect(e.costoMaxUsd).toBeGreaterThan(e.costoUsd);
  });

  it("sin verticales no hay llamadas", () => {
    expect(estimarBarrido(31, 0).llamadas).toBe(0);
  });
});

describe("esSaturada", () => {
  it("20 resultados es el techo de Nearby Search: hay negocios sin ver", () => {
    expect(esSaturada(20)).toBe(true);
  });

  it("19 no está saturada", () => {
    expect(esSaturada(19)).toBe(false);
  });
});

describe("claveTesela / claveTrabajo", () => {
  it("la clave es estable para el mismo centro y radio", () => {
    const c = { lat: 4.73, lng: -74.27 };
    expect(claveTesela(c, 400)).toBe(claveTesela({ ...c }, 400));
  });

  it("distinto radio, distinta clave", () => {
    const c = { lat: 4.73, lng: -74.27 };
    expect(claveTesela(c, 400)).not.toBe(claveTesela(c, 200));
  });

  it("el trabajo distingue la vertical: la misma tesela se barre una vez por vertical", () => {
    const t = { centro: { lat: 4.73, lng: -74.27 }, radio: 400, clave: "x" };
    expect(claveTrabajo(t, "ferreteria")).not.toBe(claveTrabajo(t, "panaderia"));
  });
});

describe("celdaTocaPoligono", () => {
  it("una celda dentro del polígono toca", () => {
    expect(celdaTocaPoligono({ lat: 4.73, lng: -74.27 }, 0.002, 0.002, CUADRADO)).toBe(
      true,
    );
  });

  it("una celda lejos del polígono no toca", () => {
    expect(celdaTocaPoligono({ lat: 5.5, lng: -73.5 }, 0.002, 0.002, CUADRADO)).toBe(
      false,
    );
  });

  it("una celda que el borde cruza sin meter vértices adentro sí toca", () => {
    // Celda centrada justo sobre el borde norte del cuadrado.
    expect(celdaTocaPoligono({ lat: 4.74, lng: -74.27 }, 0.002, 0.002, CUADRADO)).toBe(
      true,
    );
  });
});

/** Haversine, solo para las aserciones de cobertura del test. */
function distanciaM(a: Punto, b: Punto): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
