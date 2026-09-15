import type { Negocio } from "./negocios";

/**
 * Resultado del último fetch de la ficha de un negocio para el modal del chat
 * de Zak (GET /admin/api/negocios/[id]). `negocio: null` con `fallo: false`
 * es la ruta respondiendo bien sin fila: el negocio ya no existe.
 */
export type FichaFetch = { leadId: string; negocio: Negocio | null; fallo: boolean };

/** Lo que el modal necesita saber, derivado del id abierto y del último fetch. */
export type EstadoFicha = {
  negocio: Negocio | null;
  cargando: boolean;
  fallo: boolean;
  noExiste: boolean;
};

/**
 * El fetch "vigente" es el que coincide con el id abierto ahora mismo. Sin id
 * abierto no hay ficha. Con id abierto y sin fetch que coincida, se está
 * cargando: nunca se muestra el negocio de otro id. Derivado y no guardado
 * como estado, para que el efecto que hace el fetch no tenga que hacer
 * setState síncrono al abrir o cerrar (react-hooks/set-state-in-effect).
 */
export function estadoFicha(leadId: string | null, ultimo: FichaFetch | null): EstadoFicha {
  const vigente = leadId !== null && ultimo?.leadId === leadId ? ultimo : null;
  return {
    negocio: vigente?.negocio ?? null,
    cargando: leadId !== null && vigente === null,
    fallo: vigente?.fallo ?? false,
    noExiste: vigente !== null && !vigente.fallo && vigente.negocio === null,
  };
}
