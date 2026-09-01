import { describe, expect, it, vi } from "vitest";
import { registrarSolicitudEntrante, type EntradaSolicitud } from "../entrada";
import type { Calendario } from "@/lib/agenda/tipos";

const AHORA = new Date("2026-09-01T15:00:00Z");

/** Supabase de mentira: registra lo insertado/actualizado y deja simular el
 *  choque de clave única (23505) que produce un reintento del webhook. */
function supabaseFalso(opciones: { errorInsert?: { code: string } } = {}) {
  const insertado: Record<string, unknown>[] = [];
  const actualizado: Record<string, unknown>[] = [];
  const cliente = {
    from() {
      return {
        insert(fila: Record<string, unknown>) {
          insertado.push(fila);
          return {
            select() {
              return {
                single: async () =>
                  opciones.errorInsert
                    ? { data: null, error: opciones.errorInsert }
                    : { data: { id: "sol-1" }, error: null },
              };
            },
          };
        },
        update(campos: Record<string, unknown>) {
          actualizado.push(campos);
          return { eq: async () => ({ error: null }) };
        },
      };
    },
  };
  // El tipo real de SupabaseClient es enorme; en el test solo importan estos
  // dos métodos, así que se castea a propósito.
  return { cliente: cliente as never, insertado, actualizado };
}

const BASE: EntradaSolicitud = {
  origen: "voz",
  claveOrigen: "voz:conv_abc",
  contacto: { nombre: "María", telefono: "+573001112233", email: null },
  servicioInteres: "bot de WhatsApp",
  detalle: "Quiere un bot para su restaurante",
  mejorHorario: null,
  citaCruda: null,
  llamadaId: "llamada-1",
  conversacion: null,
};

const calendarioOk: Calendario = {
  crearEvento: async () => ({
    eventoId: "ev-1",
    meetUrl: "https://meet.google.com/abc-defg-hij",
    linkGoogle: "https://calendar.google.com/event?eid=ev-1",
  }),
  hayChoque: async () => false,
};

