import { claveTrabajo, teselar, type Tesela } from "./barrido";
import type { Territorio } from "./territorios";

export type Trabajo = {
  tesela: Tesela;
  vertical: string;
  profundidad: number;
  clave: string;
};

/** La cola de trabajo de un barrido: una tesela por vertical, saltando lo que
 * ya se barrió. Reanudar es gratis; volver a empezar cuesta plata. */
export function planDeBarrido(
  territorio: Territorio,
  verticales: readonly string[],
): Trabajo[] {
  const hechas = new Set(territorio.teselas_hechas ?? []);
  const teselas = teselar(territorio.poligono);
  const plan: Trabajo[] = [];
  for (const tesela of teselas) {
    for (const vertical of verticales) {
      const clave = claveTrabajo(tesela, vertical);
      if (hechas.has(clave)) continue;
      plan.push({ tesela, vertical, profundidad: 0, clave });
    }
  }
  return plan;
}
