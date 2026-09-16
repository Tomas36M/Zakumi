// Los filtros de la bandeja de Zak. Lógica pura (vitest node): recorta la
// página YA CARGADA de conversaciones, que es lo único que la bandeja tiene en
// la mano. La UI dice sobre cuántas filtra — un filtro que insinúa que mira
// toda la historia es un filtro que miente.

import type { FichaNegocio } from "./zak";
import { noLeidos, type Visto } from "./vivo";

export type FiltroBandeja =
  | "todos"
  | "sin_leer"
  | "respondieron"
  | "interesados"
  | "contestadora";

export const FILTROS_BANDEJA: readonly { valor: FiltroBandeja; label: string }[] = [
  { valor: "todos", label: "Todos" },
  { valor: "sin_leer", label: "Sin leer" },
  { valor: "respondieron", label: "Respondieron" },
  { valor: "interesados", label: "Interesados" },
  { valor: "contestadora", label: "🤖 Contestadora" },
];

/** Lo que cada fila de la bandeja necesita para decidir si pasa el filtro. */
export type FilaBandeja = {
  phone: string;
  /** Mensajes que escribió EL CLIENTE (0 = solo habló Zak). */
  messages_cliente: number;
  /** Cuándo escribió por última vez: con `messages_cliente` decide los no-leídos. */
  ultimo_del_cliente: string | null;
  /** Veredicto del bot: true persona, false solo contestadora, null sin clasificar. */
  humano: boolean | null;
  contestadora: boolean;
};

/**
 * Si una conversación pasa el filtro. `ficha` es su negocio en el CRM (puede
 * faltar: un número suelto no tiene estado) y `visto` su marca de leído.
 */
export function pasaFiltro(
  c: FilaBandeja,
  filtro: FiltroBandeja,
  ficha: FichaNegocio | undefined,
  sinLeer: number,
): boolean {
  switch (filtro) {
    case "todos":
      return true;
    case "sin_leer":
      return sinLeer > 0;
    case "respondieron":
      // Escribió el cliente, sea persona o su contestadora: eso es lo que dice
      // la bandeja. Quién fue lo distingue el chip de contestadora.
      return c.messages_cliente > 0;
    case "interesados":
      return ficha?.estado === "interesado";
    case "contestadora":
      // Solo ha contestado la máquina: en cuanto escribe una persona, sale.
      return c.contestadora && c.humano !== true;
  }
}

/** La página cargada, recortada por el filtro. Conserva el orden de la bandeja. */
export function filtrarBandeja<T extends FilaBandeja>(
  conversaciones: readonly T[],
  filtro: FiltroBandeja,
  fichas: Record<string, FichaNegocio>,
  vistos: Record<string, Visto>,
): T[] {
  if (filtro === "todos") return [...conversaciones];
  return conversaciones.filter((c) =>
    pasaFiltro(c, filtro, fichas[c.phone], noLeidos(c, vistos[c.phone])),
  );
}
