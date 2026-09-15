// El overlay de leads: los datos crudos viven en el Flask del bot (ver
// src/lib/bots/api.ts), esta tabla solo anota ediciones/borrados
// lógicos/vínculos a un negocio, por instancia+teléfono. El merge es puro
// para poder testearlo sin levantar nada — lo llama el route handler de
// actividad (src/app/admin/api/bots/[id]/actividad/route.ts). SOLO SERVIDOR.

import type { Lead } from "@/lib/bots/tipos";

export type LeadOverride = {
  instancia_id: number;
  telefono: string;
  datos_editados: Record<string, unknown> | null;
  negocio_id: string | null;
  borrado: boolean;
};

export type LeadConOverride = {
  phone: string;
  datos: Record<string, unknown>;
  /** El negocio vinculado a mano, si lo hay — nunca viene del Flask. */
  negocioId: string | null;
};

/**
 * Mezcla los leads crudos del Flask con sus overrides locales: oculta lo
 * borrado, pisa los campos editados, resuelve el negocio vinculado. El
 * Flask nunca se toca — esta función solo lee.
 *
 * `instanciaId` va en la firma a propósito: los overrides se indexan por
 * teléfono, y dos bots pueden tener leads con el mismo número — un
 * borrado de la instancia 2 no puede ocultar el lead de la instancia 1.
 * Filtrar acá (y no confiar en que el llamador ya filtró) hace la
 * precondición imposible de olvidar.
 *
 * `datos_editados` reemplaza `datos` entero (no mergea campo a campo): una
 * vez editado, ese lead queda congelado y no muestra campos nuevos que el
 * bot capture después para el mismo teléfono.
 */
export function mezclarLeads(
  instanciaId: number,
  leads: Lead[],
  overrides: LeadOverride[],
): LeadConOverride[] {
  const porTelefono = new Map(
    overrides.filter((o) => o.instancia_id === instanciaId).map((o) => [o.telefono, o]),
  );
  const resultado: LeadConOverride[] = [];
  for (const l of leads) {
    const o = porTelefono.get(l.phone);
    if (o?.borrado) continue;
    resultado.push({
      phone: l.phone,
      datos: o?.datos_editados ?? l.datos,
      negocioId: o?.negocio_id ?? null,
    });
  }
  return resultado;
}
