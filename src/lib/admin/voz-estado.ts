// Qué tan lista está la voz de Zak para "Llamar con IA". Puro: lo calcula
// cualquier page (Zak, Prospección, Territorios) a partir de la fila de
// `agentes_voz` y de si hay número saliente en el entorno — sin tocar
// ElevenLabs. Cada rechazo lleva su remedio en `BotonLlamarZak`.

import type { AgenteVoz } from "@/lib/voz/tipos";

export type EstadoVozZak = "lista" | "sin_numero" | "apagada" | "sin_sincronizar" | "sin_agente";

export function estadoVozZak(
  agente: Pick<AgenteVoz, "agent_id_eleven" | "activo" | "phone_number_id_eleven"> | null,
  /** `ELEVENLABS_PHONE_NUMBER_ID` presente: el número saliente del piloto. */
  telefoniaEnv: boolean,
): EstadoVozZak {
  if (!agente) return "sin_agente";
  if (!agente.agent_id_eleven) return "sin_sincronizar";
  if (!agente.activo) return "apagada";
  return telefoniaEnv || Boolean(agente.phone_number_id_eleven) ? "lista" : "sin_numero";
}
