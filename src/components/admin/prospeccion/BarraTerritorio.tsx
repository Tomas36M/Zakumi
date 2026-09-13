"use client";

import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";

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
 * La barra de arriba del mapa: la pista de qué hacer y las tres puertas que
 * antes vivían en la lista flotante de la izquierda. El mapa ya no comparte
 * el lienzo con nadie.
 */
export function BarraTerritorio({
  dibujando,
  onDibujar,
  buscando,
  onBuscar,
  capturando,
  onCapturar,
  fallaTerritorios,
}: Props) {
  return (
    <div className="flex shrink-0 flex-col gap-3 px-5 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-tinta-40">
          Dibuja un área, mira lo que cuesta barrerla y confírmalo. Toca un territorio del
          mapa para abrir su ficha. Cada tesela es una llamada a Google que se paga.
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <Button
            variante={dibujando ? "primaria" : "fantasma"}
            // Sin la lista no se sabe qué ya está dibujado (y pagado): dibujar
            // a ciegas termina en un territorio duplicado que se le vuelve a
            // comprar a Google entero.
            disabled={fallaTerritorios}
            onClick={onDibujar}
          >
            {dibujando ? "Dibujando… (clic para salir)" : "Dibujar territorio"}
          </Button>
          <Button variante={buscando ? "primaria" : "fantasma"} onClick={onBuscar}>
            Buscar en Google
          </Button>
          <Button variante={capturando ? "primaria" : "fantasma"} onClick={onCapturar}>
            {capturando ? "Toca el mapa para ubicarlo" : "Añadir manual"}
          </Button>
        </span>
      </div>

      {fallaTerritorios && (
        // "Ningún territorio" sobre una consulta caída es la mentira cara de
        // esta pantalla: invita a redibujar un área que ya existe, y el nuevo
        // nace con teselas_hechas vacío — barrerlo le paga a Google de cero
        // todo lo que el original invisible ya compró.
        <Banner variante="error">
          No se pudieron cargar los territorios. El mapa está vacío por el error, no
          porque no haya ninguno: <strong>no dibujes uno nuevo</strong> hasta que vuelva, o
          pagarás otra vez un área que ya está barrida. Recarga en un momento.
        </Banner>
      )}
    </div>
  );
}
