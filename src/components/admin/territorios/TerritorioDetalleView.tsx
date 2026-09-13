"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PencilLine, Trash2 } from "lucide-react";
import { poligonoSeCruza } from "@/lib/admin/barrido";
import { fechaCorta, formatoUsd } from "@/lib/admin/formato";
import { estadoCenso, type Negocio } from "@/lib/admin/negocios";
import { resumenDeTerritorio, type CuentaTerritorio, type Territorio } from "@/lib/admin/territorios";
import { eliminarTerritorio } from "@/lib/admin/territorios-actions";
import type { EstadoVozZak } from "@/lib/admin/voz-estado";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Cockpit, CockpitBody } from "@/components/admin/ui/Cockpit";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { IconButton } from "@/components/admin/ui/IconButton";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { FichaLeadModal } from "@/components/admin/leads/FichaLeadModal";
import { FilaLeadCompacta, GRID_LEAD_COMPACTA } from "@/components/admin/leads/FilaLeadCompacta";
import { useFichaLead } from "@/components/admin/leads/useFichaLead";
import { RenombrarTerritorio } from "@/components/admin/prospeccion/RenombrarTerritorio";

const LINK = "inline-flex h-control items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors";

type Props = {
  territorio: Territorio;
  /** Los negocios de este territorio, topados a TOPE_LEADS. */
  negocios: Negocio[];
  /** Cuenta exacta del servidor (null si falló). */
  negociosTotal: number | null;
  cuenta: CuentaTerritorio | null;
  vozZak: EstadoVozZak;
};

/** La página de un territorio: sus números, sus acciones y sus locales. */
export function TerritorioDetalleView({ territorio: t, negocios, negociosTotal, cuenta, vozZak }: Props) {
  const router = useRouter();
  const { confirmar, dialogo } = useConfirmar();
  const [leadId, abrirLead] = useFichaLead();
  const [renombrando, setRenombrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, startAccion] = useTransition();

  const negocio = useMemo(
    () => (leadId ? (negocios.find((n) => n.id === leadId) ?? null) : null),
    [negocios, leadId],
  );
  const cuentas = useMemo(
    () => new Map(cuenta ? [[t.id, cuenta]] : []),
    [t.id, cuenta],
  );
  const resumen = resumenDeTerritorio(t, cuentas);
  const censo = estadoCenso(negocios.length, negociosTotal);
  const cruzado = useMemo(() => poligonoSeCruza(t.poligono), [t.poligono]);
  const enMapa = `/admin/prospeccion?tab=territorio&territorio=${t.id}`;

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

  return (
    <Cockpit>
      {dialogo}
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
            <Link href={enMapa} className={`${LINK} bg-acento text-white hover:bg-acento-85`}>
              Barrer en el mapa
            </Link>
            <IconButton etiqueta="Renombrar" disabled={ocupado} onClick={() => setRenombrando(true)}>
              <PencilLine className="h-4 w-4" />
            </IconButton>
            <IconButton etiqueta="Eliminar territorio" disabled={ocupado} onClick={() => void borrar()}>
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </>
        }
      />

      <CockpitBody>
        {error && <Banner variante="error">{error}</Banner>}
        {cruzado && (
          <Banner>
            Contorno cruzado: la zona cubierta dos veces cuenta como «fuera» — puede faltar
            censo aunque el barrido termine en 100 %.
          </Banner>
        )}
        {censo.tipo !== "completo" && (
          <Banner variante="error">
            Este territorio tiene más locales de los que caben en pantalla: se muestran los{" "}
            <strong>{negocios.length}</strong> más recientes
            {censo.tipo === "recortado" && <> de {censo.total}</>}.
          </Banner>
        )}

        {negocios.length === 0 ? (
          <EmptyState
            titulo="Este territorio todavía no tiene locales."
            detalle="Bárrelo desde el mapa: los negocios con teléfono que haya dentro aterrizan aquí."
            accion={
              <Button variante="primaria" onClick={() => router.push(enMapa)}>
                Barrer en el mapa
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-1">
            <div className={`${GRID_LEAD_COMPACTA} px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-tinta-40`}>
              <span className="w-2" aria-label="Estado" />
              <span>Local</span>
              <span>Teléfono</span>
              <span>Sitio web</span>
            </div>
            {negocios.map((n) => (
              <FilaLeadCompacta key={n.id} negocio={n} activa={n.id === leadId} onAbrir={abrirLead} />
            ))}
          </div>
        )}
      </CockpitBody>

      <FichaLeadModal
        leadId={leadId}
        negocio={negocio}
        vozZak={vozZak}
        onCerrar={() => abrirLead(null)}
        onCambio={() => router.refresh()}
        onEliminado={() => {
          abrirLead(null);
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
