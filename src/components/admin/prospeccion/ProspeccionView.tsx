"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { caraDe, pestanaInicial, type CaraProspeccion } from "@/lib/admin/prospeccion-caras";
import type { Negocio } from "@/lib/admin/negocios";
import type { Territorio } from "@/lib/admin/territorios";
import { NegociosView } from "@/components/admin/negocios/NegociosView";
import { Banner } from "@/components/admin/ui/Banner";
import { Cockpit } from "@/components/admin/ui/Cockpit";
import { CarasProspeccion } from "./CarasProspeccion";
import { TerritorioView, type BarridoAbierto } from "./TerritorioView";

type Props = {
  tab: string | null;
  negocios: Negocio[];
  territorios: Territorio[];
  /** Cuántos negocios hay DE VERDAD en la base (count exacto del servidor), o
   * null si esa cuenta también falló. `negocios` viene topado: este número es
   * lo único que sabe si la lista está completa. */
  negociosTotal: number | null;
  /** La consulta falló: la lista vacía NO significa que no haya nada. */
  fallaNegocios: boolean;
  fallaTerritorios: boolean;
};

// Dos cockpits anidados con altura fija de viewport se desbordan y devuelven
// el scroll de página. La cara Leads le pasa esto a NegociosView para que su
// cockpit se conforme con el hueco que le deja el nuestro.
const COCKPIT_ANIDADO = "min-[900px]:h-auto min-[900px]:min-h-0 min-[900px]:flex-1";

/**
 * "Encontrar clientes": el shell de las dos caras. Territorio es el mapa donde
 * se dibuja y se barre; Leads es el CRM que llena el barrido.
 *
 * El shell no sabe nada de Google ni de teselas, pero SÍ sabe si hay un
 * barrido abierto: es lo único que se gasta plata sola y tiene que verse desde
 * la otra cara.
 */
export function ProspeccionView({
  tab,
  negocios,
  territorios,
  negociosTotal,
  fallaNegocios,
  fallaTerritorios,
}: Props) {
  const router = useRouter();

  // La URL manda (es compartible y sobrevive al atrás del navegador), pero la
  // cara se pinta YA: `router.push` vuelve al servidor a releer negocios y
  // territorios, y esperar ese viaje para mover dos tarjetas se siente roto.
  const [cara, setCara] = useState<CaraProspeccion>(caraDe(tab));
  const [tabVisto, setTabVisto] = useState(tab);
  if (tab !== tabVisto) {
    // El prop cambió sin pasar por el clic (atrás/adelante, enlace externo):
    // ajustar en render es el patrón de React para estado derivado.
    setTabVisto(tab);
    setCara(caraDe(tab));
  }

  // El barrido abierto vive acá arriba para que las caras puedan marcarlo; lo
  // maneja TerritorioView, que es quien monta la banda de progreso.
  const [barrido, setBarrido] = useState<BarridoAbierto | null>(null);

  const sinWeb = negocios.filter((n) => !n.sitio_web).length;

  // La lista de negocios viene topada por `page.tsx`. La comparación es contra
  // las filas que DE VERDAD llegaron, no contra el tope: si quien recortó fue
  // el ajuste "Max rows" de Supabase, la consulta vuelve capada y sin error, y
  // esta es la única señal de que la cabecera está contando un tope y no un
  // censo.
  const truncada = negociosTotal !== null && negociosTotal > negocios.length;

  function cambiarCara(nueva: CaraProspeccion) {
    if (nueva === cara) return;
    setCara(nueva);
    router.push(`/admin/prospeccion?tab=${pestanaInicial(nueva)}`, { scroll: false });
  }

  return (
    <Cockpit>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <h1 className="text-lg font-semibold text-tinta">
          Encontrar clientes{" "}
          <span className="font-editorial text-base font-normal italic text-acento">
            el censo de la calle
          </span>
        </h1>
        <span className="text-xs text-tinta-40">
          <strong className="text-tinta-85">{negocios.length}</strong>
          {/* Con la lista topada, "N negocios" a secas sería la cifra de la
              pantalla presentada como la cifra de la base. */}
          {truncada && <> de {negociosTotal}</>} negocios ·{" "}
          <strong className="text-tinta-85">{sinWeb}</strong> sin web ·{" "}
          <strong className="text-tinta-85">{territorios.length}</strong> territorios
        </span>
      </header>

      <div className="flex shrink-0 flex-col gap-3 px-5 pt-4">
        <CarasProspeccion
          activa={cara}
          onCambiar={cambiarCara}
          territorios={territorios.length}
          leads={negocios.length}
          sinWeb={sinWeb}
          barriendo={barrido !== null}
        />

        {fallaNegocios && (
          <Banner variante="error">
            No se pudieron cargar los negocios. Los contadores de leads y de «sin
            web» están incompletos: no tomes decisiones con estos números hasta
            recargar.
          </Banner>
        )}

        {/* Un censo que no dice que está recortado no es un censo. */}
        {truncada && (
          <Banner variante="error">
            La base tiene <strong>{negociosTotal}</strong> negocios y esta
            pantalla cargó los <strong>{negocios.length}</strong> más recientes.
            Todo lo de aquí cuenta SOLO esos {negocios.length}: los contadores de
            arriba, los filtros de la lista, los pines del mapa y los negocios
            por territorio. Los más antiguos existen y no están en pantalla.
          </Banner>
        )}
      </div>

      {/* Territorio se monta SIEMPRE y se esconde con `hidden`: desmontarlo
          mataría un barrido en vuelo (el hook vive dentro). Mismo patrón que
          el Lab de voz en ZakView. */}
      <TerritorioView
        negocios={negocios}
        territorios={territorios}
        fallaTerritorios={fallaTerritorios}
        barrido={barrido}
        onBarrido={setBarrido}
        oculta={cara !== "territorio"}
      />

      {cara === "leads" && (
        <NegociosView
          negocios={negocios}
          territorios={territorios}
          className={COCKPIT_ANIDADO}
        />
      )}
    </Cockpit>
  );
}
