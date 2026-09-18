// La cola de llamadas de Zak: negocios a los que les escribimos y de los que
// solo contestó su MÁQUINA (horario, menú, «gracias por tu mensaje»).
//
// Desde el 18 sep 2026 el bot se calla con esas contestadoras
// (whatsapp-bot/app.py + el job de tipo 'contestadora'), así que estos números
// no van a avanzar solos por WhatsApp: al dueño hay que llamarlo. La cola es
// esa lista, y NO llama sola — cada llamada la dispara Tomás desde la fila.
//
// Lógica pura (vitest node): no sabe de red ni de Supabase. Quien la llena es
// el route handler /admin/api/zak/cola-voz.

import type { FichaNegocio } from "./zak";

/** Lo que la cola necesita de una conversación del bot. */
export type ConversacionCola = {
  /** Formato del bot (573…), que es la llave del cruce con el CRM. */
  phone: string;
  /** Veredicto del bot: true persona, false solo máquina, null sin prospecto. */
  humano: boolean | null;
  contestadora: boolean;
  /** Cuándo escribió por última vez el del otro lado (su máquina, acá). */
  ultimo_del_cliente: string | null;
};

export type FilaCola = {
  /** Formato del bot: con esto se abre su chat en la bandeja. */
  telefono: string;
  /** E.164 (+57…), que es lo que necesita la llamada. */
  telefonoE164: string;
  nombre: string | null;
  verticalLabel: string | null;
  estado: FichaNegocio["estado"] | null;
  negocioId: string | null;
  /** Cuándo contestó su máquina. */
  contestoEn: string | null;
  /** ISO de la última llamada de Zak a este número, o null si nunca. */
  ultimaLlamada: string | null;
};

/**
 * ¿Este chat va a la cola? Solo ha contestado la máquina: en cuanto escribe
 * una persona sale (esa conversación la sigue Zak por WhatsApp, que es más
 * barato que una llamada). Mismo criterio que el filtro «🤖 Contestadora» de
 * la bandeja — una sola definición de «solo contestó la máquina» en el panel.
 */
export function esDeCola(c: ConversacionCola): boolean {
  return c.contestadora && c.humano !== true;
}

/**
 * La cola lista para pintar. Quien nunca ha recibido llamada va PRIMERO (es la
 * plata que no se ha gastado), y dentro de cada grupo manda la contestadora más
 * reciente: el negocio que acaba de leernos es el que mejor se acuerda.
 *
 * Un teléfono sin ficha en el CRM entra igual: se puede llamar sin saber quién
 * es, y esconderlo sería esconder trabajo pendiente.
 */
export function construirCola(
  conversaciones: readonly ConversacionCola[],
  /** Fichas del CRM indexadas por teléfono en formato del bot. */
  fichas: Readonly<Record<string, FichaNegocio>>,
  /** Última llamada por teléfono en formato del bot (ISO). */
  ultimaLlamadaPor: Readonly<Record<string, string>>,
): FilaCola[] {
  return conversaciones
    .filter(esDeCola)
    .map((c) => {
      const ficha = fichas[c.phone];
      return {
        telefono: c.phone,
        telefonoE164: ficha?.telefono ?? `+${c.phone}`,
        nombre: ficha?.nombre ?? null,
        verticalLabel: ficha?.verticalLabel ?? null,
        estado: ficha?.estado ?? null,
        negocioId: ficha?.negocioId ?? null,
        contestoEn: c.ultimo_del_cliente,
        ultimaLlamada: ultimaLlamadaPor[c.phone] ?? null,
      };
    })
    .sort((a, b) => {
      if ((a.ultimaLlamada === null) !== (b.ultimaLlamada === null)) {
        return a.ultimaLlamada === null ? -1 : 1;
      }
      return (b.contestoEn ?? "").localeCompare(a.contestoEn ?? "");
    });
}
