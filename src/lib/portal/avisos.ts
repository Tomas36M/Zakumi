// Avisos a Tomás por WhatsApp usando el bot ya desplegado — cero infra nueva.
// SOLO SERVIDOR (envuelve lib/bots/api). Fire-and-forget: el contrato
// Resultado nunca lanza, así que un Railway caído jamás tumba la operación
// que originó el aviso (la solicitud igual queda en la bandeja del admin).

import { enviarManual } from "@/lib/bots/api";

export async function avisarAdmin(texto: string): Promise<void> {
  const iid = Number(process.env.AVISOS_BOT_INSTANCIA_ID ?? "");
  const para = (process.env.AVISOS_WHATSAPP_TO ?? "").trim();
  if (!Number.isInteger(iid) || iid <= 0 || !para) {
    console.error("[avisos] faltan AVISOS_BOT_INSTANCIA_ID / AVISOS_WHATSAPP_TO — aviso no enviado");
    return;
  }
  const r = await enviarManual(iid, para, texto);
  if (!r.ok) {
    console.error("[avisos] el aviso no salió:", r.error);
  }
}
