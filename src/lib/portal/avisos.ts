// Avisos por WhatsApp a uno o varios destinatarios (AVISOS_WHATSAPP_TO) usando
// el bot ya desplegado — cero infra nueva.
// SOLO SERVIDOR (envuelve lib/bots/api). Fire-and-forget: el contrato
// Resultado nunca lanza, así que un Railway caído jamás tumba la operación
// que originó el aviso (la solicitud igual queda en la bandeja del admin).

import { enviarManual, enviarPlantillaDirecta } from "@/lib/bots/api";
import { sinMas } from "@/lib/admin/telefono";

/** Una plantilla de utilidad aprobada en Meta y sus variables EN EL ORDEN del
 *  cuerpo aprobado. Existe porque Meta rechaza el texto libre a quien no le
 *  escribió al bot en las últimas 24 h (error 131047, "re-engagement"): el
 *  aviso a Tomás y Pau casi siempre cae fuera de esa ventana. */
export type PlantillaAviso = { nombre: string; variables: string[] };

/** Meta rechaza parámetros con saltos de línea, tabuladores o más de cuatro
 *  espacios seguidos, y no acepta vacíos. El tope es holgado: el cuerpo entero
 *  de una plantilla no puede pasar de 1.024 caracteres. */
const TOPE_VARIABLE = 300;

export function variablePlantilla(v: string | null | undefined): string {
  const t = (v ?? "").replace(/\s+/g, " ").trim();
  return t === "" ? "sin dato" : t.slice(0, TOPE_VARIABLE);
}

/** El `components` que espera Cloud API para una plantilla con variables solo
 *  en el cuerpo (el botón de URL es fijo y no viaja). */
export function componentesPlantilla(variables: string[]): unknown[] {
  return [
    {
      type: "body",
      parameters: variables.map((v) => ({ type: "text", text: variablePlantilla(v) })),
    },
  ];
}

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

/**
 * Con `plantilla`, intenta primero la plantilla de Meta (llega siempre) y solo
 * si esa falla —aún no aprobada, rechazada, Cloud API caído— cae al texto libre
 * de siempre, que llega si la ventana de 24 h está abierta. `texto` es además
 * lo que el bot guarda en la conversación para que el aviso se lea en la
 * bandeja del panel. Sin `plantilla` se comporta como siempre.
 */
export async function avisarAdmin(texto: string, plantilla?: PlantillaAviso): Promise<void> {
  const iid = Number(process.env.AVISOS_BOT_INSTANCIA_ID ?? "");
  const para = destinatarios(process.env.AVISOS_WHATSAPP_TO);
  if (!Number.isInteger(iid) || iid <= 0 || para.length === 0) {
    console.error("[avisos] faltan AVISOS_BOT_INSTANCIA_ID / AVISOS_WHATSAPP_TO — aviso no enviado");
    return;
  }
  // Secuencial y con el error aislado por número: que uno malo no deje al
  // otro sin aviso. El bot no tiene envío en lote, así que son N llamadas.
  for (const numero of para) {
    if (plantilla) {
      const p = await enviarPlantillaDirecta(iid, {
        telefono: numero,
        plantilla: plantilla.nombre,
        lang: "es",
        texto,
        componentes: componentesPlantilla(plantilla.variables),
      });
      if (p.ok) continue;
      console.error(
        `[avisos] plantilla ${plantilla.nombre} a ${numero} no salió (${p.error}); se intenta texto libre`,
      );
    }
    const r = await enviarManual(iid, numero, texto);
    if (!r.ok) {
      console.error(`[avisos] el aviso a ${numero} no salió:`, r.error);
    }
  }
}

/**
 * Un aviso AL LEAD (no a la casa): el WhatsApp de Zak le escribe a su número
 * cuando su reunión se agenda, se mueve o se cancela. Misma secuencia que
 * `avisarAdmin` —plantilla primero, texto libre de respaldo dentro de la
 * ventana de 24 h— pero un solo destinatario y DEVUELVE qué pasó: la acción
 * que lo pidió se lo dice al usuario en vez de prometer una entrega que no
 * puede garantizar. `telefonoE164` viene normalizado (+57…); el bot lo
 * quiere sin el «+».
 */
export async function avisarLead(
  telefonoE164: string,
  texto: string,
  plantilla?: PlantillaAviso,
): Promise<"enviado" | "fallo"> {
  const iid = Number(process.env.AVISOS_BOT_INSTANCIA_ID ?? "");
  if (!Number.isInteger(iid) || iid <= 0) {
    console.error("[avisos] falta AVISOS_BOT_INSTANCIA_ID — aviso al lead no enviado");
    return "fallo";
  }
  const numero = sinMas(telefonoE164);
  if (plantilla) {
    const p = await enviarPlantillaDirecta(iid, {
      telefono: numero,
      plantilla: plantilla.nombre,
      lang: "es",
      texto,
      componentes: componentesPlantilla(plantilla.variables),
    });
    if (p.ok) return "enviado";
    console.error(
      `[avisos] plantilla ${plantilla.nombre} al lead ${numero} no salió (${p.error}); se intenta texto libre`,
    );
  }
  const r = await enviarManual(iid, numero, texto);
  if (!r.ok) {
    console.error(`[avisos] el aviso al lead ${numero} no salió:`, r.error);
    return "fallo";
  }
  return "enviado";
}
