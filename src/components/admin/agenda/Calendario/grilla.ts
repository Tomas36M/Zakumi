import { HORA_FIN, HORA_INICIO, MINUTOS_GRILLA } from "@/lib/agenda/semana";

/** Una hora mide 48px (`h-12`): 16 horas caben en una pantalla normal sin
 * que un bloque de 30 min sea ilegible. */
export const PX_POR_HORA = 48;
export const PX_POR_MIN = PX_POR_HORA / 60;
export const ALTO_GRILLA = MINUTOS_GRILLA * PX_POR_MIN;

/** Las etiquetas de la columna de horas: «6:00», «7:00» … «21:00». */
export const HORAS = Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i);

/** Las líneas de hora, pintadas con un gradiente repetido (una regla CSS en
 * vez de dieciséis divs por columna). */
export const FONDO_HORAS = {
  backgroundImage: `repeating-linear-gradient(to bottom, var(--color-hairline) 0 1px, transparent 1px ${PX_POR_HORA}px)`,
} as const;
