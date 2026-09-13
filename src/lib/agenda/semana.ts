// La aritmética de la vista semanal de la agenda. Puro y sin librerías: Bogotá
// es UTC-5 todo el año (Colombia no tiene horario de verano), así que un
// instante se lleva a Bogotá restando cinco horas y leyendo los getters UTC,
// y una fecha local se ancla con `-05:00` — las dos técnicas que ya usan
// `fecha.ts` y `territorios.ts`.

import type { Cita360 } from "./consultas";

const OFFSET_MS = 5 * 3_600_000;
const DIA_MS = 86_400_000;

/** La grilla va de 6:00 a 22:00: lo que cabe en un día de reuniones. */
export const HORA_INICIO = 6;
export const HORA_FIN = 22;
export const MINUTOS_GRILLA = (HORA_FIN - HORA_INICIO) * 60;
/** Una cita de 15 min sigue teniendo que poderse tocar. */
export const DURACION_MINIMA_VISUAL = 20;
export const DURACIONES_MIN = [30, 45, 60, 90] as const;
const MAX_DIAS_ADELANTE = 90;
const MAX_DURACION_MIN = 8 * 60;

const DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const HORA_HHMM = /^\d{2}:\d{2}$/;

export type DiaSemana = { fecha: string; etiqueta: string; esHoy: boolean };

export type RangoSemana = {
  /** El lunes, "YYYY-MM-DD". */
  lunes: string;
  /** Instantes ISO UTC: `desde` inclusivo (lunes 00:00 Bogotá), `hasta`
   * exclusivo (el lunes siguiente 00:00 Bogotá). */
  desde: string;
  hasta: string;
  dias: DiaSemana[];
};

function partes(fecha: string): [number, number, number] {
  const [a, m, d] = fecha.split("-").map(Number);
  return [a, m, d];
}

