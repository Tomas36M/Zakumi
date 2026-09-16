import { describe, expect, it } from "vitest";

import {
  avancesDesdeChats,
  chatsParaHistorial,
  e164DeChat,
  respondioSegunHistorial,
  type NegocioSync,
} from "../estados-chats";

function negocio(extra: Partial<NegocioSync>): NegocioSync {
  return {
    id: "n-1",
    telefono: "+573101234567",
    estado: "nuevo",
    estado_fijado_manual: false,
    ...extra,
  };
}

describe("e164DeChat", () => {
  it("el teléfono del bot (sin +) es el E.164 del CRM", () => {
    expect(e164DeChat("573101234567")).toBe("+573101234567");
  });

  it("un número de otro país también cruza: el bot guarda los dígitos completos", () => {
    expect(e164DeChat("56912345678")).toBe("+56912345678");
  });

  it("lo que no es un teléfono no cruza con nada", () => {
    expect(e164DeChat("labs:abc")).toBeNull();
  });
});

describe("avancesDesdeChats", () => {
  it("un chat donde solo escribió Zak deja al negocio en Contactado", () => {
    expect(
      avancesDesdeChats([{ telefono: "573101234567", respondio: false }], [negocio({ id: "a" })]),
    ).toEqual([{ id: "a", a: "contactado" }]);
  });

  it("si el negocio respondió, pasa a Respondió desde Nuevo o Contactado", () => {
    const negocios = [
      negocio({ id: "a", telefono: "+573101234567" }),
      negocio({ id: "b", telefono: "+573107654321", estado: "contactado" }),
    ];
    expect(
      avancesDesdeChats(
        [
          { telefono: "573101234567", respondio: true },
          { telefono: "573107654321", respondio: true },
        ],
        negocios,
      ),
    ).toEqual([
      { id: "a", a: "respondido" },
      { id: "b", a: "respondido" },
    ]);
  });

  it("sin historial consultado (null) no se mueve: no se adivina quién escribió", () => {
    expect(
      avancesDesdeChats([{ telefono: "573101234567", respondio: null }], [negocio({ id: "a" })]),
    ).toEqual([]);
  });

  it("si varios negocios comparten el teléfono, avanzan todos", () => {
    const negocios = [
      negocio({ id: "sucursal-1" }),
      negocio({ id: "sucursal-2" }),
      negocio({ id: "fijada", estado_fijado_manual: true }),
    ];
    expect(
      avancesDesdeChats([{ telefono: "573101234567", respondio: true }], negocios),
    ).toEqual([
      { id: "sucursal-1", a: "respondido" },
      { id: "sucursal-2", a: "respondido" },
    ]);
  });

  it("nunca retrocede ni toca fijados a mano, clientes o descartados", () => {
    const negocios = [
      negocio({ id: "interesado", telefono: "+573100000001", estado: "interesado" }),
      negocio({ id: "respondido", telefono: "+573100000002", estado: "respondido" }),
      negocio({ id: "fijado", telefono: "+573100000003", estado_fijado_manual: true }),
      negocio({ id: "cliente", telefono: "+573100000004", estado: "cliente" }),
      negocio({ id: "descartado", telefono: "+573100000005", estado: "descartado" }),
    ];
    const chats = ["573100000001", "573100000002", "573100000003", "573100000004", "573100000005"].map(
      (telefono) => ({ telefono, respondio: true }),
    );
    expect(avancesDesdeChats(chats, negocios)).toEqual([]);
  });

  it("un contactado sin respuesta se queda como está", () => {
    expect(
      avancesDesdeChats(
        [{ telefono: "573101234567", respondio: false }],
        [negocio({ estado: "contactado" })],
      ),
    ).toEqual([]);
  });

  it("un chat sin negocio en el CRM no mueve nada", () => {
    expect(
      avancesDesdeChats([{ telefono: "573199999999", respondio: true }], [negocio({})]),
    ).toEqual([]);
  });
});

describe("chatsParaHistorial", () => {
  const chats = [
    { telefono: "573100000001", mensajes: 1 }, // nuevo con un mensaje: ¿lo escribió Zak o el negocio? sí
    { telefono: "573100000002", mensajes: 3 }, // nuevo: sí
    { telefono: "573100000003", mensajes: 5 }, // ya respondió en el CRM: no
    { telefono: "573100000004", mensajes: 2 }, // fijado a mano: no
    { telefono: "573100000005", mensajes: 4 }, // sin negocio en el CRM: no
    { telefono: "573100000006", mensajes: 2 }, // contactado con más mensajes: sí
    { telefono: "573100000007", mensajes: 1 }, // contactado con solo el saludo: no
  ];
  const negocios = [
    negocio({ id: "1", telefono: "+573100000001" }),
    negocio({ id: "2", telefono: "+573100000002" }),
    negocio({ id: "3", telefono: "+573100000003", estado: "respondido" }),
    negocio({ id: "4", telefono: "+573100000004", estado_fijado_manual: true }),
    negocio({ id: "6", telefono: "+573100000006", estado: "contactado" }),
    negocio({ id: "7", telefono: "+573100000007", estado: "contactado" }),
  ];

  it("todo negocio en Nuevo y los Contactado con más de un mensaje", () => {
    expect(chatsParaHistorial(chats, negocios)).toEqual([
      "573100000001",
      "573100000002",
      "573100000006",
    ]);
  });

  it("con tope, solo los primeros: lo demás se revisa en la siguiente visita", () => {
    expect(chatsParaHistorial(chats, negocios, 2)).toEqual(["573100000001", "573100000002"]);
  });
});

describe("respondioSegunHistorial", () => {
  const base = { ultimo_del_cliente: null, messages: [] as { role: "user" | "assistant" }[] };
  it("el bot lo dice: persona sí, solo contestadora no", () => {
    expect(respondioSegunHistorial({ ...base, humano: true })).toBe(true);
    expect(respondioSegunHistorial({ ...base, humano: false, ultimo_del_cliente: "2026-09-15T10:00:00Z" })).toBe(false);
  });
  it("sin veredicto del bot, cuenta como hoy: cualquier mensaje del cliente", () => {
    expect(respondioSegunHistorial({ ...base, humano: null })).toBe(false);
    expect(respondioSegunHistorial({ ...base, humano: null, ultimo_del_cliente: "2026-09-15T10:00:00Z" })).toBe(true);
    expect(respondioSegunHistorial({ ...base, humano: null, messages: [{ role: "user" }] })).toBe(true);
  });
});
