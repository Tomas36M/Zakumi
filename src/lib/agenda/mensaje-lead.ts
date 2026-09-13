// El WhatsApp que le llega AL LEAD cuando su reunión se agenda, se mueve o
// se cancela. Puro y testeable, como `solicitudes/mensaje.ts` (que es el
// aviso interno a Tomás y Paula — este es el otro lado de la mesa).

import { fechaLegible } from "@/lib/solicitudes/mensaje";

/** Plantilla de utilidad en Meta (fuera del repo; hasta que esté aprobada
 * el aviso cae al texto libre, que solo llega dentro de la ventana de 24 h).
 * Variables EN EL ORDEN del cuerpo: {{1}} qué quedó · {{2}} enlace o cierre. */
export const PLANTILLA_AVISO_REUNION = "aviso_reunion";

export type DatosReunion = {
  nombre: string | null;
  accion: "agendada" | "reprogramada" | "cancelada";
  /** ISO del nuevo inicio (null al cancelar). */
  inicio: string | null;
  meetUrl: string | null;
};

/** «agendada para el sábado, 13 de septiembre de 2026, 2:00 p. m.» / «cancelada». */
export function queQuedo(d: DatosReunion): string {
  if (d.accion === "cancelada" || !d.inicio) return "cancelada";
  return `${d.accion} para el ${fechaLegible(d.inicio)}`;
}

export function textoReunion(d: DatosReunion): string {
  const lineas = [
    `Hola${d.nombre ? ` ${d.nombre}` : ""}, te escribe Zakumi: tu reunión con nosotros quedó ${queQuedo(d)}.`,
  ];
  if (d.accion !== "cancelada" && d.meetUrl) lineas.push(`Enlace de Meet: ${d.meetUrl}`);
  lineas.push("Si necesitas cambiarla, responde a este mensaje.");
  return lineas.join("\n");
}

/** aviso_reunion: {{1}} qué quedó · {{2}} enlace de Meet o el cierre. */
export function variablesReunion(d: DatosReunion): string[] {
  return [
    queQuedo(d),
    d.accion !== "cancelada" && d.meetUrl
      ? `Enlace de Meet: ${d.meetUrl}`
      : "Te confirmamos por acá cualquier cambio.",
  ];
}
