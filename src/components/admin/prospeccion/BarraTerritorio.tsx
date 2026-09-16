"use client";

import { Banner } from "@/components/admin/ui/Banner";

type Props = {
  /** La consulta de territorios falló: dibujar a ciegas puede duplicar (y
   * volver a pagar) un área que ya existe. */
  fallaTerritorios: boolean;
};

/**
 * La banda de encima del mapa. Ya no lleva botones ni pistas: las tres puertas
 * (dibujar, buscar, añadir) flotan sobre el lienzo en `AccionesMapa`, donde no
 * le roban alto al mapa. Aquí queda lo único que sí es una alarma — y cuando no
 * la hay, este componente no pinta nada.
 */
export function BarraTerritorio({ fallaTerritorios }: Props) {
  if (!fallaTerritorios) return null;

  return (
    <div className="flex shrink-0 flex-col gap-3 px-5 pt-4">
      {/* "Ningún territorio" sobre una consulta caída es la mentira cara de
          esta pantalla: invita a redibujar un área que ya existe, y el nuevo
          nace con teselas_hechas vacío — barrerlo le paga a Google de cero
          todo lo que el original invisible ya compró. */}
      <Banner variante="error">
        No se pudieron cargar los territorios. El mapa está vacío por el error, no
        porque no haya ninguno: <strong>no dibujes uno nuevo</strong> hasta que vuelva, o
        pagarás otra vez un área que ya está barrida. Recarga en un momento.
      </Banner>
    </div>
  );
}
