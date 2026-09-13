import type { EstadoNegocio } from "@/lib/admin/negocios";

/** Punto de color del pipeline (clases literales: Tailwind no ve plantillas).
 * Una sola tabla para filas, tarjetas y pines del mapa. */
export const COLOR_ESTADO: Record<EstadoNegocio, string> = {
  nuevo: "bg-estado-nuevo",
  contactado: "bg-estado-contactado",
  respondido: "bg-estado-respondido",
  interesado: "bg-estado-interesado",
  cliente: "bg-estado-cliente",
  descartado: "bg-estado-descartado",
};
