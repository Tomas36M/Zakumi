// Motor de oportunidades de upsell del panel. El catálogo en sí vive en
// src/lib/catalogo.ts (compartido con la tienda del portal /app); aquí se
// re-exporta para los imports históricos del panel.

import type { ProductoContratado, TipoProducto } from "./cartera";
import { CATALOGO_ZAKUMI, type Servicio } from "@/lib/catalogo";

export { CATALOGO_ZAKUMI };
export type { Servicio };

export type Oportunidad = {
  servicio: Servicio;
  razon: string;
};

/**
 * Qué se le puede vender a un cliente: el catálogo menos los tipos que ya
 * tiene activos, con la razón comercial de cada sugerencia. Ordenado:
 * disponibles primero y por tarifa sugerida descendente (mayor palanca arriba).
 */
export function oportunidades(productosActivos: ProductoContratado[]): Oportunidad[] {
  const activos = productosActivos.filter((p) => p.activo);
  const tiposContratados = new Set<TipoProducto>(activos.map((p) => p.tipo));
  const tieneBot = tiposContratados.has("bot");
  const tieneWeb = tiposContratados.has("web");

  const resultado: Oportunidad[] = [];
  for (const servicio of CATALOGO_ZAKUMI) {
    if (tiposContratados.has(servicio.tipo)) continue;
    // Mantenimiento sin página web no tiene qué mantener.
    if (servicio.tipo === "mantenimiento" && !tieneWeb) continue;

    let razon = servicio.pitch;
    if (servicio.tipo === "web" && tieneBot) {
      razon = "Ya tiene bot y no tiene web: el siguiente paso natural. " + servicio.pitch;
    } else if (servicio.tipo === "mantenimiento" && tieneWeb) {
      razon = "Tiene web sin mantenimiento contratado. " + servicio.pitch;
    } else if (servicio.tipo === "voz" && tieneBot) {
      razon = "Ya confía en un agente de WhatsApp: candidato natural a voz. " + servicio.pitch;
    }
    resultado.push({ servicio, razon });
  }

  return resultado.toSorted((a, b) => {
    if (a.servicio.disponible !== b.servicio.disponible) {
      return a.servicio.disponible ? -1 : 1;
    }
    return b.servicio.tarifaSugerida - a.servicio.tarifaSugerida;
  });
}

/** Suma de tarifas mensualizadas de los productos activos (anual → /12). */
export function mrrDeProductos(productos: ProductoContratado[]): number {
  return productos
    .filter((p) => p.activo)
    .reduce((total, p) => {
      if (p.ciclo === "mensual") return total + p.tarifa;
      if (p.ciclo === "anual") return total + p.tarifa / 12;
      return total; // pago único no es recurrente
    }, 0);
}
