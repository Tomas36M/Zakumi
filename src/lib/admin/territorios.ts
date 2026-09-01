import { cajaDe, type Punto } from "./barrido";

export type Territorio = {
  id: string;
  nombre: string;
  poligono: Punto[];
  bbox_sur: number;
  bbox_norte: number;
  bbox_oeste: number;
  bbox_este: number;
  verticales: string[];
  teselas_hechas: string[];
  llamadas: number;
  ultimo_barrido: string | null;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
};

export const NOMBRE_MAX = 120;

/** Grados de lado máximos de la caja. ~1.1° ≈ 120 km: más que eso no es un
 * territorio de prospección, es una factura de Google. */
export const LADO_MAX_GRADOS = 1.1;

export function poligonoValido(poligono: readonly Punto[]): boolean {
  if (poligono.length < 3) return false;
  const enElPlaneta = poligono.every(
    (p) =>
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng) &&
      p.lat >= -90 &&
      p.lat <= 90 &&
      p.lng >= -180 &&
      p.lng <= 180,
  );
  if (!enElPlaneta) return false;
  const caja = cajaDe(poligono);
  return (
    caja.norte - caja.sur <= LADO_MAX_GRADOS &&
    caja.este - caja.oeste <= LADO_MAX_GRADOS
  );
}

export function filasDeTerritorio(poligono: Punto[], nombre: string) {
  const caja = cajaDe(poligono);
  return {
    nombre: nombre.trim().slice(0, NOMBRE_MAX),
    poligono,
    bbox_sur: caja.sur,
    bbox_norte: caja.norte,
    bbox_oeste: caja.oeste,
    bbox_este: caja.este,
  };
}
