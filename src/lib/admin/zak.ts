// Lógica pura de la prospección de Zak (testeable en vitest node).
// Zak abre leads: Tomás selecciona negocios del CRM, Zak les manda la
// plantilla y conversa con contexto. Aquí viven las reglas de quién es
// contactable y cómo avanzan los estados del CRM — nunca hacia atrás.

import type { EstadoNegocio, Negocio } from "./negocios";
import type { Prospecto } from "@/lib/bots/tipos";

/** A quién se le puede mandar la plantilla: celular real y que no sea ya
 * cliente ni descartado (a un cliente no se le prospecta en frío). */
export function contactables(negocios: Negocio[]): Negocio[] {
  return negocios.filter(
    (n) =>
      n.telefono !== null &&
      n.tipo_telefono === "movil" &&
      n.estado !== "cliente" &&
      n.estado !== "descartado",
  );
}

/**
 * Los components de la plantilla saludo_zakumi para este negocio.
 * La plantilla quedó SIN variables (verificado 20 ago 2026) → null.
 * Si Meta algún día la aprueba con {{1}}, aquí se arma el body —
 * el bot los reenvía tal cual y no hay que tocarlo.
 */
export function componentesSaludo(_negocio: Negocio): unknown[] | null {
  return null;
}

export type AvanceEstado = { id: string; a: EstadoNegocio };

/**
 * Qué negocios del CRM deben avanzar de estado según su prospecto.
 * Forward-only: jamás retrocede (interesado no vuelve a respondido),
 * jamás toca cliente ni descartado. El match es por negocio_id — para
 * eso se guardó en el prospecto.
 */
export function avancesDeEstado(
  prospectos: Prospecto[],
  actuales: { id: string; estado: EstadoNegocio }[],
): AvanceEstado[] {
  const porNegocio = new Map(
    prospectos
      .filter((p) => p.negocio_id !== null)
      .map((p) => [p.negocio_id as string, p]),
  );
  const avances: AvanceEstado[] = [];
  for (const n of actuales) {
    const p = porNegocio.get(n.id);
    if (!p) continue;
    if (n.estado === "cliente" || n.estado === "descartado") continue;
    if (p.interesado && n.estado !== "interesado") {
      avances.push({ id: n.id, a: "interesado" });
    } else if (
      p.estado_envio === "respondido" &&
      (n.estado === "nuevo" || n.estado === "contactado")
    ) {
      avances.push({ id: n.id, a: "respondido" });
    }
  }
  return avances;
}
