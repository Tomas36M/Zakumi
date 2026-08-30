// Despacho de llamadas de Zak — la pieza compartida entre la server action
// del cockpit (llamarConZak, con sesión admin) y el endpoint /api/zak/llamar
// (el bot de WhatsApp con token, sin sesión). SOLO SERVIDOR.

import type { SupabaseClient } from "@supabase/supabase-js";
import { agenteZakVoz, contarLlamadasHoy, type AgenteVozFila } from "@/lib/admin/voz";
import { llamadaSaliente, type ErrorVoz } from "./api";
import { normalizarTelefono, payloadLlamadaUnica, type VariablesLlamada } from "./eleven";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ErrorVoz → español para el usuario (o para el modelo del bot). */
export function mensajeDe(error: ErrorVoz): string {
  switch (error) {
    case "sin_configurar":
      return "Falta ELEVENLABS_API_KEY en el servidor (ver .env.example).";
    case "sin_conexion":
      return "ElevenLabs no respondió. Inténtalo de nuevo en un momento.";
    case "no_autorizado":
      return "ElevenLabs rechazó la API key (¿scope ElevenAgents?).";
    case "no_existe":
      return "Ese recurso ya no existe en ElevenLabs.";
    case "peticion_invalida":
      return "ElevenLabs rechazó la configuración enviada.";
    case "plan_insuficiente":
      return "Esta voz exige un plan pago mayor de ElevenLabs — prueba otra (muchas son libres).";
    default:
      return "ElevenLabs devolvió un error inesperado.";
  }
}

function numeroSalienteDe(agente: AgenteVozFila): string | null {
  return agente.phone_number_id_eleven ?? process.env.ELEVENLABS_PHONE_NUMBER_ID ?? null;
}

/**
 * Zak marca a un prospecto con su agente de voz (es_zak). Valida agente,
 * número, teléfono E.164 y cap diario; si viene negocioId, la llamada queda
 * correlacionada en dynamic_variables y el negocio pasa de 'nuevo' a
 * 'contactado' (forward-only). Nunca lanza.
 */
export async function despacharLlamadaZak(
  supabase: SupabaseClient,
  datos: { telefono: string; nombreContacto?: string; negocioId?: string },
): Promise<{ conversationId: string | null } | { error: string }> {
  const agente = await agenteZakVoz(supabase);
  if (!agente) return { error: "Zak no tiene voz todavía — créala en /admin/voz." };
  if (!agente.agent_id_eleven) return { error: "Sincroniza a Zak en /admin/voz antes de llamar." };
  if (!agente.activo) return { error: "La voz de Zak está apagada." };

  const phoneNumberId = numeroSalienteDe(agente);
  if (!phoneNumberId) {
    return { error: "Sin número saliente: falta ELEVENLABS_PHONE_NUMBER_ID (interruptor del piloto)." };
  }

  const telefono = normalizarTelefono(typeof datos.telefono === "string" ? datos.telefono : "");
  if (!telefono) return { error: "Teléfono no válido (formato +57…)." };

  const negocioId =
    typeof datos.negocioId === "string" && UUID.test(datos.negocioId)
      ? datos.negocioId
      : undefined;
  const nombre =
    typeof datos.nombreContacto === "string" ? datos.nombreContacto.trim().slice(0, 120) : "";

  const hoy = await contarLlamadasHoy(supabase, agente.id);
  if (hoy === null) return { error: "No se pudo verificar el cap diario." };
  if (hoy + 1 > agente.cap_diario) {
    return { error: `Zak ya alcanzó su cap de ${agente.cap_diario} llamadas hoy.` };
  }

  const variables: VariablesLlamada = {
    agente_id: agente.id,
    origen: "zakumi_salida",
    telefono,
    ...(nombre ? { nombre_contacto: nombre } : {}),
    ...(negocioId ? { negocio_id: negocioId } : {}),
  };
  const r = await llamadaSaliente(
    payloadLlamadaUnica({
      agentIdEleven: agente.agent_id_eleven,
      phoneNumberId,
      telefono,
      variables,
    }),
  );
  if (!r.ok) return { error: mensajeDe(r.error) };

  if (negocioId) {
    const { error } = await supabase
      .from("negocios")
      .update({ estado: "contactado" })
      .eq("id", negocioId)
      .eq("estado", "nuevo");
    if (error) console.error("[despacharLlamadaZak] estado del negocio:", error.message);
  }

  return { conversationId: r.data.conversation_id };
}
