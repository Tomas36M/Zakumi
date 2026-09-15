"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, PencilLine, Trash2 } from "lucide-react";
import { poligonoSeCruza } from "@/lib/admin/barrido";
import { fechaCorta, formatoUsd } from "@/lib/admin/formato";
import { estadoCenso, type Negocio } from "@/lib/admin/negocios";
import { resumenDeTerritorio, type CuentaTerritorio, type Territorio } from "@/lib/admin/territorios";
import { eliminarTerritorio } from "@/lib/admin/territorios-actions";
import type { EstadoVozZak } from "@/lib/admin/voz-estado";
import { nuevosContactables, TANDA_SUGERIDA_DIA } from "@/lib/admin/zak";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Cockpit, CockpitBody } from "@/components/admin/ui/Cockpit";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { IconButton } from "@/components/admin/ui/IconButton";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { FichaLeadModal } from "@/components/admin/leads/FichaLeadModal";
import { useFichaLead } from "@/components/admin/leads/useFichaLead";
import { useFichaNegocio } from "@/components/admin/leads/useFichaNegocio";
import { NegociosView } from "@/components/admin/negocios/NegociosView";
import { useTandaZak } from "@/components/admin/negocios/useTandaZak";
import { RenombrarTerritorio } from "@/components/admin/prospeccion/RenombrarTerritorio";

const LINK = "inline-flex h-control items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors";

// La lista de leads trae su propio cockpit: anidado en el de esta página, se
// conforma con el hueco que le queda (el mismo arreglo de la cara Leads de
// Encontrar clientes).
const COCKPIT_ANIDADO = "min-[900px]:h-auto min-[900px]:min-h-0 min-[900px]:flex-1";

type Props = {
  territorio: Territorio;
  /** Los negocios de este territorio, topados a TOPE_LEADS: alimentan
   * «Contactar a los nuevos» y la ficha. La lista pagina aparte, por la ruta. */
  negocios: Negocio[];
  /** Cuenta exacta del servidor (null si falló). */
  negociosTotal: number | null;
  cuenta: CuentaTerritorio | null;
  vozZak: EstadoVozZak;
};

/** La página de un territorio: sus números, sus acciones y sus locales, con
 * los estados, los filtros y las acciones en lote de la lista de Leads. */
