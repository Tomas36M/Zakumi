"use client";

import { MapPinPlus, Search, SquareDashed } from "lucide-react";
import { BotonMapa } from "@/components/admin/mapa/BotonMapa";

type Props = {
  dibujando: boolean;
  onDibujar: () => void;
  buscando: boolean;
  onBuscar: () => void;
  capturando: boolean;
  onCapturar: () => void;
  /** La consulta de territorios falló: dibujar a ciegas puede duplicar (y
   * volver a pagar) un área que ya existe. */
  fallaTerritorios: boolean;
};

/**
 * Las tres puertas del mapa —dibujar un territorio, buscar en Google y añadir
 * un negocio a mano— flotando sobre el lienzo, debajo de los filtros. Antes
 * vivían en una barra encima del mapa que le robaba alto a lo único que
 * importa aquí: el mapa. Mismo botón que los controles de zoom y satélite.
 */
export function AccionesMapa({
  dibujando,
  onDibujar,
  buscando,
  onBuscar,
  capturando,
  onCapturar,
  fallaTerritorios,
}: Props) {
  return (
    <div className="pointer-events-auto flex flex-col items-start gap-1">
      <BotonMapa
        Icono={SquareDashed}
        hacia="derecha"
        etiqueta={dibujando ? "Dibujando… (clic para salir)" : "Dibujar territorio"}
        titulo="Dibuja un área, mira lo que cuesta barrerla y confírmalo. Cada tesela es una llamada a Google que se paga."
        activa={dibujando}
        // Sin la lista no se sabe qué ya está dibujado (y pagado): dibujar a
        // ciegas termina en un territorio duplicado que se le vuelve a comprar
        // a Google entero.
        disabled={fallaTerritorios}
        onClick={onDibujar}
      />
      <BotonMapa
        Icono={Search}
        hacia="derecha"
        etiqueta="Buscar en Google"
        titulo="Buscar negocios sueltos por nombre, fuera de un barrido"
        activa={buscando}
        onClick={onBuscar}
      />
      <BotonMapa
        Icono={MapPinPlus}
        hacia="derecha"
        etiqueta={capturando ? "Toca el mapa para ubicarlo" : "Añadir manual"}
        titulo="Añadir un negocio a mano tocando su sitio en el mapa"
        activa={capturando}
        onClick={onCapturar}
      />
    </div>
  );
}
