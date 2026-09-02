// Avisos por WhatsApp a uno o varios destinatarios (AVISOS_WHATSAPP_TO) usando
// el bot ya desplegado — cero infra nueva.
// SOLO SERVIDOR (envuelve lib/bots/api). Fire-and-forget: el contrato
// Resultado nunca lanza, así que un Railway caído jamás tumba la operación
// que originó el aviso (la solicitud igual queda en la bandeja del admin).

import { enviarManual } from "@/lib/bots/api";

/**
 * `AVISOS_WHATSAPP_TO` acepta una lista separada por comas. Un valor viejo
 * (un solo número) sigue funcionando: partir "573..." por comas da una lista
 * de uno. Se deduplica para que un copy-paste no mande el aviso dos veces.
 */
export function destinatarios(crudo: string | undefined): string[] {
  return [
    ...new Set(
      (crudo ?? "")
        .split(",")
        .map((n) => n.trim())
        .filter((n) => n !== ""),
    ),
  ];
}

export async function avisarAdmin(texto: string): Promise<void> {
  const iid = Number(process.env.AVISOS_BOT_INSTANCIA_ID ?? "");
  const para = destinatarios(process.env.AVISOS_WHATSAPP_TO);
  if (!Number.isInteger(iid) || iid <= 0 || para.length === 0) {
    console.error("[avisos] faltan AVISOS_BOT_INSTANCIA_ID / AVISOS_WHATSAPP_TO — aviso no enviado");
    return;
  }
  // Secuencial y con el error aislado por número: que uno malo no deje al
  // otro sin aviso. El bot no tiene envío en lote, así que son N llamadas.
  for (const numero of para) {
    const r = await enviarManual(iid, numero, texto);
    if (!r.ok) {
      console.error(`[avisos] el aviso a ${numero} no salió:`, r.error);
    }
  }
}
