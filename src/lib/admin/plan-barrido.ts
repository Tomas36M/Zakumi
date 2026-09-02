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
  /** Teselas que NO se barrieron: la sesión venció, la key está mal, el insert
   * reventó, la red se cayó dos veces. Sin este contador todas "terminaban" y
   * la barra llegaba al 100% sobre un resumen en ceros — que se lee como
   * "aquí no hay nada" en vez de "esto no se llegó a mirar". */
  fallidas: number;
};

/** La cola de trabajo de un barrido: una tesela por vertical, saltando lo que
 * ya se barrió, y BAJANDO a las hijas de las celdas que saturaron.
 *
 * El descenso es lo que hace que la subdivisión sobreviva a cerrar la pestaña.
 * Una celda saturada queda anotada a la vez en `teselas_hechas` (ya se pagó) y
 * en `teselas_saturadas` (hay negocios que no se vieron): sin mirar la segunda,
 * el plan salta la madre por hecha, nunca regenera las 4 hijas, y el barrido
 * siguiente reporta 100% sobre las manzanas MÁS densas sin haberlas mirado.
 *
 * Barrer esas hijas es gasto NUEVO, no gasto repetido: son teselas que nadie
 * le compró todavía a Google. La promesa de "reanudar sin volver a pagar"
 * sigue en pie — lo ya comprado se salta por `teselas_hechas`, hija incluida.
 *
 * Las hijas se derivan de la tesela EXACTA (no de la clave, que redondea a 5
 * decimales), así que las claves que produce este descenso son idénticas a las
 * que produjo la subdivisión en vivo y `teselas_hechas` las reconoce.
 *
 * Solo mira el territorio — es responsabilidad de quien llama (useBarrido)
 * restar además lo que YA barrió esta misma sesión del navegador pero que el
 * prop todavía no refleja porque el refresh no ha aterrizado.
 *
 * `teselas` se puede pasar ya calculada: el diálogo de estimación la memoiza
 * (teselar recorre la caja celda por celda) y necesita contar EXACTAMENTE este
 * plan, no una aproximación paralela — si el diálogo contara distinto, el
 * botón "Barrer" se apagaría con hijas pendientes por recuperar. */
export function planDeBarrido(
  territorio: Territorio,
  verticales: readonly string[],
  teselas: readonly Tesela[] = teselar(territorio.poligono),
): Trabajo[] {
  const hechas = new Set(territorio.teselas_hechas ?? []);
  const saturadas = new Set(territorio.teselas_saturadas ?? []);
  const plan: Trabajo[] = [];

  function expandir(t: Trabajo): void {
    if (saturadas.has(t.clave)) {
      // Saturada ⇒ ya barrida y ya cobrada (el mismo RPC anota las dos cosas).
      // Lo que falta son sus hijas, que se recorren igual: una hija que también
      // saturó baja otro nivel, una que ya está hecha se salta sola.
      for (const hija of hijasDe(t)) expandir(hija);
      return;
    }
    if (hechas.has(t.clave)) return;
    plan.push(t);
  }

  for (const tesela of teselas) {
    for (const vertical of verticales) {
      expandir({ tesela, vertical, profundidad: 0, clave: claveTrabajo(tesela, vertical) });
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
    // Una tesela que respondió no falló. `fallidas` solo lo mueve
    // `acumularFallida`, desde los caminos donde no hay ResumenTesela ninguno.
    fallidas: previo.fallidas,
  };
}

/** Suma una tesela que NO se pudo barrer. `cobrada` distingue el caso en el
 * que Google ya facturó la llamada y lo que reventó fue nuestro insert: ahí
 * hay plata gastada que el contador del territorio no registró, y eso se
 * cuenta también como `sinContabilizar`. Pura, igual que `acumularResumen`. */
export function acumularFallida(
  previo: ResumenBarrido,
  cobrada = false,
): ResumenBarrido {
  return {
    ...previo,
    fallidas: previo.fallidas + 1,
    sinContabilizar: previo.sinContabilizar + (cobrada ? 1 : 0),
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

/** El plan recortado a lo que quepa en la cuota gratuita que queda.
 *
 * Corta por el final y respeta el orden, que importa: `expandir` recorre en
 * profundidad, así que las hijas pendientes de una celda saturada salen JUNTO A
 * SU MADRE, repartidas por todo el plan en vez de agrupadas al principio.
 * Recortar por el final se lleva menos de esas hijas que recortar por el
 * principio, y son lo más caro de aplazar: cada una es una manzana densa cuya
 * madre ya se pagó y que sigue sin censar. Aplazar, no perder — desde que la
 * saturación queda anotada en `teselas_saturadas`, el plan del mes que viene
 * vuelve a bajar a ellas. */
export function recortarACuota(
  plan: readonly Trabajo[],
  restantes: number,
): Trabajo[] {
  const cabe = Number.isFinite(restantes) && restantes > 0 ? Math.floor(restantes) : 0;
  return plan.slice(0, cabe);
}
