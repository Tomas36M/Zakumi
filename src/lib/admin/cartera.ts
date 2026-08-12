// Cartera de clientes y cobros. Espejo de los enums de supabase/cartera.sql.
// Todas las fechas son strings ISO "YYYY-MM-DD" y se comparan como strings —
// sin objetos Date en la lógica, sin sorpresas de zona horaria.

export type TipoProducto = "bot" | "web" | "crm" | "otro";
export type Ciclo = "mensual" | "anual" | "unico";
export type Semaforo = "al_dia" | "por_vencer" | "vencido" | "sin_programar";

export type Cliente = {
  id: string;
  negocio_id: string | null;
  nombre: string;
  telefono: string | null;
  email: string | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductoContratado = {
  id: string;
  cliente_id: string;
  tipo: TipoProducto;
  nombre: string;
  instancia_id: string | null; // referencia blanda a la instancia del bot (otra base)
  dominio: string | null;
  tarifa: number;
  moneda: string;
  ciclo: Ciclo;
  proxima_fecha: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductoConCliente = ProductoContratado & {
  clientes: Pick<Cliente, "id" | "nombre"> | null;
};

export type Pago = {
  id: string;
  producto_id: string;
  fecha: string;
  monto: number;
  moneda: string;
  nota: string | null;
  registrado_por: string | null;
  created_at: string;
};

export const TIPOS_PRODUCTO: readonly { valor: TipoProducto; label: string }[] = [
  { valor: "bot", label: "Bot de WhatsApp" },
  { valor: "web", label: "Página web" },
  { valor: "crm", label: "CRM" },
  { valor: "otro", label: "Otro" },
] as const;

export const CICLOS: readonly { valor: Ciclo; label: string }[] = [
  { valor: "mensual", label: "Mensual" },
  { valor: "anual", label: "Anual" },
  { valor: "unico", label: "Pago único" },
] as const;

/** Hoy en Bogotá como "YYYY-MM-DD" (en-CA formatea ISO). */
export function hoyBogota(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
  }).format(new Date());
}

/**
 * Estado de cobro de un producto. El día exacto del cobro cuenta como
 * "por_vencer": todavía se puede cobrar a tiempo.
 */
export function semaforoCobro(
  proximaFecha: string | null,
  hoy: string,
  diasAviso = 7,
): Semaforo {
  if (!proximaFecha) return "sin_programar";
  if (proximaFecha < hoy) return "vencido";
  if (proximaFecha <= sumarDias(hoy, diasAviso)) return "por_vencer";
  return "al_dia";
}

/**
 * Próxima fecha según el ciclo, con clamp de fin de mes (31 ene → 28/29 feb).
 * Pago único no se reprograma.
 */
export function siguienteFecha(fecha: string, ciclo: Ciclo): string | null {
  if (ciclo === "unico") return null;
  const [a, m, d] = fecha.split("-").map(Number);
  const meses = ciclo === "mensual" ? 1 : 12;
  const totalMeses = a * 12 + (m - 1) + meses;
  const anio = Math.floor(totalMeses / 12);
  const mes = (totalMeses % 12) + 1;
  const dia = Math.min(d, diasDelMes(anio, mes));
  return iso(anio, mes, dia);
}

/**
 * Orden de atención: fecha ascendente (los vencidos son las fechas más
 * viejas, así que quedan de primeros solos) y sin_programar al final.
 */
export function ordenarPorUrgencia<T extends { proxima_fecha: string | null }>(
  productos: T[],
): T[] {
  return productos.toSorted((x, y) => {
    const fx = x.proxima_fecha ?? "9999-12-31";
    const fy = y.proxima_fecha ?? "9999-12-31";
    return fx < fy ? -1 : fx > fy ? 1 : 0;
  });
}

/** "hoy", "mañana", "en 7 días", "venció ayer", "venció hace 11 días". */
export function descripcionVencimiento(
  proximaFecha: string | null,
  hoy: string,
): string {
  if (!proximaFecha) return "sin programar";
  const dias = diferenciaDias(hoy, proximaFecha);
  if (dias === 0) return "hoy";
  if (dias === 1) return "mañana";
  if (dias > 1) return `en ${dias} días`;
  if (dias === -1) return "venció ayer";
  return `venció hace ${-dias} días`;
}

export function formatearCOP(monto: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(monto);
}

// ——— helpers de fecha (UTC puro, sin zona horaria) ———

function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d + dias));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

function diferenciaDias(desde: string, hasta: string): number {
  const [a1, m1, d1] = desde.split("-").map(Number);
  const [a2, m2, d2] = hasta.split("-").map(Number);
  const ms = Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1);
  return Math.round(ms / 86_400_000);
}

function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

function iso(a: number, m: number, d: number): string {
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
