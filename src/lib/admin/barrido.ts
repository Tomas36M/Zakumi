// Geometría del barrido de territorios. Todo aquí es puro y sin red: es donde
// vive el riesgo (un hueco en la rejilla = censo incompleto; una celda de más
// = plata quemada en Google).

export type Punto = { lat: number; lng: number };
export type Caja = { sur: number; norte: number; oeste: number; este: number };
export type Tesela = { centro: Punto; radio: number; clave: string };
export type Estimacion = {
  llamadas: number;
  costoUsd: number;
  llamadasMax: number;
  costoMaxUsd: number;
};

/** Radio en metros de la tesela base. 400 m ≈ 31 celdas para el casco de Madrid. */
export const RADIO_BASE = 400;

/** Nearby Search (New) devuelve máximo 20 resultados y NO pagina. Verificado
 * contra la doc el 2026-08-31: si vuelven 20, hay negocios que no vimos. */
export const TOPE_NEARBY = 20;

/** Cuántas veces se puede partir una celda saturada. Acota el gasto: una celda
 * con profundidad 2 cuesta como máximo 1 + 4 + 16 llamadas por vertical. */
export const PROFUNDIDAD_MAX = 2;

/** Nearby Search Enterprise = US$35/1.000 llamadas (verificado 2026-08-31). */
export const PRECIO_POR_LLAMADA_USD = 0.035;

/** Consultas que Google no cobra cada mes en este SKU. Verificado el
 * 2026-09-01 en la tabla de precios de Maps Platform: SKU "Places API Nearby
 * Search Enterprise" (772E-9975-BE34), Free Usage Cap 1.000. Si Google la
 * cambia, se cambia acá. */
export const CUOTA_GRATIS_MENSUAL = 1_000;

export type EstadoCuota = {
  consumidas: number;
  restantes: number;
  agotada: boolean;
};

/** Lo que queda de cuota. Nunca negativo: pasarse no genera deuda, solo
 * significa que a partir de ahí todo se paga. */
export function restanteDeCuota(consumidas: number): number {
  const usadas = Number.isFinite(consumidas) && consumidas > 0 ? consumidas : 0;
  return Math.max(0, CUOTA_GRATIS_MENSUAL - usadas);
}

export function estadoDeCuota(consumidas: number): EstadoCuota {
  const restantes = restanteDeCuota(consumidas);
  const usadas = Number.isFinite(consumidas) && consumidas > 0 ? consumidas : 0;
  return { consumidas: usadas, restantes, agotada: restantes === 0 };
}

/** Margen sobre la estimación base por la subdivisión adaptativa. */
export const FACTOR_DENSIDAD = 1.4;

export const METROS_POR_GRADO_LAT = 111_320;

function metrosPorGradoLng(lat: number): number {
  return METROS_POR_GRADO_LAT * Math.cos((lat * Math.PI) / 180);
}

/** Ray casting. El borde exacto queda indefinido a propósito: los resultados
 * de Places nunca caen justo sobre la línea que dibujó un humano. */
export function puntoEnPoligono(p: Punto, poligono: readonly Punto[]): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i];
    const b = poligono[j];
    if (a.lat > p.lat === b.lat > p.lat) continue;
    const lngCorte = ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng;
    if (p.lng < lngCorte) dentro = !dentro;
  }
  return dentro;
}

export function cajaDe(poligono: readonly Punto[]): Caja {
  const lats = poligono.map((p) => p.lat);
  const lngs = poligono.map((p) => p.lng);
  return {
    sur: Math.min(...lats),
    norte: Math.max(...lats),
    oeste: Math.min(...lngs),
    este: Math.max(...lngs),
  };
}

/** Las cuatro esquinas de una caja arrastrada sobre el mapa, como polígono.
 *
 * El modo rectángulo del dibujo es un arrastre: el usuario suelta el ratón y el
 * área queda cerrada. Pero el modelo de datos sigue siendo `Punto[]` — nada
 * río abajo (validación, teselado, servidor, Supabase) aprende una forma nueva.
 * Esta es la única traducción, y por eso es pura y está probada.
 *
 * Las esquinas llegan en CUALQUIER orden (se arrastra de derecha a izquierda y
 * de abajo hacia arriba tanto como al revés): se normalizan a min/max y se
 * devuelven recorriendo el rectángulo SO → SE → NE → NO. Ese recorrido importa:
 * un orden que zigzagueara entre esquinas opuestas haría saltar
 * `poligonoSeCruza` sobre un rectángulo perfecto — un falso positivo en el modo
 * por defecto.
 *
 * Devuelve `null` si el arrastre no encerró área (un clic sin mover, o una
 * línea): un territorio de área cero pasaría `poligonoValido` y quedaría
 * guardado como un área invisible que no se puede ni ver ni barrer.
 *
 * No contempla el antimeridiano, igual que `cajaDe`: el mercado es Colombia. */