function iso(a: number, m: number, d: number): string {
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = partes(fecha);
  const t = new Date(Date.UTC(a, m - 1, d + dias));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Medianoche de esa fecha en Bogotá, como instante. */
function medianocheBogota(fecha: string): Date {
  return new Date(`${fecha}T00:00:00-05:00`);
}

/** Un instante → su fecha calendario en Bogotá. */
export function diaBogotaDe(instante: string | Date): string {
  const d = new Date(new Date(instante).getTime() - OFFSET_MS);
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Un instante → minutos desde la medianoche de Bogotá. */
export function minutosBogota(instante: string): number {
  const d = new Date(new Date(instante).getTime() - OFFSET_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** "HH:MM" en Bogotá. */
function horaBogota(instante: string): string {
  const min = minutosBogota(instante);
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** El lunes de la semana de una fecha (la semana empieza el lunes). */
export function lunesDe(fecha: string): string {
  const [a, m, d] = partes(fecha);
  const domingoCero = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return sumarDias(fecha, -((domingoCero + 6) % 7));
}

export function semanaVecina(lunes: string, delta: -1 | 1): string {
  return sumarDias(lunes, 7 * delta);
}

export function rangoSemana(lunes: string, hoy: string): RangoSemana {
  const dias: DiaSemana[] = [];
  for (let i = 0; i < 7; i++) {
    const fecha = sumarDias(lunes, i);
    dias.push({ fecha, etiqueta: `${DIAS[i]} ${partes(fecha)[2]}`, esHoy: fecha === hoy });
  }
  return {
    lunes,
    desde: medianocheBogota(lunes).toISOString(),
    hasta: medianocheBogota(sumarDias(lunes, 7)).toISOString(),
    dias,
  };
}

/** «14 – 20 sep 2026», «28 sep – 4 oct 2026», «29 dic 2025 – 4 ene 2026». */
export function etiquetaSemana(r: RangoSemana): string {
  const [a1, m1, d1] = partes(r.lunes);
  const [a2, m2, d2] = partes(sumarDias(r.lunes, 6));
  if (a1 !== a2) return `${d1} ${MESES[m1 - 1]} ${a1} – ${d2} ${MESES[m2 - 1]} ${a2}`;
  if (m1 !== m2) return `${d1} ${MESES[m1 - 1]} – ${d2} ${MESES[m2 - 1]} ${a1}`;
  return `${d1} – ${d2} ${MESES[m1 - 1]} ${a1}`;
}

export type PosicionGrilla = {
  /** 0 = lunes … 6 = domingo. */
  columna: number;
  /** Minutos desde HORA_INICIO. */
  desdeMin: number;
  duracionMin: number;
  /** La cita se sale de la grilla (antes de las 6 o después de las 22). */
  recortada: boolean;
};

/**
 * Dónde cae una cita en la grilla de la semana, o null si no es de esa
 * semana. Se recorta a la grilla (y se dice), y nunca mide menos de
 * DURACION_MINIMA_VISUAL para que se pueda tocar.
 */
export function posicionEnGrilla(
  cita: { inicio: string; fin: string },
  semana: RangoSemana,
): PosicionGrilla | null {
  const columna = semana.dias.findIndex((d) => d.fecha === diaBogotaDe(cita.inicio));
  if (columna === -1) return null;
  const inicioMin = minutosBogota(cita.inicio) - HORA_INICIO * 60;
  const duracionReal = Math.round(
    (new Date(cita.fin).getTime() - new Date(cita.inicio).getTime()) / 60_000,
  );
  const finMin = inicioMin + (Number.isFinite(duracionReal) && duracionReal > 0 ? duracionReal : 30);
  const desde = Math.min(Math.max(0, inicioMin), MINUTOS_GRILLA - DURACION_MINIMA_VISUAL);
  const hasta = Math.min(MINUTOS_GRILLA, Math.max(finMin, desde + DURACION_MINIMA_VISUAL));
  return {
    columna,
    desdeMin: desde,
    duracionMin: hasta - desde,
    recortada: desde !== inicioMin || hasta !== finMin,
  };
}

export type Carril = { carril: number; total: number };

/**
 * Citas que se pisan el mismo día se reparten en carriles (columnas dentro
 * de la columna). Barrido por inicio: cada cita toma el primer carril que ya
 * quedó libre; las que se tocan entre sí forman un grupo y comparten el
 * mismo `total`, para que las anchuras cuadren.
 */
export function carriles(citas: readonly Cita360[]): Map<string, Carril> {
  const resultado = new Map<string, Carril>();
  const porDia = new Map<string, Cita360[]>();
  for (const c of citas) {
    const dia = diaBogotaDe(c.inicio);
    const lista = porDia.get(dia);
    if (lista) lista.push(c);
    else porDia.set(dia, [c]);
  }

  for (const lista of porDia.values()) {
    const ordenadas = [...lista].sort((a, b) => a.inicio.localeCompare(b.inicio));
    let grupo: { id: string; carril: number }[] = [];
    let finesPorCarril: number[] = [];
    let finGrupo = -Infinity;

    function cerrarGrupo() {
      for (const g of grupo) resultado.set(g.id, { carril: g.carril, total: finesPorCarril.length });
      grupo = [];
      finesPorCarril = [];
    }

    for (const c of ordenadas) {
      const inicio = new Date(c.inicio).getTime();
      const fin = Math.max(new Date(c.fin).getTime(), inicio + 60_000);
      if (inicio >= finGrupo) {
        cerrarGrupo();
        finGrupo = -Infinity;
      }
      let carril = finesPorCarril.findIndex((f) => f <= inicio);
      if (carril === -1) {
        carril = finesPorCarril.length;
        finesPorCarril.push(fin);
      } else {
        finesPorCarril[carril] = fin;
      }
      grupo.push({ id: c.id, carril });
      finGrupo = Math.max(finGrupo, fin);
    }
    cerrarGrupo();
  }

  return resultado;
}

export type FormularioCita = { fecha: string; hora: string; duracionMin: number };

/** Lo que escribe el usuario (fecha y hora de Bogotá) → los dos instantes
 * ISO. null si el formulario está incompleto o malformado. */
export function citaDesdeFormulario(f: FormularioCita): { inicio: string; fin: string } | null {
  if (!FECHA_ISO.test(f.fecha) || !HORA_HHMM.test(f.hora)) return null;
  if (!Number.isInteger(f.duracionMin) || f.duracionMin <= 0) return null;
  const inicio = new Date(`${f.fecha}T${f.hora}:00-05:00`);
  if (Number.isNaN(inicio.getTime())) return null;
  return {
    inicio: inicio.toISOString(),
    fin: new Date(inicio.getTime() + f.duracionMin * 60_000).toISOString(),
  };
}

/** La inversa, para precargar el formulario al reprogramar. */
export function formularioDesdeCita(c: { inicio: string; fin: string }): FormularioCita {
  const duracion = Math.round((new Date(c.fin).getTime() - new Date(c.inicio).getTime()) / 60_000);
  return {
    fecha: diaBogotaDe(c.inicio),
    hora: horaBogota(c.inicio),
    duracionMin: Number.isFinite(duracion) && duracion > 0 ? duracion : 30,
  };
}

/** null = válida; si no, el motivo para el usuario. Misma ventana de 90 días
 * que el parser de lo que extrae Zak (`fecha.ts`). */
export function validarCita(c: { inicio: string; fin: string }, ahora: Date): string | null {
  const inicio = new Date(c.inicio).getTime();
  const fin = new Date(c.fin).getTime();
  if (Number.isNaN(inicio) || Number.isNaN(fin)) return "La fecha no se entiende.";
  if (fin <= inicio) return "La cita tiene que terminar después de empezar.";
  if (inicio <= ahora.getTime()) return "La cita tiene que ser en el futuro.";
  if (inicio - ahora.getTime() > MAX_DIAS_ADELANTE * DIA_MS) {
    return `Más de ${MAX_DIAS_ADELANTE} días adelante: revisa el año.`;
  }
  if (fin - inicio > MAX_DURACION_MIN * 60_000) return "Una reunión no dura más de ocho horas.";
  return null;
}
