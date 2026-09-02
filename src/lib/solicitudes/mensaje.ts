// El texto del aviso de WhatsApp. Puro y testeable: el formato del mensaje es
// lo único que Tomás y Paula ven de todo este subsistema, así que se prueba
// aparte de la red y de la base.

import type { Cita } from "./fecha";

export type DatosAviso = {
  origen: "voz" | "whatsapp";
  nombre: string | null;
  telefono: string | null;
  servicio: string | null;
  detalle: string | null;
  mejorHorario: string | null;
  cita: Cita | null;
  citaTextoCrudo: string | null;
  meetUrl: string | null;
  choque: boolean;
  urlPanel: string;
};

const CANAL: Record<DatosAviso["origen"], string> = {
  voz: "llamada de voz",
  whatsapp: "conversación de WhatsApp",
};

const FORMATO = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  dateStyle: "full",
  timeStyle: "short",
});

/** Fecha ISO → "martes, 3 de septiembre de 2026, 10:00" en hora de Bogotá. */
export function fechaLegible(iso: string): string {
  return FORMATO.format(new Date(iso));
}

export function construirAviso(d: DatosAviso): string {
  const lineas: string[] = [`🟠 Nueva solicitud — ${CANAL[d.origen]}`];

  const quien = [d.nombre, d.telefono].filter((x) => x).join(" · ");
  lineas.push(quien || "sin datos de contacto");
  if (d.servicio) lineas.push(`Servicio: ${d.servicio}`);
  if (d.detalle) lineas.push(`«${d.detalle}»`);
  if (d.mejorHorario) lineas.push(`Prefiere que lo contacten: ${d.mejorHorario}`);

  if (d.cita) {
    lineas.push("");
    lineas.push(`📅 ${fechaLegible(d.cita.inicio)}${d.choque ? "  ⚠️ choca con otro evento" : ""}`);
    if (d.meetUrl) lineas.push(`🎥 ${d.meetUrl}`);
    else lineas.push("(sin link de Meet — el calendario no respondió)");
  } else if (d.citaTextoCrudo) {
    lineas.push("");
    lineas.push(`📅 Quiere agendar: «${d.citaTextoCrudo}» — sin fecha clara, ponle hora tú.`);
  }

  lineas.push("");
  lineas.push(`→ ${d.urlPanel}`);
  return lineas.join("\n");
}

export type DatosAvisoRescate = {
  origen: "voz" | "whatsapp";
  /** Por qué no quedó la fila: sin teléfono (viola el check de la tabla) o
   *  falló el insert (red, Supabase caído, etc). */
  motivo: "sin_contacto" | "db";
  nombre: string | null;
  telefono: string | null;
  detalle: string | null;
};

const MOTIVO_RESCATE: Record<DatosAvisoRescate["motivo"], string> = {
  sin_contacto: "no dejó teléfono de contacto",
  db: "la base de datos no lo guardó",
};

/**
 * El aviso de "esto se hubiera perdido": cuando `registrarSolicitudEntrante`
 * no pudo insertar la fila, este es el ÚNICO rastro que le queda a alguien
 * que sí quería contratarnos. Por eso lleva todo lo que se alcanzó a
 * capturar, en vez de solo decir que algo falló.
 */
export function construirAvisoRescate(d: DatosAvisoRescate): string {
  const lineas: string[] = [
    `🔴 Prospecto perdido — ${CANAL[d.origen]}`,
    `NO quedó en la bandeja: ${MOTIVO_RESCATE[d.motivo]}. Rescátalo a mano.`,
  ];

  const quien = [d.nombre, d.telefono].filter((x) => x).join(" · ");
  lineas.push(quien || "sin datos de contacto");
  if (d.detalle) lineas.push(`«${d.detalle}»`);

  return lineas.join("\n");
}

// ---- Plantillas de Meta (las de utilidad creadas el 2026-09-02 en el WABA) ----
// Nombres tal cual están en Meta. Las variables van EN EL ORDEN del cuerpo
// aprobado: cambiar el orden acá sin cambiar la plantilla desordena el aviso.
export const PLANTILLA_AVISO_SOLICITUD = "aviso_solicitud";
export const PLANTILLA_AVISO_RESCATE = "aviso_prospecto_perdido";

/** aviso_solicitud: {{1}} canal · {{2}} contacto · {{3}} servicio · {{4}} detalle.
 *  Un solo hueco para todo lo variable (cita, Meet, lo que pidió, horario), así
 *  que se concatena con " · " y nunca queda vacío. */
export function variablesAviso(d: DatosAviso): string[] {
  const quien = [d.nombre, d.telefono].filter((x) => x).join(" · ") || "sin datos de contacto";
  const partes: string[] = [];
  if (d.cita) {
    partes.push(`📅 ${fechaLegible(d.cita.inicio)}${d.choque ? " ⚠️ choca con otro evento" : ""}`);
    partes.push(d.meetUrl ? `Meet: ${d.meetUrl}` : "sin link de Meet");
  } else if (d.citaTextoCrudo) {
    partes.push(`Quiere agendar: «${d.citaTextoCrudo}», sin fecha clara`);
  }
  if (d.detalle) partes.push(`«${d.detalle}»`);
  if (d.mejorHorario) partes.push(`Prefiere que lo contacten: ${d.mejorHorario}`);
  return [CANAL[d.origen], quien, d.servicio ?? "por definir", partes.join(" · ") || "sin más detalle"];
}

/** aviso_prospecto_perdido: {{1}} canal · {{2}} motivo · {{3}} datos capturados. */
export function variablesAvisoRescate(d: DatosAvisoRescate): string[] {
  const quien = [d.nombre, d.telefono].filter((x) => x).join(" · ");
  const datos =
    [quien, d.detalle ? `«${d.detalle}»` : null].filter((x) => x).join(" · ") ||
    "sin datos de contacto";
  return [CANAL[d.origen], MOTIVO_RESCATE[d.motivo], datos];
}
