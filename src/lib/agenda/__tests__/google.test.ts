import { describe, expect, it } from "vitest";
import { cuerpoEvento, hayOcupado, leerEvento } from "../google";

describe("cuerpoEvento", () => {
  const datos = {
    titulo: "Zakumi · María",
    descripcion: "Quiere un bot",
    inicio: "2026-09-03T15:00:00.000Z",
    fin: "2026-09-03T15:30:00.000Z",
  };

  it("pide una sala de Meet con requestId propio", () => {
    const c = cuerpoEvento(datos, ["a@x.com"], "req-1");
    expect(c.conferenceData).toEqual({
      createRequest: {
        requestId: "req-1",
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    });
  });

  it("manda las horas con la zona del negocio", () => {
    const c = cuerpoEvento(datos, ["a@x.com"], "req-1");
    expect(c.start).toEqual({
      dateTime: "2026-09-03T15:00:00.000Z",
      timeZone: "America/Bogota",
    });
    expect(c.end).toMatchObject({ timeZone: "America/Bogota" });
  });

  it("invita a todos los correos configurados", () => {
    const c = cuerpoEvento(datos, ["tom@x.com", "pau@x.com"], "req-1");
    expect(c.attendees).toEqual([{ email: "tom@x.com" }, { email: "pau@x.com" }]);
  });
});

describe("leerEvento", () => {
  it("saca id, Meet y link del evento creado", () => {
    const r = leerEvento({
      id: "ev-1",
      hangoutLink: "https://meet.google.com/abc-defg-hij",
      htmlLink: "https://calendar.google.com/event?eid=ev-1",
    });
    expect(r).toEqual({
      eventoId: "ev-1",
      meetUrl: "https://meet.google.com/abc-defg-hij",
      linkGoogle: "https://calendar.google.com/event?eid=ev-1",
    });
  });

  it("cae a entryPoints cuando no viene hangoutLink", () => {
    const r = leerEvento({
      id: "ev-2",
      conferenceData: {
        entryPoints: [
          { entryPointType: "more", uri: "https://tel.meet/x" },
          { entryPointType: "video", uri: "https://meet.google.com/zzz-zzzz-zzz" },
        ],
      },
    });
    expect(r?.meetUrl).toBe("https://meet.google.com/zzz-zzzz-zzz");
  });

  it("sin id no hay evento", () => {
    expect(leerEvento({ hangoutLink: "x" })).toBeNull();
    expect(leerEvento(null)).toBeNull();
  });

  it("un evento sin Meet sigue siendo un evento válido", () => {
    expect(leerEvento({ id: "ev-3" })).toEqual({
      eventoId: "ev-3",
      meetUrl: null,
      linkGoogle: null,
    });
  });
});

describe("hayOcupado", () => {
  it("detecta franjas ocupadas", () => {
    expect(hayOcupado({ calendars: { primary: { busy: [{ start: "a", end: "b" }] } } })).toBe(true);
  });

  it("sin franjas, libre", () => {
    expect(hayOcupado({ calendars: { primary: { busy: [] } } })).toBe(false);
  });

  it("ante una respuesta rara asume libre (el choque solo informa)", () => {
    expect(hayOcupado(null)).toBe(false);
    expect(hayOcupado({ error: "x" })).toBe(false);
  });
});
