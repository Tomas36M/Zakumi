// Google Calendar por API REST, sin SDK: son dos POST y el repo no usa SDKs
// (misma decisión que el cliente del bot y el de ElevenLabs).
//
// SOLO SERVIDOR. Auth: OAuth con refresh token de la cuenta de Tomás —
// tomasmunevar36@gmail.com y paulapjpg@gmail.com son cuentas personales y una
// service account no puede escribir ahí sin delegación de dominio, que exige
// Workspace.
//
// ⚠️ La pantalla de consentimiento tiene que estar PUBLICADA EN PRODUCCIÓN.
// En modo "Testing" Google caduca el refresh token a los 7 días y la agenda
// deja de funcionar sola sin avisar.

import type { Calendario, EventoAgendado } from "./tipos";

const ZONA = "America/Bogota";
const API = "https://www.googleapis.com/calendar/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TIMEOUT_MS = 10_000;

type Json = Record<string, unknown>;

function obj(v: unknown): Json | null {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Json) : null;
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

/** El cuerpo del POST de creación del evento. Puro para poder probarlo. */
export function cuerpoEvento(
  datos: { titulo: string; descripcion: string; inicio: string; fin: string },
  invitados: string[],
  requestId: string,
): Json {
  return {
    summary: datos.titulo,
    description: datos.descripcion,
    start: { dateTime: datos.inicio, timeZone: ZONA },
    end: { dateTime: datos.fin, timeZone: ZONA },
    attendees: invitados.map((email) => ({ email })),
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };
}

/** Respuesta de events.insert → lo que guardamos. Puro. */
export function leerEvento(json: unknown): EventoAgendado | null {
  const e = obj(json);
  const id = texto(e?.id);
  if (!id) return null;

  let meet = texto(e?.hangoutLink);
  if (!meet) {
    const entradas = obj(e?.conferenceData)?.entryPoints;
    if (Array.isArray(entradas)) {
      const video = entradas
        .map((x) => obj(x))
        .find((x) => x?.entryPointType === "video");
      meet = texto(video?.uri);
    }
  }
  return { eventoId: id, meetUrl: meet, linkGoogle: texto(e?.htmlLink) };
}

/** Respuesta de freeBusy → ¿hay algo en la franja? Puro. Ante cualquier cosa
 *  rara devuelve false: el choque solo informa, no puede bloquear una cita. */
export function hayOcupado(json: unknown): boolean {
  const calendarios = obj(obj(json)?.calendars);
  if (!calendarios) return false;
  return Object.values(calendarios).some((c) => {
    const busy = obj(c)?.busy;
    return Array.isArray(busy) && busy.length > 0;
  });
}

/** Lista de invitados de AGENDA_INVITADOS (separados por comas). */
export function invitados(): string[] {
  return [
    ...new Set(
      (process.env.AGENDA_INVITADOS ?? "")
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e !== ""),
    ),
  ];
}

// El access token dura ~1h. Se cachea en el módulo: en Vercel cada lambda
// tiene el suyo, así que el costo real es un POST extra por arranque en frío.
let cache: { token: string; expiraEn: number } | null = null;

async function accessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refresh = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refresh) return null;

  if (cache && Date.now() < cache.expiraEn) return cache.token;

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refresh,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as Json | null;
    const token = texto(json?.access_token);
    if (!res.ok || !token) {
      // invalid_grant = el refresh token murió. La causa nº1: la pantalla de
      // consentimiento quedó en "Testing" (caduca a los 7 días).
      console.error("[agenda] no se pudo refrescar el token:", res.status, json?.error);
      return null;
    }
    const dura = typeof json?.expires_in === "number" ? json.expires_in : 3600;
    cache = { token, expiraEn: Date.now() + (dura - 60) * 1000 };
    return token;
  } catch (e) {
    console.error("[agenda] token:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** null = Google no está configurado; el resto del flujo sigue sin agenda. */
export function calendarioGoogle(): Calendario | null {
  if (
    !process.env.GOOGLE_OAUTH_CLIENT_ID ||
    !process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    !process.env.GOOGLE_CALENDAR_REFRESH_TOKEN
  ) {
    console.error("[agenda] faltan las credenciales de Google — no se agenda nada");
    return null;
  }

  return {
    async crearEvento(datos) {
      const token = await accessToken();
      if (!token) return null;
      try {
        const res = await fetch(
          `${API}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(cuerpoEvento(datos, invitados(), crypto.randomUUID())),
            signal: AbortSignal.timeout(TIMEOUT_MS),
            cache: "no-store",
          },
        );
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          console.error("[agenda] events.insert →", res.status, JSON.stringify(json).slice(0, 300));
          return null;
        }
        return leerEvento(json);
      } catch (e) {
        console.error("[agenda] crearEvento:", e instanceof Error ? e.message : e);
        return null;
      }
    },

    async hayChoque(inicio, fin) {
      const token = await accessToken();
      if (!token) return false;
      try {
        const res = await fetch(`${API}/freeBusy`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            timeMin: inicio,
            timeMax: fin,
            timeZone: ZONA,
            items: [{ id: "primary" }],
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
          cache: "no-store",
        });
        if (!res.ok) return false;
        return hayOcupado(await res.json().catch(() => null));
      } catch (e) {
        console.error("[agenda] freeBusy:", e instanceof Error ? e.message : e);
        return false;
      }
    },
  };
}