export function rectanguloAPuntos(a: Punto, b: Punto): Punto[] | null {
  const sur = Math.min(a.lat, b.lat);
  const norte = Math.max(a.lat, b.lat);
  const oeste = Math.min(a.lng, b.lng);
  const este = Math.max(a.lng, b.lng);
  // Con `>` (y no `!==`) un NaN también cae aquí: Math.min/max lo propagan.
  if (!(norte > sur) || !(este > oeste)) return null;
  return [
    { lat: sur, lng: oeste },
    { lat: sur, lng: este },
    { lat: norte, lng: este },
    { lat: norte, lng: oeste },
  ];
}

function orientacion(a: Punto, b: Punto, c: Punto): number {
  return (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
}

/** Cruce propio de dos segmentos (colineales y roces no cuentan: los cubren
 * las pruebas de vértices y esquinas de celdaTocaPoligono). */
function segmentosCruzan(a1: Punto, a2: Punto, b1: Punto, b2: Punto): boolean {
  const d1 = orientacion(b1, b2, a1);
  const d2 = orientacion(b1, b2, a2);
  const d3 = orientacion(a1, a2, b1);
  const d4 = orientacion(a1, a2, b2);
  return d1 > 0 !== d2 > 0 && d3 > 0 !== d4 > 0;
}

/** ¿El polígono se cruza consigo mismo (un "moño", o un trazo que se dobla
 * sobre lo ya dibujado)?
 *
 * Importa porque `puntoEnPoligono` es par-impar, y en un contorno cruzado el
 * par-impar deja de coincidir con lo que se ve: **la zona que el trazo cubre
 * dos veces se lee como FUERA**. `celdaTocaPoligono` sí genera teselas ahí (el
 * borde las toca), se le compran a Google y `recortarAlArea` tira todos sus
 * resultados — el barrido termina en 100 % sobre una zona que jamás censó, que
 * es exactamente el fallo que esta pantalla existe para no cometer. El gasto sí
 * queda acotado (`cajaDe` es min/max sobre los vértices, así que un cruce solo
 * puede dar MENOS teselas que su caja): es un problema de censo, no de plata.
 *
 * O(n²) sobre los ≤500 vértices que deja pasar `poligonoValido`: 125.000
 * pruebas de orientación en el peor caso, y un trazo a mano no pasa de decenas.
 * Las aristas vecinas se saltan: compartir un vértice no es cruzarse. */
export function poligonoSeCruza(poligono: readonly Punto[]): boolean {
  const n = poligono.length;
  // Con tres lados no hay dos aristas no vecinas que puedan cruzarse.
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a1 = poligono[i];
    const a2 = poligono[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      // Vecinas (j = i+1) y el par que cierra el anillo (i = 0, j = n-1).
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segmentosCruzan(a1, a2, poligono[j], poligono[(j + 1) % n])) return true;
    }
  }
  return false;
}

/** ¿La celda rectangular centrada en `centro` toca el polígono? Tres pruebas,
 * porque ninguna sola basta: centro/esquinas adentro (celda dentro del área),
 * vértice del polígono adentro (área pequeña dentro de la celda) y cruce de
 * aristas (una franja delgada que atraviesa la celda en diagonal). */
export function celdaTocaPoligono(
  centro: Punto,
  altoLat: number,
  anchoLng: number,
  poligono: readonly Punto[],
): boolean {
  const sur = centro.lat - altoLat / 2;
  const norte = centro.lat + altoLat / 2;
  const oeste = centro.lng - anchoLng / 2;
  const este = centro.lng + anchoLng / 2;
  const esquinas: Punto[] = [
    { lat: sur, lng: oeste },
    { lat: sur, lng: este },
    { lat: norte, lng: este },
    { lat: norte, lng: oeste },
  ];

  if (puntoEnPoligono(centro, poligono)) return true;
  if (esquinas.some((q) => puntoEnPoligono(q, poligono))) return true;
  if (
    poligono.some(
      (v) => v.lat >= sur && v.lat <= norte && v.lng >= oeste && v.lng <= este,
    )
  ) {
    return true;
  }

  for (let i = 0; i < poligono.length; i++) {
    const a = poligono[i];
    const b = poligono[(i + 1) % poligono.length];
    for (let k = 0; k < 4; k++) {
      if (segmentosCruzan(a, b, esquinas[k], esquinas[(k + 1) % 4])) return true;
    }
  }
  return false;
}

