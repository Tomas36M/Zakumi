/**
 * Formateo de fechas del panel: SIEMPRE es-CO y America/Bogota.
 * Única fuente — antes había 6 copias locales de estas funciones.
 */

const FORMATO_CORTO = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

/** "22 ago, 10:30 a. m." — vacío si null, el input crudo si no parsea. */
export function fechaCorta(iso: string | null): string {
  if (!iso) return "";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return FORMATO_CORTO.format(fecha);
}

const FORMATO_HORA = new Intl.DateTimeFormat("es-CO", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

/** "10:30 a. m." en Bogotá (por defecto: ahora). */
export function horaBogota(fecha: Date = new Date()): string {
  return FORMATO_HORA.format(fecha);
}

/** La hora Bogotá de un ISO, o undefined si viene null/roto (bots viejos). */
export function horaDeIso(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return undefined;
  return FORMATO_HORA.format(fecha);
}

const FORMATO_DIA_ISO = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
});

/** Hoy en Bogotá como "YYYY-MM-DD" (en-CA formatea ISO). */
export function hoyBogota(): string {
  return FORMATO_DIA_ISO.format(new Date());
}
