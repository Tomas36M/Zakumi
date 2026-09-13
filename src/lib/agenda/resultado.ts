// Cómo se le cuenta al usuario lo que pasó al agendar, mover o cancelar una
// cita. Puro: la agenda y la bandeja de solicitudes pintan las MISMAS frases.

import type { ResultadoCita } from "./citas";

export type LineaResultado = { texto: string; variante: "aviso" | "error" };

const GOOGLE: Record<Extract<ResultadoCita, { ok: true }>["google"], LineaResultado> = {
  ok: { texto: "El evento de Google Calendar quedó al día.", variante: "aviso" },
  sin_evento: {
    texto: "No hay evento en Google (no había o no se pudo crear): la cita quedó solo en el panel.",
    variante: "error",
  },
  fallo: {
    texto: "El evento de Google no se pudo tocar: muévelo o bórralo a mano desde «Ver en Google».",
    variante: "error",
  },
  no_configurado: {
    texto: "Google Calendar no está configurado: la cita quedó solo en el panel.",
    variante: "aviso",
  },
};

const AVISO: Record<Extract<ResultadoCita, { ok: true }>["aviso"], LineaResultado> = {
  enviado: { texto: "Aviso enviado al lead por WhatsApp.", variante: "aviso" },
  fallo: {
    texto: "El aviso al lead no salió (plantilla sin aprobar o ventana de 24 h cerrada): avísale tú.",
    variante: "error",
  },
  sin_telefono: { texto: "Sin teléfono de contacto: no se avisó al lead.", variante: "aviso" },
  omitido: { texto: "No se avisó al lead.", variante: "aviso" },
};

export function lineasDeResultado(r: ResultadoCita): LineaResultado[] {
  if ("error" in r) return [{ texto: r.error, variante: "error" }];
  const lineas = [GOOGLE[r.google], AVISO[r.aviso]];
  if (r.choque) {
    lineas.push({ texto: "Ojo: choca con otro evento de tu calendario.", variante: "error" });
  }
  return lineas;
}
