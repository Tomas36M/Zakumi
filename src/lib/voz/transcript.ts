// La transcripción de una llamada llega por DOS puertas con el mismo shape:
// el webhook post-call (`data.transcript`, la verdad completa al colgar) y el
// GET de la conversación en vivo (`transcript`, parcial y creciendo). Un solo
// parser para las dos — dos copias de esto terminarían divergiendo, y lo que
// se guarda en `llamadas_voz.transcript` tiene que ser lo mismo que se pinta
// mientras la llamada pasa.
//
// Sin "use server" ni "server-only" a propósito: es puro y el tipo lo importan
// también componentes de cliente.

/** Un turno: quién habló y qué dijo. `message` null = turno sin texto. */
export type TurnoTranscript = { role: string; message: string | null };

/**
 * Parser PURO y tolerante. Devuelve `null` cuando lo que llegó no es un array
 * —campo ausente, json raro— que NO es lo mismo que `[]`: el array vacío es
 * una llamada que existe y en la que todavía nadie dijo nada.
 *
 * Un turno que no es objeto se descarta; uno sin `role` cae a "desconocido" y
 * uno sin texto conserva su fila con `message: null`. Mismo criterio
 * defensivo que el resto del parseo de voz: un shape inesperado del proveedor
 * no puede tumbar ni el webhook ni el polling.
 */
export function parseTurnos(crudo: unknown): TurnoTranscript[] | null {
  if (!Array.isArray(crudo)) return null;
  return crudo
    .filter(
      (t): t is Record<string, unknown> =>
        typeof t === "object" && t !== null && !Array.isArray(t),
    )
    .map((t) => ({
      role: typeof t.role === "string" && t.role.trim() !== "" ? t.role : "desconocido",
      message: typeof t.message === "string" ? t.message : null,
    }));
}