export function claveTesela(centro: Punto, radio: number): string {
  return `${centro.lat.toFixed(5)},${centro.lng.toFixed(5)}@${Math.round(radio)}`;
}

/** Una tesela se barre UNA VEZ POR VERTICAL: la unidad de trabajo (y lo que se
 * anota en territorios.teselas_hechas) es el par. */
export function claveTrabajo(tesela: Tesela, vertical: string): string {
  return `${tesela.clave}#${vertical}`;
}

/** Rejilla de círculos que cubre el polígono. Separación r·√2: es la que
 * garantiza que el cuadrado inscrito de cada círculo tesele el plano sin
 * huecos. El paso de longitud se ajusta POR FILA (un grado mide menos metros
 * cuanto más lejos del ecuador, así que las filas ecuatoriales son más anchas
 * en metros si usan un paso único). Las celdas que no tocan el polígono se
 * botan — dibujar una franja cuesta lo que mide la franja, no lo que mide su caja. */
export function teselar(
  poligono: readonly Punto[],
  radio: number = RADIO_BASE,
): Tesela[] {
  const caja = cajaDe(poligono);
  const paso = radio * Math.SQRT2;
  const pasoLat = paso / METROS_POR_GRADO_LAT;
  const filas = Math.max(1, Math.ceil((caja.norte - caja.sur) / pasoLat));

  const teselas: Tesela[] = [];
  for (let f = 0; f < filas; f++) {
    const lat = caja.sur + (f + 0.5) * pasoLat;
    // El paso de longitud se calcula POR FILA, y desde el borde de la fila más
    // cercano al ecuador — que es donde un grado mide más metros y la celda
    // sale más ancha. Con un paso único para todo el polígono, las filas del
    // lado del ecuador quedan más anchas que el círculo que debe cubrirlas y
    // dejan huecos: un censo que miente sin avisar.
    const bordeEcuatorial = Math.min(
      Math.abs(lat - pasoLat / 2),
      Math.abs(lat + pasoLat / 2),
    );
    const pasoLng = paso / metrosPorGradoLng(bordeEcuatorial);
    const columnas = Math.max(1, Math.ceil((caja.este - caja.oeste) / pasoLng));
    for (let c = 0; c < columnas; c++) {
      const lng = caja.oeste + (c + 0.5) * pasoLng;
      const centro = { lat, lng };
      if (filas * columnas > 1 && !celdaTocaPoligono(centro, pasoLat, pasoLng, poligono)) {
        continue;
      }
      teselas.push({ centro, radio, clave: claveTesela(centro, radio) });
    }
  }
  return teselas;
}

/** Parte una tesela saturada en 4 de la mitad del radio. */
export function subdividir(t: Tesela): Tesela[] {
  const subRadio = t.radio / 2;
  const desplazamiento = (t.radio * Math.SQRT2) / 4;
  const dLat = desplazamiento / METROS_POR_GRADO_LAT;
  const dLng = desplazamiento / metrosPorGradoLng(t.centro.lat);
  return [
    { lat: t.centro.lat - dLat, lng: t.centro.lng - dLng },
    { lat: t.centro.lat - dLat, lng: t.centro.lng + dLng },
    { lat: t.centro.lat + dLat, lng: t.centro.lng - dLng },
    { lat: t.centro.lat + dLat, lng: t.centro.lng + dLng },
  ].map((centro) => ({
    centro,
    radio: subRadio,
    clave: claveTesela(centro, subRadio),
  }));
}

export function estimarBarrido(teselas: number, verticales: number): Estimacion {
  const llamadas = teselas * verticales;
  const llamadasMax = Math.ceil(llamadas * FACTOR_DENSIDAD);
  return {
    llamadas,
    costoUsd: llamadas * PRECIO_POR_LLAMADA_USD,
    llamadasMax,
    costoMaxUsd: llamadasMax * PRECIO_POR_LLAMADA_USD,
  };
}

export function esSaturada(n: number): boolean {
  return n >= TOPE_NEARBY;
}
