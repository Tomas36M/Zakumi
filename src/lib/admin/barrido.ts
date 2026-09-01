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
 * huecos. Las celdas que no tocan el polígono se botan — dibujar una franja
 * cuesta lo que mide la franja, no lo que mide su caja. */
export function teselar(
  poligono: readonly Punto[],
  radio: number = RADIO_BASE,
): Tesela[] {
  const caja = cajaDe(poligono);
  const paso = radio * Math.SQRT2;
  const pasoLat = paso / METROS_POR_GRADO_LAT;
  const latMedia = (caja.sur + caja.norte) / 2;
  const pasoLng = paso / metrosPorGradoLng(latMedia);

  const filas = Math.max(1, Math.ceil((caja.norte - caja.sur) / pasoLat));
  const columnas = Math.max(1, Math.ceil((caja.este - caja.oeste) / pasoLng));

  const teselas: Tesela[] = [];
  for (let f = 0; f < filas; f++) {
    const lat = caja.sur + (f + 0.5) * pasoLat;
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
