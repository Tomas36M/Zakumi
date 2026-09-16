// Qué dicen las conversaciones de Zak sobre el estado de cada negocio del CRM.
// Lógica pura: el cruce es por teléfono (el bot guarda los dígitos completos,
// sin +; el CRM, E.164) y el avance es forward-only y respeta el candado
// manual. Cubre los chats que no salieron de una tanda: los abiertos uno por
// uno desde la ficha o con «+ Nuevo chat», que la sincronización por
// prospectos nunca veía.

import type { EstadoNegocio } from "./negocios";
import { normalizarTelefonoCO } from "./telefono";
import type { AvanceEstado } from "./zak";

export type NegocioSync = {
  id: string;
  telefono: string | null;
  estado: EstadoNegocio;
  estado_fijado_manual: boolean;
};

/** El teléfono de un chat del bot en el formato del CRM, o null si no es un
 * teléfono (por ejemplo, las sesiones del Labs). El bot guarda los dígitos con
 * el indicativo y sin +: se lo pone antes de normalizar, así un número de otro
 * país no se pierde. */
export function e164DeChat(telefonoBot: string): string | null {
  const conMas = telefonoBot.startsWith("+") ? telefonoBot : `+${telefonoBot}`;
  return normalizarTelefonoCO(conMas).telefono;
}

/** Varios negocios pueden compartir teléfono (sucursales de una cadena): el
 * chat es de todos ellos. */
function porTelefono(negocios: readonly NegocioSync[]): Map<string, NegocioSync[]> {
  const mapa = new Map<string, NegocioSync[]>();
  for (const n of negocios) {
    if (!n.telefono) continue;
    const lista = mapa.get(n.telefono) ?? [];
    lista.push(n);
    mapa.set(n.telefono, lista);
  }
  return mapa;
}

function negociosDelChat(telefonoBot: string, mapa: Map<string, NegocioSync[]>): NegocioSync[] {
  const telefono = e164DeChat(telefonoBot);
  return telefono ? (mapa.get(telefono) ?? []) : [];
}

/** Ni fijado a mano, ni cliente, ni descartado: la automatización puede moverlo. */
function libre(n: NegocioSync): boolean {
  return !n.estado_fijado_manual && n.estado !== "cliente" && n.estado !== "descartado";
}

const PUEDE_LLEGAR_A_RESPONDIDO: readonly EstadoNegocio[] = ["nuevo", "contactado"];

/**
 * Los chats cuyo historial hay que pedir, en el orden de la bandeja y hasta
 * `maximo`. Todo negocio en «Nuevo» (un chat de un solo mensaje puede ser el
 * saludo de Zak o el negocio escribiendo primero: solo el historial lo dice) y
 * los «Contactado» con más de un mensaje (con uno solo, es el saludo que ya lo
 * dejó ahí).
 */
export function chatsParaHistorial(
  chats: readonly { telefono: string; mensajes: number }[],
  negocios: readonly NegocioSync[],
  maximo: number = Number.POSITIVE_INFINITY,
): string[] {
  const mapa = porTelefono(negocios);
  return chats
    .filter((c) =>
      negociosDelChat(c.telefono, mapa).some(
        (n) => libre(n) && (n.estado === "nuevo" || (n.estado === "contactado" && c.mensajes >= 2)),
      ),
    )
    .map((c) => c.telefono)
    .slice(0, maximo);
}

/** Avances por chat. `respondio`: true si el negocio escribió, false si solo
 * escribió Zak, null si no se consultó su historial (entonces no se mueve).
 * Escribió → «Respondió» (desde Nuevo o Contactado); solo Zak → «Contactado»
 * (desde Nuevo). */
export function avancesDesdeChats(
  chats: readonly { telefono: string; respondio: boolean | null }[],
  negocios: readonly NegocioSync[],
): AvanceEstado[] {
  const mapa = porTelefono(negocios);
  const avances: AvanceEstado[] = [];
  for (const c of chats) {
    if (c.respondio === null) continue;
    for (const n of negociosDelChat(c.telefono, mapa)) {
      if (!libre(n)) continue;
      if (c.respondio && PUEDE_LLEGAR_A_RESPONDIDO.includes(n.estado)) {
        avances.push({ id: n.id, a: "respondido" });
      } else if (!c.respondio && n.estado === "nuevo") {
        avances.push({ id: n.id, a: "contactado" });
      }
    }
  }
  return avances;
}

export type RespuestaHistorial = {
  /** Veredicto del bot: true persona, false solo contestadora, null sin prospecto o bot viejo. */
  humano: boolean | null;
  ultimo_del_cliente: string | null;
  messages: readonly { role: "user" | "assistant" }[];
};

/** Si el negocio respondió como PERSONA. Con veredicto del bot, manda el
 * veredicto; sin él, la regla de siempre: cualquier mensaje del cliente. */
export function respondioSegunHistorial(h: RespuestaHistorial): boolean {
  if (h.humano === true) return true;
  if (h.humano === false) return false;
  return h.ultimo_del_cliente !== null || h.messages.some((m) => m.role === "user");
}
