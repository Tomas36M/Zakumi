import type { Semaforo } from "@/lib/admin/cartera";

/** Punto de color del semáforo de cobro (clases literales para Tailwind).
 * Una sola tabla para la lista de cobros, las tarjetas y la ficha. */
export const COLOR_SEMAFORO: Record<Semaforo, string> = {
  al_dia: "bg-vivo",
  por_vencer: "bg-estado-contactado",
  vencido: "bg-peligro",
  sin_programar: "bg-tinta-40/40",
};
