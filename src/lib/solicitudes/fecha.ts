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

/** Formateador de una sola vez: `en-CA` da "AAAA-MM-DD" directo, sin tener
 *  que reordenar partes a mano. */
const FORMATO_DIA_BOGOTA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** El día calendario en Bogotá, no en UTC (donde corre el servidor): a las
 *  19:00 en Bogotá ya es el día siguiente en UTC, y usar `toISOString`
 *  desalinea cualquier clave de idempotencia anclada "por día" con el día
 *  que la persona realmente vivió. */
export function diaBogota(fecha: Date): string {
  return FORMATO_DIA_BOGOTA.format(fecha);
}

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
