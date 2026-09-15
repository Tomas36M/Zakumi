"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
// `Map` sin alias sombrearía el Map global del lenguaje.
import { Contact, Map as IconoMapa } from "lucide-react";
import {
  caraDe,
  carasProspeccion,
  cifrasCabecera,
  pestanaInicial,
  textoCifra,
  type CaraProspeccion,
} from "@/lib/admin/prospeccion-caras";
import { esSinWeb, estadoCenso, type Negocio } from "@/lib/admin/negocios";
import type { Territorio } from "@/lib/admin/territorios";
import type { EstadoVozZak } from "@/lib/admin/voz-estado";
import { FichaLeadModal } from "@/components/admin/leads/FichaLeadModal";
import { useFichaLead } from "@/components/admin/leads/useFichaLead";
import { useFichaNegocio } from "@/components/admin/leads/useFichaNegocio";
import { NegociosView } from "@/components/admin/negocios/NegociosView";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Caras } from "@/components/admin/ui/Caras";
import { Cockpit } from "@/components/admin/ui/Cockpit";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import type { AvisoBarrido } from "./BarridoProgreso";
import { TerritorioView, type BarridoAbierto } from "./TerritorioView";

const ICONOS_CARAS = { territorio: IconoMapa, leads: Contact } as const;

type Props = {
  tab: string | null;
  negocios: Negocio[];
  territorios: Territorio[];
  /** Cuántos negocios hay DE VERDAD en la base (count exacto del servidor), o
   * null si esa cuenta también falló. `negocios` viene topado: este número es
   * lo único que sabe si la lista está completa. */
  negociosTotal: number | null;
  /** Cuántos negocios SIN WEB hay en la base (count exacto), o null si esa
   * cuenta falló. */
  sinWebTotal: number | null;
  /** La consulta falló: la lista vacía NO significa que no haya nada. */
  fallaNegocios: boolean;
  fallaTerritorios: boolean;
  /** Consultas a Google Places que este panel lleva registradas en el mes
   * calendario en curso. `null` = no se pudo leer, y NO es lo mismo que cero:
   * el diálogo de barrer no puede afirmar cuota gratis sobre un dato que no
   * tiene. */
  consultasMes: number | null;
  /** Estado de la voz de Zak (server): habilita «Llamar con IA» en la ficha. */
  vozZak: EstadoVozZak;
  /** `?territorio=<id>`: abrir la ficha de ese territorio y encuadrarlo. */
  territorioInicial: string | null;
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
  sinWebTotal,
  fallaNegocios,
  fallaTerritorios,
  consultasMes,
  vozZak,
  territorioInicial,
}: Props) {
  const router = useRouter();

  // La ficha del lead (modal) es del shell, no de las caras: Territorio está
  // siempre montada y Leads solo a veces — dos modales leyendo `?lead=` se
  // abrirían a la vez. Se guarda el id; el negocio sale de los negocios del
  // mapa (vivos tras `router.refresh()`) o, si es más antiguo que ese tope —la
  // lista de Leads pagina la base entera—, se trae por id.
  const [leadId, abrirLead] = useFichaLead();
  const ficha = useFichaNegocio(leadId, negocios);
  // Sube cuando la ficha cambia algo: la lista de Leads vuelve a pedir su página.
  const [versionLista, setVersionLista] = useState(0);

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
  // Y su estado vivo, que la banda publica hacia acá. La cara Territorio se
  // esconde con `hidden` (desmontarla mataría el barrido), así que estando en
  // Leads el usuario no veía NADA: ni la barra, ni Pausar, ni el banner del
  // tope de gasto, ni el 429 de Google. El guardarraíl que protege su
  // consentimiento quedaba invisible justo cuando salta.
  const [aviso, setAviso] = useState<AvisoBarrido | null>(null);

  // El censo del MAPA: la lista de negocios viene topada por `page.tsx`. La
  // comparación es contra las filas que DE VERDAD llegaron, no contra el tope:
  // si quien recortó fue el ajuste "Max rows" de Supabase, la consulta vuelve
  // capada y sin error, y esta es la única señal de que el mapa pinta un tope y
  // no un censo. Si la cuenta exacta FALLÓ, `estadoCenso` trata "la lista llegó
  // justo al tope" como su propia señal de recorte.
  const censo = estadoCenso(negocios.length, negociosTotal);

  // Las cifras de la cabecera y de las caras son las de la base (conteos
  // exactos del servidor). Si una cuenta falló, se dicen como piso («900+») o
  // «—»: nunca la cifra de lo cargado presentada como la de la base.
  const cifras = cifrasCabecera({
    cargados: negocios.length,
    sinWebCargados: negocios.filter(esSinWeb).length,
    total: negociosTotal,
    sinWebTotal,
    fallaCargados: fallaNegocios,
  });

  function cambiarCara(nueva: CaraProspeccion) {
    if (nueva === cara) return;
    setCara(nueva);
    router.push(`/admin/prospeccion?tab=${pestanaInicial(nueva)}`, { scroll: false });
  }

  // Los avisos ocupan una banda propia solo cuando hay alguno: una banda
  // vacía le roba 16px al mapa por nada. El recorte de 900 es del mapa: la
  // lista de Leads pagina la base entera y no lo tiene.
  const hayAvisos =
    fallaNegocios ||
    (cara === "leads" && aviso !== null) ||
    (cara === "territorio" && censo.tipo !== "completo");

  return (
    <Cockpit>
      <PageHeader
        titulo="Encontrar clientes"
        coletilla="el censo de la calle"
        migas={["Encontrar clientes", cara === "leads" ? "Leads" : "Territorio"]}
        navegacion={
          <Caras
            caras={carasProspeccion({
              territorios: territorios.length,
              leads: cifras.leads,
              sinWeb: cifras.sinWeb,
              barriendo: barrido !== null,
            })}
            iconos={ICONOS_CARAS}
            activa={cara}
            onCambiar={cambiarCara}
            etiqueta="Las dos caras de Encontrar clientes"
          />
        }
        contador={
          <>
            <strong className="text-tinta-85">{textoCifra(cifras.leads)}</strong> negocios ·{" "}
            <strong className="text-tinta-85">{textoCifra(cifras.sinWeb)}</strong> sin web ·{" "}
            <strong className="text-tinta-85">{territorios.length}</strong> territorios
          </>
        }
      />

      {hayAvisos && (
        <div className="flex shrink-0 flex-col gap-3 px-5 pt-4">
          {fallaNegocios && (
            <Banner variante="error">
              No se pudieron cargar los negocios del mapa: faltan pines y las cifras por
              territorio están incompletas. Recarga la página para reintentar.
            </Banner>
          )}

          {/* El barrido, visible desde esta cara. El punto que late en la
              pestaña dice que hay uno; esto dice cómo va y deja pararlo. */}
          {cara === "leads" && aviso && (
            <Banner variante={aviso.error || aviso.capado ? "error" : "aviso"}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {aviso.corriendo
                    ? "Barriendo"
                    : aviso.termino
                      ? "Barrido terminado"
                      : aviso.capado
                        ? "Barrido en pausa: se pasó de lo aprobado"
                        : "Barrido en pausa"}{" "}
                  · <strong>{aviso.territorio}</strong> · {aviso.hechos} de{" "}
                  {aviso.total} en esta tanda
                  {aviso.error && <> — {aviso.error}</>}
                  {aviso.sinContabilizar > 0 && (
                    <>
                      {" "}
                      — {aviso.sinContabilizar}{" "}
                      {aviso.sinContabilizar === 1
                        ? "tesela cobrada sin contabilizar"
                        : "teselas cobradas sin contabilizar"}
                    </>
                  )}
                </span>
                <span className="flex shrink-0 gap-2">
                  {aviso.corriendo && <Button onClick={aviso.pausar}>Pausar</Button>}
                  <Button variante="primaria" onClick={() => cambiarCara("territorio")}>
                    {aviso.termino ? "Ver el resumen" : "Ver el barrido"}
                  </Button>
                </span>
              </div>
            </Banner>
          )}

          {/* Un censo que no dice que está recortado no es un censo. El tope es
              del mapa: la lista de Leads pagina la base entera. */}
          {cara === "territorio" && censo.tipo === "recortado" && (
            <Banner variante="error">
              El mapa cargó los <strong>{negocios.length}</strong> negocios más recientes de{" "}
              <strong>{censo.total}</strong>: los pines y las cifras por territorio del mapa
              cuentan solo esos. La lista de Leads y las cifras de arriba cuentan la base entera.
            </Banner>
          )}
          {cara === "territorio" && censo.tipo === "recortado_sin_conteo" && (
            <Banner variante="error">
              El mapa cargó <strong>{negocios.length}</strong> negocios, su tope, y la cuenta de
              cuántos hay en la base falló: es casi seguro que faltan pines. La lista de Leads
              pagina la base entera y sí los tiene. Recarga la página para reintentar la cuenta.
            </Banner>
          )}
        </div>
      )}

      {/* Territorio se monta SIEMPRE y se esconde con `hidden`: desmontarlo
          mataría un barrido en vuelo (el hook vive dentro). Mismo patrón que
          el Lab de voz en ZakView. */}
      <TerritorioView
        negocios={negocios}
        territorios={territorios}
        fallaTerritorios={fallaTerritorios}
        consultasMes={consultasMes}
        barrido={barrido}
        onBarrido={setBarrido}
        onAvisoBarrido={setAviso}
        oculta={cara !== "territorio"}
        onAbrirLead={abrirLead}
        leadAbierto={leadId}
        territorioInicial={territorioInicial}
      />

      {cara === "leads" && (
        <NegociosView
          territorios={territorios}
          className={COCKPIT_ANIDADO}
          onAbrirLead={abrirLead}
          // También cuando cambia la cuenta de la base: un barrido que sigue
          // corriendo con la cara Leads a la vista.
          recarga={`${versionLista}:${negociosTotal ?? ""}`}
        />
      )}

      <FichaLeadModal
        leadId={leadId}
        negocio={ficha.negocio}
        cargando={ficha.cargando}
        fallo={ficha.fallo}
        noExiste={ficha.noExiste}
        vozZak={vozZak}
        onCerrar={() => abrirLead(null)}
        onCambio={() => {
          ficha.recargar();
          setVersionLista((v) => v + 1);
          router.refresh();
        }}
        onEliminado={() => {
          abrirLead(null);
          setVersionLista((v) => v + 1);
          router.refresh();
        }}
      />
    </Cockpit>
  );
}
