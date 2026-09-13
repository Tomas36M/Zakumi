import { describe, expect, it, vi } from "vitest";
import {
  agendarCitaCore,
  cancelarCitaCore,
  eventoDeSolicitud,
  reprogramarCitaCore,
  type AvisarLead,
  type FilaCita,
} from "../citas";
import type { Calendario } from "../tipos";

const AHORA = new Date("2026-09-13T12:00:00Z");
const CITA = { inicio: "2026-09-14T14:00:00.000Z", fin: "2026-09-14T14:30:00.000Z" };

const FILA: FilaCita = {
  id: "sol-1",
  estado: "nueva",
  origen: "voz",
  user_id: null,
  contacto_nombre: "María",
  contacto_telefono: "+573001112233",
  mensaje: "Quiere un bot",
  servicio_slug: "bot-whatsapp",
  cita_inicio: "2026-09-13T19:00:00.000Z",
  cita_fin: "2026-09-13T19:30:00.000Z",
  cita_evento_id: "ev-1",
  cita_meet_url: "https://meet.google.com/viejo",
  cita_link_google: "https://calendar.google.com/ev-1",
};

/** Supabase de mentira: devuelve la fila pedida y registra los updates. */
function supabaseFalso(fila: FilaCita | null, opciones: { errorUpdate?: boolean } = {}) {
  const actualizado: Record<string, unknown>[] = [];
  const cliente = {
    from() {
      return {
        select() {
          return { eq: () => ({ maybeSingle: async () => ({ data: fila, error: null }) }) };
        },
        update(campos: Record<string, unknown>) {
          actualizado.push(campos);
          return {
            eq: async () => ({ error: opciones.errorUpdate ? { message: "boom" } : null }),
          };
        },
      };
    },
  };
  return { cliente: cliente as never, actualizado };
}

function calendarioFalso(overrides: Partial<Calendario> = {}): Calendario & {
  llamadas: string[];
} {
  const llamadas: string[] = [];
  return {
    llamadas,
    crearEvento: async () => {
      llamadas.push("crear");
      return { eventoId: "ev-nuevo", meetUrl: "https://meet.google.com/nuevo", linkGoogle: "https://g/nuevo" };
    },
    hayChoque: async () => {
      llamadas.push("choque");
      return false;
    },
    actualizarEvento: async () => {
      llamadas.push("mover");
      return "ok";
    },
    borrarEvento: async () => {
      llamadas.push("borrar");
      return "ok";
    },
    ...overrides,
  };
}

const avisoOk = () => vi.fn<AvisarLead>(async () => "enviado");

describe("eventoDeSolicitud", () => {
  it("arma título y descripción como la entrada de voz/WhatsApp", () => {
    const e = eventoDeSolicitud(FILA, CITA, "https://zakumistudio.com/admin/solicitudes?solicitud=sol-1");
    expect(e.titulo).toBe("Zakumi · María");
    expect(e.descripcion).toContain("Lo que pidió: Quiere un bot");
    expect(e.descripcion).toContain("Contacto: +573001112233");
    expect(e.descripcion).toContain("Origen: voz");
    expect(e.descripcion).toContain("?solicitud=sol-1");
    expect(e.inicio).toBe(CITA.inicio);
  });

  it("sin nombre usa el teléfono en el título", () => {
    expect(eventoDeSolicitud({ ...FILA, contacto_nombre: null }, CITA, "u").titulo).toBe(
      "Zakumi · +573001112233",
    );
  });
});

