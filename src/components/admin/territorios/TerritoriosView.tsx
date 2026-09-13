"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { poligonoSeCruza } from "@/lib/admin/barrido";
import {
  resumenDeTerritorio,
  type CuentasPorTerritorio,
  type Territorio,
} from "@/lib/admin/territorios";
import { Banner } from "@/components/admin/ui/Banner";
import { Cockpit, CockpitBody } from "@/components/admin/ui/Cockpit";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { GridCards } from "@/components/admin/ui/GridCards";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { TarjetaTerritorioCard } from "./TarjetaTerritorioCard";

const LINK_DIBUJAR =
  "inline-flex h-control items-center justify-center gap-2 rounded-full bg-acento px-4 text-sm font-medium text-white transition-colors hover:bg-acento-85";

type Props = {
  territorios: Territorio[];
  /** Cuentas exactas del servidor, o `null` si esa consulta falló. */
  cuentas: CuentasPorTerritorio | null;
  /** La consulta de territorios falló: la lista vacía no es «no hay». */
  fallaTerritorios: boolean;
};

/** Territorios: el grid de todo lo que ya se barrió (o se dibujó y espera). */
export function TerritoriosView({ territorios, cuentas, fallaTerritorios }: Props) {
  const router = useRouter();
  const mapa = useMemo(() => new Map(Object.entries(cuentas ?? {})), [cuentas]);
  const totalLeads = useMemo(
    () => Object.values(cuentas ?? {}).reduce((t, c) => t + c.leads, 0),
    [cuentas],
  );
  const cruces = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const t of territorios) m.set(t.id, poligonoSeCruza(t.poligono));
    return m;
  }, [territorios]);

  return (
    <Cockpit>
      <PageHeader
        titulo="Territorios"
        coletilla="lo que ya se barrió"
        contador={
          cuentas !== null && (
            <>
              <strong className="text-tinta-85">{territorios.length}</strong>{" "}
              {territorios.length === 1 ? "territorio" : "territorios"} ·{" "}
              <strong className="text-tinta-85">{totalLeads}</strong> leads
            </>
          )
        }
        acciones={
          <Link href="/admin/prospeccion?tab=territorio" className={LINK_DIBUJAR}>
            Dibujar en el mapa
          </Link>
        }
      />

      <CockpitBody>
        {cuentas === null && !fallaTerritorios && (
          <Banner variante="error">
            No se pudieron contar los leads por territorio: las tarjetas van sin cifras.
            Recarga en un momento.
          </Banner>
        )}

        {fallaTerritorios ? (
          // "Ningún territorio todavía" sobre una consulta caída es la mentira
          // cara de esta pantalla: invita a redibujar un área que ya existe.
          <Banner variante="error">
            No se pudieron cargar los territorios. La lista está vacía por el error, no
            porque no haya ninguno: <strong>no dibujes uno nuevo</strong> hasta que vuelva,
            o pagarás otra vez un área que ya está barrida. Recarga en un momento.
          </Banner>
        ) : territorios.length === 0 ? (
          <EmptyState
            titulo="Ningún territorio todavía"
            detalle="Dibuja un área sobre el mapa y ponle nombre. Barrerla llena el CRM con los negocios que hay dentro."
            accion={
              <Link href="/admin/prospeccion?tab=territorio" className={LINK_DIBUJAR}>
                Ir al mapa
              </Link>
            }
          />
        ) : (
          <GridCards>
            {territorios.map((t) => (
              <TarjetaTerritorioCard
                key={t.id}
                territorio={t}
                resumen={resumenDeTerritorio(t, mapa)}
                cruzado={cruces.get(t.id) ?? false}
                onAbrir={(id) => router.push(`/admin/territorios/${id}`)}
              />
            ))}
          </GridCards>
        )}
      </CockpitBody>
    </Cockpit>
  );
}
