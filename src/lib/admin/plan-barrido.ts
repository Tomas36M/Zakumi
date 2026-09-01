import { claveTrabajo, subdividir, teselar, PROFUNDIDAD_MAX, type Tesela } from "./barrido";
import type { ResumenTesela } from "./barrido-servidor";
import type { Territorio } from "./territorios";

export type Trabajo = {
  tesela: Tesela;
  vertical: string;
  profundidad: number;
  clave: string;
};

export type ResumenBarrido = {
  encontrados: number;
  fueraDelArea: number;
  sinTelefono: number;
  insertados: number;
  saturadasAlFondo: number;
  /** Teselas que se cobraron y guardaron pero cuya anotación en el territorio
   * falló. Callar un cobro no contabilizado es mentir sobre el gasto. */
  sinContabilizar: number;
};

/** La cola de trabajo de un barrido: una tesela por vertical, saltando lo que
 * ya se barrió. Reanudar es gratis; volver a empezar cuesta plata.
 *
 * Solo mira `territorio.teselas_hechas` — es responsabilidad de quien llama
 * (useBarrido) restar además lo que YA barrió esta misma sesión del navegador
 * pero que el prop todavía no refleja porque el refresh no ha aterrizado. */
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

/** Suma el resultado de una tesela al resumen corrido de un barrido.
 * `profundidad` es la del trabajo que se acaba de procesar (no la de sus
 * hijas si se subdividió), para decidir si una saturación quedó sin resolver
 * por tope de partición. Pura: nada de red, nada de estado de React. */
export function acumularResumen(
  previo: ResumenBarrido,
  r: ResumenTesela,
  profundidad: number,
): ResumenBarrido {
  return {
    encontrados: previo.encontrados + r.encontrados,
    fueraDelArea: previo.fueraDelArea + r.fueraDelArea,
    sinTelefono: previo.sinTelefono + r.sinTelefono,
    insertados: previo.insertados + r.insertados,
    saturadasAlFondo:
      previo.saturadasAlFondo + (r.saturada && profundidad >= PROFUNDIDAD_MAX ? 1 : 0),
    sinContabilizar: previo.sinContabilizar + (r.contabilizada ? 0 : 1),
  };
}

/** Las 4 teselas en las que se parte una celda saturada, para la MISMA
 * vertical y una profundidad más. Vacío si el trabajo ya está en el tope de
 * partición — ahí la saturación queda contabilizada (saturadasAlFondo), no
 * resuelta. */
export function hijasDe(t: Trabajo): Trabajo[] {
  if (t.profundidad >= PROFUNDIDAD_MAX) return [];
  return subdividir(t.tesela).map((tesela) => ({
    tesela,
    vertical: t.vertical,
    profundidad: t.profundidad + 1,
    clave: claveTrabajo(tesela, t.vertical),
  }));
}
