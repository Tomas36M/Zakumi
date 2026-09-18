import { describe, expect, it } from "vitest";
import { construirCola, esDeCola, type ConversacionCola } from "../cola-voz";
import type { FichaNegocio } from "../zak";

function conv(over: Partial<ConversacionCola> = {}): ConversacionCola {
  return {
    phone: "573001",
    humano: false,
    contestadora: true,
    ultimo_del_cliente: "2026-09-17T18:50:00Z",
    ...over,
  };
}

const FICHA: FichaNegocio = {
  negocioId: "uuid-1",
  nombre: "Antojos y Crepes",
  ciudad: "Bogotá",
  categoria: "restaurante",
  estado: "contactado",
  telefono: "+573001",
  verticalSlug: "restaurante",
  verticalLabel: "Restaurante",
};

describe("esDeCola", () => {
  it("solo contestó la máquina: va a la cola", () => {
    expect(esDeCola(conv())).toBe(true);
    expect(esDeCola(conv({ humano: null }))).toBe(true);
  });

  // El caso que evita quemar plata: si ya habló una persona, la conversación
  // sigue por WhatsApp (gratis) en vez de por teléfono.
  it("si ya escribió una persona, sale de la cola", () => {
    expect(esDeCola(conv({ humano: true }))).toBe(false);
  });

  it("sin contestadora no hay cola", () => {
    expect(esDeCola(conv({ contestadora: false }))).toBe(false);
  });
});

describe("construirCola", () => {
  it("cruza la ficha del CRM y deja el teléfono en E.164 para llamar", () => {
    const [fila] = construirCola([conv()], { "573001": FICHA }, {});
    expect(fila).toEqual({
      telefono: "573001",
      telefonoE164: "+573001",
      nombre: "Antojos y Crepes",
      verticalLabel: "Restaurante",
      estado: "contactado",
      negocioId: "uuid-1",
      contestoEn: "2026-09-17T18:50:00Z",
      ultimaLlamada: null,
    });
  });

  // Se puede llamar a un número sin saber quién es; esconderlo sería esconder
  // trabajo pendiente.
  it("un teléfono sin ficha entra igual, con el + delante", () => {
    const [fila] = construirCola([conv({ phone: "573999" })], {}, {});
    expect(fila.telefonoE164).toBe("+573999");
    expect(fila.nombre).toBeNull();
    expect(fila.negocioId).toBeNull();
  });

  it("los que nunca se han llamado van primero", () => {
    const cola = construirCola(
      [
        conv({ phone: "573001", ultimo_del_cliente: "2026-09-17T20:00:00Z" }),
        conv({ phone: "573002", ultimo_del_cliente: "2026-09-16T10:00:00Z" }),
      ],
      {},
      { "573001": "2026-09-17T21:00:00Z" },
    );
    expect(cola.map((f) => f.telefono)).toEqual(["573002", "573001"]);
  });

  it("dentro del mismo grupo, la contestadora más reciente primero", () => {
    const cola = construirCola(
      [
        conv({ phone: "573001", ultimo_del_cliente: "2026-09-15T10:00:00Z" }),
        conv({ phone: "573002", ultimo_del_cliente: "2026-09-17T10:00:00Z" }),
        conv({ phone: "573003", ultimo_del_cliente: null }),
      ],
      {},
      {},
    );
    expect(cola.map((f) => f.telefono)).toEqual(["573002", "573001", "573003"]);
  });

  it("las conversaciones con persona no aparecen", () => {
    const cola = construirCola(
      [conv({ phone: "573001", humano: true }), conv({ phone: "573002" })],
      {},
      {},
    );
    expect(cola.map((f) => f.telefono)).toEqual(["573002"]);
  });
});