export function TerritorioDetalleView({ territorio: t, negocios, negociosTotal, cuenta, vozZak }: Props) {
  const router = useRouter();
  const { confirmar, dialogo } = useConfirmar();
  const [leadId, abrirLead] = useFichaLead();
  const [renombrando, setRenombrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, startAccion] = useTransition();
  // Sube cuando algo cambia por fuera de la lista (la ficha, «Contactar a los
  // nuevos»): la lista vuelve a pedir su página.
  const [versionLista, setVersionLista] = useState(0);
  const tanda = useTandaZak(() => setVersionLista((v) => v + 1));

  // La ficha abierta: de los locales que cargó la página o, si el lead es más
  // antiguo que ese tope, traída por id.
  const ficha = useFichaNegocio(leadId, negocios);
  const cuentas = useMemo(
    () => new Map(cuenta ? [[t.id, cuenta]] : []),
    [t.id, cuenta],
  );
  // «Contactar a los nuevos» no pasa del tope diario de la estrategia: el
  // resto queda en Nuevo y el mismo botón lo recoge mañana.
  const nuevos = useMemo(() => nuevosContactables(negocios), [negocios]);
  const paraHoy = useMemo(() => nuevosContactables(negocios, TANDA_SUGERIDA_DIA), [negocios]);
  const resumen = resumenDeTerritorio(t, cuentas);
  const censo = estadoCenso(negocios.length, negociosTotal);
  const cruzado = useMemo(() => poligonoSeCruza(t.poligono), [t.poligono]);
  const enMapa = `/admin/prospeccion?tab=territorio&territorio=${t.id}`;
  const hayAvisos = Boolean(error) || Boolean(tanda.aviso) || cruzado || censo.tipo !== "completo";

  async function borrar() {
    const ok = await confirmar({
      titulo: `¿Eliminar ${t.nombre}?`,
      mensaje:
        "Se borra el área y su historial de teselas barridas: para volver a barrerla hay que pagarle a Google otra vez. Los leads que ya produjo NO se borran.",
      accion: "Eliminar",
      peligro: true,
    });
    if (!ok) return;
    startAccion(async () => {
      const res = await eliminarTerritorio(t.id);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.push("/admin/territorios");
    });
  }

  function contactarNuevos() {
    const quedan = nuevos.length - paraHoy.length;
    void tanda.contactar(
      paraHoy,
      quedan > 0
        ? `Quedan ${quedan} nuevos para mañana: el tope es ${TANDA_SUGERIDA_DIA} mensajes al día para cuidar el número.`
        : undefined,
    );
  }

  return (
    <Cockpit>
      {dialogo}
      {tanda.dialogo}
      <PageHeader
        titulo={t.nombre}
        coletilla="territorio"
        subtitulo={
          <>
            <Link href="/admin/territorios" className="hover:text-tinta">
              Territorios
            </Link>{" "}
            / {t.ultimo_barrido ? `barrido ${fechaCorta(t.ultimo_barrido)}` : "sin barrer"} ·{" "}
            {resumen.llamadas} {resumen.llamadas === 1 ? "consulta" : "consultas"} ≈{" "}
            {formatoUsd(resumen.costoUsd)}
          </>
        }
        contador={
          cuenta && (
            <>
              <strong className="text-tinta-85">{cuenta.leads}</strong>{" "}
              {cuenta.leads === 1 ? "lead" : "leads"} ·{" "}
              <strong className="text-tinta-85">{cuenta.sinWeb}</strong> sin web
            </>
          )
        }
        acciones={
          <>
            <Link href={enMapa} className={`${LINK} bg-isla-alta text-tinta-85 hover:bg-acento-10 hover:text-tinta`}>
              Ver en el mapa
            </Link>
            <Link href={enMapa} className={`${LINK} bg-isla-alta text-tinta-85 hover:bg-acento-10 hover:text-tinta`}>
              Barrer en el mapa
            </Link>
            <Button
              variante="primaria"
              disabled={tanda.enviando || paraHoy.length === 0}
              title={paraHoy.length === 0 ? "No quedan locales nuevos con celular en este territorio" : undefined}
              onClick={contactarNuevos}
            >
              <Bot className="h-4 w-4" />
              {tanda.enviando
                ? "Enviando…"
                : `Contactar a los nuevos (${paraHoy.length}${nuevos.length > paraHoy.length ? ` de ${nuevos.length}` : ""})`}
            </Button>
            <IconButton etiqueta="Renombrar" disabled={ocupado} onClick={() => setRenombrando(true)}>
              <PencilLine className="h-4 w-4" />
            </IconButton>
            <IconButton etiqueta="Eliminar territorio" disabled={ocupado} onClick={() => void borrar()}>
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </>
        }
      />

      {hayAvisos && (
        <div className="flex shrink-0 flex-col gap-3 px-5 pt-4">
          {error && <Banner variante="error">{error}</Banner>}
          {tanda.aviso && <Banner>{tanda.aviso}</Banner>}
          {cruzado && (
            <Banner>
              Contorno cruzado: la zona cubierta dos veces cuenta como «fuera» — puede faltar
              censo aunque el barrido termine en 100 %.
            </Banner>
          )}
          {censo.tipo !== "completo" && (
            <Banner variante="error">
              «Contactar a los nuevos» cuenta solo los <strong>{negocios.length}</strong> locales más
              recientes{censo.tipo === "recortado" && <> de {censo.total}</>}. Los más antiguos que
              sigan en Nuevo se contactan desde la lista: filtra por «Nuevo» y selecciona la página.
            </Banner>
          )}
        </div>
      )}

      {negocios.length === 0 ? (
        <CockpitBody>
          <EmptyState
            titulo="Este territorio todavía no tiene locales."
            detalle="Bárrelo desde el mapa: los negocios con teléfono que haya dentro aterrizan aquí."
            accion={
              <Button variante="primaria" onClick={() => router.push(enMapa)}>
                Barrer en el mapa
              </Button>
            }
          />
        </CockpitBody>
      ) : (
        <NegociosView
          territorioFijo={t.id}
          recarga={`${versionLista}:${cuenta?.leads ?? ""}`}
          className={COCKPIT_ANIDADO}
          onAbrirLead={abrirLead}
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
      {renombrando && (
        <RenombrarTerritorio
          key={t.id}
          territorio={t}
          onCerrar={() => setRenombrando(false)}
          onRenombrado={() => {
            setRenombrando(false);
            router.refresh();
          }}
        />
      )}
    </Cockpit>
  );
}