describe("reprogramarCitaCore", () => {
  it("guarda en Supabase primero, mueve en Google y avisa al lead, en ese orden", async () => {
    const { cliente, actualizado } = supabaseFalso(FILA);
    const calendario = calendarioFalso();
    const avisarLead = avisoOk();

    const r = await reprogramarCitaCore(cliente, "sol-1", CITA, true, { calendario, avisarLead, ahora: AHORA });

    expect(r).toEqual({ ok: true, google: "ok", aviso: "enviado", choque: false });
    expect(actualizado).toEqual([{ cita_inicio: CITA.inicio, cita_fin: CITA.fin }]);
    expect(calendario.llamadas).toEqual(["choque", "mover"]);
    expect(avisarLead).toHaveBeenCalledTimes(1);
    expect(avisarLead.mock.calls[0][0]).toBe("+573001112233");
    expect(avisarLead.mock.calls[0][1]).toContain("reprogramada para el");
    expect(avisarLead.mock.calls[0][2]?.nombre).toBe("aviso_reunion");
  });

  it("si el evento ya no existe en Google, lo recrea y guarda los ids nuevos", async () => {
    const { cliente, actualizado } = supabaseFalso(FILA);
    const calendario = calendarioFalso({ actualizarEvento: async () => "no_existe" });

    const r = await reprogramarCitaCore(cliente, "sol-1", CITA, false, { calendario, ahora: AHORA });

    expect(r).toMatchObject({ ok: true, google: "ok", aviso: "omitido" });
    expect(calendario.llamadas).toEqual(["choque", "crear"]);
    expect(actualizado[1]).toEqual({
      cita_meet_url: "https://meet.google.com/nuevo",
      cita_evento_id: "ev-nuevo",
      cita_link_google: "https://g/nuevo",
    });
  });

  it("si Google falla, la cita queda movida en Supabase y el id viejo se conserva", async () => {
    const { cliente, actualizado } = supabaseFalso(FILA);
    const calendario = calendarioFalso({ actualizarEvento: async () => "error" });

    const r = await reprogramarCitaCore(cliente, "sol-1", CITA, false, { calendario, ahora: AHORA });

    expect(r).toMatchObject({ ok: true, google: "fallo" });
    expect(actualizado).toHaveLength(1); // solo el update de la fecha; nada tocó cita_evento_id
  });

  it("sin cita previa, sin fila o con fecha inválida devuelve error y no escribe", async () => {
    const sinCita = supabaseFalso({ ...FILA, cita_inicio: null });
    expect(await reprogramarCitaCore(sinCita.cliente, "sol-1", CITA, false, { calendario: null })).toMatchObject({
      error: expect.stringMatching(/no tiene cita/),
    });
    expect(sinCita.actualizado).toHaveLength(0);

    const sinFila = supabaseFalso(null);
    expect(await reprogramarCitaCore(sinFila.cliente, "x", CITA, false, { calendario: null })).toMatchObject({
      error: expect.stringMatching(/No se encontró/),
    });

    const pasada = supabaseFalso(FILA);
    const r = await reprogramarCitaCore(
      pasada.cliente,
      "sol-1",
      { inicio: "2026-09-01T14:00:00Z", fin: "2026-09-01T14:30:00Z" },
      false,
      { calendario: null, ahora: AHORA },
    );
    expect(r).toMatchObject({ error: expect.stringMatching(/futuro/) });
    expect(pasada.actualizado).toHaveLength(0);
  });

  it("sin calendario configurado lo dice, y sin teléfono no avisa", async () => {
    const { cliente } = supabaseFalso({ ...FILA, contacto_telefono: null });
    const avisarLead = avisoOk();
    const r = await reprogramarCitaCore(cliente, "sol-1", CITA, true, { calendario: null, avisarLead, ahora: AHORA });
    expect(r).toEqual({ ok: true, google: "no_configurado", aviso: "sin_telefono", choque: false });
    expect(avisarLead).not.toHaveBeenCalled();
  });

  it("para una solicitud del portal resuelve el teléfono del cliente", async () => {
    const { cliente } = supabaseFalso({ ...FILA, origen: "portal", user_id: "u1", contacto_telefono: null });
    const avisarLead = avisoOk();
    const r = await reprogramarCitaCore(cliente, "sol-1", CITA, true, {
      calendario: null,
      avisarLead,
      ahora: AHORA,
      telefonoDelCliente: async (uid) => (uid === "u1" ? "3109998877" : null),
    });
    expect(r).toMatchObject({ aviso: "enviado" });
    expect(avisarLead.mock.calls[0][0]).toBe("+573109998877");
  });

  it("un aviso que revienta no deshace nada: se reporta como fallo", async () => {
    const { cliente, actualizado } = supabaseFalso(FILA);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await reprogramarCitaCore(cliente, "sol-1", CITA, true, {
      calendario: null,
      ahora: AHORA,
      avisarLead: async () => {
        throw new Error("railway caído");
      },
    });
    expect(r).toMatchObject({ ok: true, aviso: "fallo" });
    expect(actualizado).toHaveLength(1);
    error.mockRestore();
  });
});