// `vi.fn<...>` fija el tipo del mock explícitamente (en vez de dejar que TS
// infiera `[]` de un `async () => {}` sin argumentos) — los asserts de abajo
// leen el texto del aviso por índice `.mock.calls[0][0]`.
//
// `calendario: null` explícito en los casos que no prueban agenda: desde que
// `entrada.ts` usa `calendarioGoogle()` como default cuando no se pasa nada,
// omitirlo aquí saldría a internet en cualquier máquina con las envs de
// Google puestas.
describe("registrarSolicitudEntrante", () => {
  it("inserta la solicitud con el slug del catálogo y avisa", async () => {
    const { cliente, insertado } = supabaseFalso();
    const avisar = vi.fn<(texto: string) => Promise<void>>(async () => {});

    const r = await registrarSolicitudEntrante(cliente, BASE, { avisar, calendario: null, ahora: AHORA });

    expect(r).toEqual({ estado: "creada", solicitudId: "sol-1", agendada: false });
    expect(insertado[0]).toMatchObject({
      origen: "voz",
      estado: "nueva",
      user_id: null,
      servicio_slug: "bot-whatsapp",
      contacto_nombre: "María",
      contacto_telefono: "+573001112233",
      clave_origen: "voz:conv_abc",
      llamada_id: "llamada-1",
    });
    expect(avisar).toHaveBeenCalledOnce();
    expect(avisar.mock.calls[0][0]).toContain("María");
  });

  it("agenda y guarda el Meet cuando la fecha es buena", async () => {
    const { cliente, actualizado } = supabaseFalso();
    const avisar = vi.fn<(texto: string) => Promise<void>>(async () => {});

    const r = await registrarSolicitudEntrante(
      cliente,
      { ...BASE, citaCruda: "2026-09-03T10:00" },
      { avisar, calendario: calendarioOk, ahora: AHORA },
    );

    expect(r).toEqual({ estado: "creada", solicitudId: "sol-1", agendada: true });
    expect(actualizado[0]).toMatchObject({
      cita_meet_url: "https://meet.google.com/abc-defg-hij",
      cita_evento_id: "ev-1",
    });
    expect(avisar.mock.calls[0][0]).toContain("meet.google.com");
  });

  it("guarda el texto crudo cuando la fecha no se entiende", async () => {
    const { cliente, insertado } = supabaseFalso();
    const avisar = vi.fn<(texto: string) => Promise<void>>(async () => {});

    const r = await registrarSolicitudEntrante(
      cliente,
      { ...BASE, citaCruda: "el jueves por la tarde" },
      { avisar, calendario: calendarioOk, ahora: AHORA },
    );

    expect(r).toMatchObject({ agendada: false });
    expect(insertado[0]).toMatchObject({
      cita_texto_crudo: "el jueves por la tarde",
      cita_inicio: null,
    });
    expect(avisar.mock.calls[0][0]).toContain("ponle hora tú");
  });

  it("si el calendario falla, la solicitud igual queda y el aviso sale", async () => {
    const { cliente } = supabaseFalso();
    const avisar = vi.fn<(texto: string) => Promise<void>>(async () => {});
    const calendarioCaido: Calendario = {
      crearEvento: async () => null,
      hayChoque: async () => false,
    };

    const r = await registrarSolicitudEntrante(
      cliente,
      { ...BASE, citaCruda: "2026-09-03T10:00" },
      { avisar, calendario: calendarioCaido, ahora: AHORA },
    );

    expect(r).toMatchObject({ estado: "creada", agendada: false });
    expect(avisar).toHaveBeenCalledOnce();
    expect(avisar.mock.calls[0][0]).toContain("el calendario no respondió");
  });

  it("marca el choque de horario en el aviso pero agenda igual", async () => {
    const { cliente } = supabaseFalso();
    const avisar = vi.fn<(texto: string) => Promise<void>>(async () => {});
    const conChoque: Calendario = { ...calendarioOk, hayChoque: async () => true };

    const r = await registrarSolicitudEntrante(
      cliente,
      { ...BASE, citaCruda: "2026-09-03T10:00" },
      { avisar, calendario: conChoque, ahora: AHORA },
    );

    expect(r).toMatchObject({ agendada: true });
    expect(avisar.mock.calls[0][0]).toContain("⚠️");
  });

  it("un reintento del webhook no duplica ni vuelve a avisar", async () => {
    const { cliente } = supabaseFalso({ errorInsert: { code: "23505" } });
    const avisar = vi.fn<(texto: string) => Promise<void>>(async () => {});

    const r = await registrarSolicitudEntrante(cliente, BASE, { avisar, calendario: null, ahora: AHORA });

    expect(r).toEqual({ estado: "duplicada" });
    expect(avisar).not.toHaveBeenCalled();
  });

  it("sin teléfono ni cuenta no inserta nada (lo prohíbe el check de la tabla)", async () => {
    const { cliente, insertado } = supabaseFalso();
    const avisar = vi.fn<(texto: string) => Promise<void>>(async () => {});

    const r = await registrarSolicitudEntrante(
      cliente,
      { ...BASE, contacto: { nombre: "María", telefono: null, email: null } },
      { avisar, calendario: null, ahora: AHORA },
    );

    expect(r).toMatchObject({ estado: "error" });
    expect(insertado).toHaveLength(0);
  });

  it("sin calendario configurado guarda la cita y lo dice en el aviso", async () => {
    const { cliente, insertado } = supabaseFalso();
    const avisar = vi.fn<(texto: string) => Promise<void>>(async () => {});

    const r = await registrarSolicitudEntrante(
      cliente,
      { ...BASE, citaCruda: "2026-09-03T10:00" },
      { avisar, calendario: null, ahora: AHORA },
    );

    expect(r).toMatchObject({ estado: "creada", agendada: false });
    expect(insertado[0]).toMatchObject({ cita_inicio: "2026-09-03T15:00:00.000Z" });
  });

  it("si crearEvento LANZA, la solicitud igual queda y el aviso sale", async () => {
    const { cliente } = supabaseFalso();
    const avisar = vi.fn<(texto: string) => Promise<void>>(async () => {});
    const calendarioQueLanza: Calendario = {
      crearEvento: async () => {
        throw new Error("timeout de red");
      },
      hayChoque: async () => false,
    };

    const r = await registrarSolicitudEntrante(
      cliente,
      { ...BASE, citaCruda: "2026-09-03T10:00" },
      { avisar, calendario: calendarioQueLanza, ahora: AHORA },
    );

    expect(r).toMatchObject({ estado: "creada", agendada: false });
    expect(avisar).toHaveBeenCalledOnce();
  });

  it("si hayChoque LANZA, la solicitud igual queda y el aviso sale", async () => {
    const { cliente } = supabaseFalso();
    const avisar = vi.fn<(texto: string) => Promise<void>>(async () => {});
    const calendarioQueLanza: Calendario = {
      crearEvento: calendarioOk.crearEvento,
      hayChoque: async () => {
        throw new Error("credenciales vencidas");
      },
    };

    const r = await registrarSolicitudEntrante(
      cliente,
      { ...BASE, citaCruda: "2026-09-03T10:00" },
      { avisar, calendario: calendarioQueLanza, ahora: AHORA },
    );

    expect(r).toMatchObject({ estado: "creada", agendada: false });
    expect(avisar).toHaveBeenCalledOnce();
  });

  it("si avisar LANZA, la función igual resuelve con la solicitud creada", async () => {
    const { cliente } = supabaseFalso();
    const avisar = vi.fn<(texto: string) => Promise<void>>(async () => {
      throw new Error("el bot de WhatsApp está caído");
    });

    const r = await registrarSolicitudEntrante(cliente, BASE, { avisar, calendario: null, ahora: AHORA });

    expect(r).toEqual({ estado: "creada", solicitudId: "sol-1", agendada: false });
  });

  it("un evento sin link de Meet igual cuenta como agendada", async () => {
    const { cliente } = supabaseFalso();
    const avisar = vi.fn<(texto: string) => Promise<void>>(async () => {});
    const calendarioSinMeet: Calendario = {
      crearEvento: async () => ({ eventoId: "ev-1", meetUrl: null, linkGoogle: null }),
      hayChoque: async () => false,
    };

    const r = await registrarSolicitudEntrante(
      cliente,
      { ...BASE, citaCruda: "2026-09-03T10:00" },
      { avisar, calendario: calendarioSinMeet, ahora: AHORA },
    );

    expect(r).toMatchObject({ estado: "creada", agendada: true });
  });
});
