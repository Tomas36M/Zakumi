import type { TipoTelefono } from "./negocios";

export type TelefonoNormalizado = {
  telefono: string | null;
  tipo: TipoTelefono;
};

const SIN_TELEFONO: TelefonoNormalizado = { telefono: null, tipo: "desconocido" };

// Sufijos de extensión que Places y la captura manual traen a veces:
// "ext. 12", "extensión 12", "x123", "# 5".
const EXTENSION = /\s*(?:ext\.?|extensión|extension|x|#)\s*\d+\s*$/i;

/**
 * Normaliza un teléfono colombiano a E.164 (+57…).
 * - Celulares (10 dígitos, empiezan por 3) → móvil.
 * - Fijos (10 dígitos, empiezan por 60) → fijo: NO tienen WhatsApp.
 * - Números de otro país con "+" se conservan tal cual, tipo desconocido.
 * - Si no se puede determinar el indicativo, devuelve null: no lo inventamos.
 * Invariante: todo teléfono no nulo cumple ^\+[1-9][0-9]{6,14}$ (el CHECK de
 * supabase/schema.sql).
 */
export function normalizarTelefonoCO(
  bruto: string | null | undefined,
): TelefonoNormalizado {
  if (!bruto) return SIN_TELEFONO;

  const limpio = bruto.trim().replace(EXTENSION, "");
  if (!limpio) return SIN_TELEFONO;

  const teniaMas = limpio.startsWith("+");
  const digitos = limpio.replace(/\D/g, "");
  if (!digitos) return SIN_TELEFONO;

  // Quitar el indicativo de Colombia: "+57…" explícito o "57…" con la
  // longitud exacta de indicativo + número nacional (12 dígitos). Un "+" con
  // 10 dígitos NO es un nacional: es E.164 completo de otro país.
  let nacional: string | null = null;
  if (digitos.startsWith("57") && digitos.length === 12) {
    nacional = digitos.slice(2);
  } else if (!teniaMas && digitos.length === 10) {
    nacional = digitos;
  }

  if (nacional !== null) {
    return { telefono: `+57${nacional}`, tipo: tipoNacional(nacional) };
  }

  // "+" de otro país: se conserva en E.164 si tiene una longitud plausible.
  if (teniaMas && digitos.length >= 7 && digitos.length <= 15 && digitos[0] !== "0") {
    return { telefono: `+${digitos}`, tipo: "desconocido" };
  }

  return SIN_TELEFONO;
}

function tipoNacional(nacional: string): TipoTelefono {
  if (nacional.startsWith("3")) return "movil";
  if (nacional.startsWith("60")) return "fijo";
  return "desconocido";
}

/**
 * ¿Se le puede escribir por WhatsApp? En Colombia lo sabemos: celular sí,
 * fijo no. De los planes de numeración de otros países no sabemos nada, así
 * que un número extranjero en E.164 se acepta y es Meta quien lo rechaza si
 * no tiene WhatsApp.
 */
export function admiteWhatsApp({ telefono, tipo }: TelefonoNormalizado): boolean {
  if (telefono === null) return false;
  if (telefono.startsWith("+57")) return tipo === "movil";
  return true;
}

/** E.164 sin el `+`: el formato de teléfono que usa el bot (y wa.me). */
export function sinMas(telefonoE164: string): string {
  return telefonoE164.replace(/^\+/, "");
}

/** Enlace de chat directo. Solo tiene sentido para teléfonos tipo "movil". */
export function waMeUrl(telefonoE164: string): string {
  return `https://wa.me/${sinMas(telefonoE164)}`;
}
