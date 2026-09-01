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
