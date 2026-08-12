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
  // longitud exacta de indicativo + número nacional (12 dígitos).
  let nacional: string | null = null;
  if (digitos.startsWith("57") && digitos.length === 12) {
    nacional = digitos.slice(2);
  } else if (digitos.length === 10) {
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

/** Enlace de chat directo. Solo tiene sentido para teléfonos tipo "movil". */
export function waMeUrl(telefonoE164: string): string {
  return `https://wa.me/${telefonoE164.replace(/^\+/, "")}`;
}