describe("cancelarCitaCore", () => {
  it("quita la cita, borra el evento y solo entonces limpia los ids de Google", async () => {
    const { cliente, actualizado } = supabaseFalso(FILA);
    const calendario = calendarioFalso();
    const avisarLead = avisoOk();

    const r = await cancelarCitaCore(cliente, "sol-1", true, { calendario, avisarLead });

    expect(r).toEqual({ ok: true, google: "ok", aviso: "enviado", choque: false });
    expect(actualizado).toEqual([
      { cita_inicio: null, cita_fin: null, cita_meet_url: null },
      { cita_evento_id: null, cita_link_google: null },
    ]);
    expect(calendario.llamadas).toEqual(["borrar"]);
    expect(avisarLead.mock.calls[0][1]).toContain("quedó cancelada");
  });

  it("un evento que ya no existía cuenta como borrado", async () => {
    const { cliente, actualizado } = supabaseFalso(FILA);
    const calendario = calendarioFalso({ borrarEvento: async () => "no_existe" });
    const r = await cancelarCitaCore(cliente, "sol-1", false, { calendario });
    expect(r).toMatchObject({ google: "ok" });
    expect(actualizado).toHaveLength(2);
  });

  it("si Google falla, los ids se quedan como pista y se reporta", async () => {
    const { cliente, actualizado } = supabaseFalso(FILA);
    const calendario = calendarioFalso({ borrarEvento: async () => "error" });
    const r = await cancelarCitaCore(cliente, "sol-1", false, { calendario });
    expect(r).toMatchObject({ google: "fallo" });
    expect(actualizado).toHaveLength(1);
  });

  it("sin evento en Google no hay nada que borrar", async () => {
    const { cliente } = supabaseFalso({ ...FILA, cita_evento_id: null });
    const calendario = calendarioFalso();
    const r = await cancelarCitaCore(cliente, "sol-1", false, { calendario });
    expect(r).toMatchObject({ google: "sin_evento" });
    expect(calendario.llamadas).toEqual([]);
  });
});

describe("agendarCitaCore", () => {
  it("pone la cita a una solicitud sin cita, crea el evento y avisa «agendada»", async () => {
    const { cliente, actualizado } = supabaseFalso({ ...FILA, cita_inicio: null, cita_fin: null, cita_evento_id: null });
    const calendario = calendarioFalso();
    const avisarLead = avisoOk();

    const r = await agendarCitaCore(cliente, "sol-1", CITA, true, { calendario, avisarLead, ahora: AHORA });

    expect(r).toEqual({ ok: true, google: "ok", aviso: "enviado", choque: false });
    expect(actualizado[0]).toEqual({ cita_inicio: CITA.inicio, cita_fin: CITA.fin, cita_texto_crudo: null });
    expect(actualizado[1]).toMatchObject({ cita_evento_id: "ev-nuevo" });
    expect(avisarLead.mock.calls[0][1]).toContain("agendada para el");
  });

  it("una solicitud rechazada no se agenda", async () => {
    const { cliente, actualizado } = supabaseFalso({ ...FILA, estado: "rechazada" });
    expect(await agendarCitaCore(cliente, "sol-1", CITA, false, { calendario: null, ahora: AHORA })).toMatchObject({
      error: expect.stringMatching(/rechazada/),
    });
    expect(actualizado).toHaveLength(0);
  });

  it("si el update falla no toca Google ni avisa", async () => {
    const { cliente } = supabaseFalso(FILA, { errorUpdate: true });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const calendario = calendarioFalso();
    const avisarLead = avisoOk();
    const r = await agendarCitaCore(cliente, "sol-1", CITA, true, { calendario, avisarLead, ahora: AHORA });
    expect(r).toMatchObject({ error: expect.stringMatching(/guardar/) });
    expect(calendario.llamadas).toEqual([]);
    expect(avisarLead).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
