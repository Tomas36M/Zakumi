import { describe, expect, it } from "vitest";
import { plural } from "../caras";
import { carasProspeccion } from "../prospeccion-caras";
import { carasZak } from "../zak-caras";

describe("plural", () => {
  it("elige singular solo para 1", () => {
    expect(plural(0, "lead", "leads")).toBe("0 leads");
    expect(plural(1, "lead", "leads")).toBe("1 lead");
    expect(plural(2, "lead", "leads")).toBe("2 leads");
  });
});

/** Una cifra exacta de la base (no un piso). */
const exacta = (n: number) => ({ n, mas: false });

describe("carasProspeccion", () => {
  it("siempre son las dos caras, en ese orden", () => {
    const caras = carasProspeccion({
      territorios: 2,
      leads: exacta(75),
      sinWeb: exacta(40),
      barriendo: false,
    });
    expect(caras.map((c) => c.id)).toEqual(["territorio", "leads"]);
  });

  it("los contadores respetan el singular", () => {
    const [territorio, leads] = carasProspeccion({
      territorios: 1,
      leads: exacta(1),
      sinWeb: exacta(0),
      barriendo: false,
    });
    expect(territorio.detalle).toBe("1 territorio · 1 lead");
    expect(leads.detalle).toBe("1 lead · 0 sin web");
  });

  it("solo con barrido abierto la cara de Territorio lleva punto, y late", () => {
    const sin = carasProspeccion({
      territorios: 2,
      leads: exacta(5),
      sinWeb: exacta(1),
      barriendo: false,
    });
    expect(sin[0].punto).toBeNull();
    expect(sin[1].punto).toBeNull();

    const con = carasProspeccion({
      territorios: 2,
      leads: exacta(5),
      sinWeb: exacta(1),
      barriendo: true,
    });
    expect(con[0].punto?.pulsa).toBe(true);
    expect(con[1].punto).toBeNull();
  });
});

describe("carasZak", () => {
  it("siempre son chat y voz, en ese orden", () => {
    expect(carasZak({ vozPendiente: false }).map((c) => c.id)).toEqual(["chat", "voz"]);
  });

  it("la voz lleva un punto fijo solo cuando falta configurarla", () => {
    expect(carasZak({ vozPendiente: false })[1].punto).toBeNull();
    const punto = carasZak({ vozPendiente: true })[1].punto;
    expect(punto).not.toBeNull();
    expect(punto?.pulsa).toBeFalsy();
  });
});
