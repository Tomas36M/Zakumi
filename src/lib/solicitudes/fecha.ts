// Parser de la fecha que extrae el agente (`cita_fecha_hora`). Función pura y
// desconfiada: si no es una fecha futura, cercana y legible, devuelve null y
// el llamador guarda el texto crudo. Preferimos "no agendé, ponle hora tú"
// antes que inventar una reunión que nadie va a atender.

/** Bogotá es UTC-5 todo el año (Colombia no tiene horario de verano), así que
 *  una fecha sin zona se ancla con -05:00 sin necesitar librería de zonas. */
const OFFSET_BOGOTA = "-05:00";
const SIN_ZONA = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/;
/** Más allá de esto es una alucinación de año, no una cita. */
const MAX_DIAS = 90;
export const DURACION_POR_DEFECTO_MIN = 30;

export type Cita = { inicio: string; fin: string };

export function parsearCita(
  crudo: unknown,
  opciones: { ahora?: Date; duracionMin?: number } = {},
): Cita | null {
  if (typeof crudo !== "string") return null;
  const texto = crudo.trim();
  if (texto === "") return null;

  const conZona = SIN_ZONA.test(texto)
    ? `${texto.replace(" ", "T")}${OFFSET_BOGOTA}`
    : texto;
  const inicio = new Date(conZona);
  if (Number.isNaN(inicio.getTime())) return null;

  const ahora = opciones.ahora ?? new Date();
  if (inicio.getTime() <= ahora.getTime()) return null;
  if ((inicio.getTime() - ahora.getTime()) / 86_400_000 > MAX_DIAS) return null;

  const duracion = opciones.duracionMin ?? DURACION_POR_DEFECTO_MIN;
  return {
    inicio: inicio.toISOString(),
    fin: new Date(inicio.getTime() + duracion * 60_000).toISOString(),
  };
}
