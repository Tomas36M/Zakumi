"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actualizarNegocio, cambiarEstadoLote, eliminarNegocios } from "@/lib/admin/actions";
import { FILTRO_VACIO, filtrarLeads, type FiltroLeads } from "@/lib/admin/filtros-leads";
import { conteoPorEstado, labelEstado, type EstadoNegocio, type Negocio } from "@/lib/admin/negocios";
import type { Territorio } from "@/lib/admin/territorios";
import { contactables } from "@/lib/admin/zak";
import { Banner } from "@/components/admin/ui/Banner";
import { Cockpit, CockpitBody } from "@/components/admin/ui/Cockpit";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { AccionesLote } from "./AccionesLote";
import { FiltrosLeads } from "./FiltrosLeads";
import { TablaLeads } from "./TablaLeads";
import { useTandaZak } from "./useTandaZak";

type Props = {
  negocios: Negocio[];
  territorios?: Territorio[];
  /** Viaja al <Cockpit>: la cara Leads de /admin/prospeccion y la página de un
   * territorio montan esta vista DENTRO de otro cockpit, y dos cockpits
   * anidados con la altura fija de viewport se desbordan (vuelve el scroll de
   * página). Ahí se le pasa
   * `min-[900px]:h-auto min-[900px]:min-h-0 min-[900px]:flex-1`. */
  className?: string;
  /** Abrir la ficha de un lead (el modal lo monta el dueño de la página). */
  onAbrirLead: (id: string) => void;
  /** La lista vive en la página de UN territorio: sin select de territorio. */
  territorioFijo?: boolean;
};

/** La lista de leads: filtros arriba fijos, resultados scrolleando debajo,
 * acciones en lote sobre lo seleccionado. */
export function NegociosView({
  negocios,
  territorios = [],
  className,
  onAbrirLead,
  territorioFijo = false,
}: Props) {
  const router = useRouter();
  const [guardando, startGuardar] = useTransition();
  const [filtro, setFiltro] = useState<FiltroLeads>(FILTRO_VACIO);
  const [seleccionados, setSeleccionados] = useState<ReadonlySet<string>>(new Set());
  const [estadoLote, setEstadoLote] = useState<EstadoNegocio>("contactado");
  const [aviso, setAviso] = useState<string | null>(null);
  const { confirmar, dialogo } = useConfirmar();
  const tanda = useTandaZak(() => setSeleccionados(new Set()));
  const ocupado = guardando || tanda.enviando;

  const filtrados = useMemo(() => filtrarLeads(negocios, filtro), [negocios, filtro]);
  // La franja cuenta con todos los filtros menos el de estado: dice cuántos
  // hay en cada estado dentro de lo que se está mirando.
  const conteos = useMemo(
    () => conteoPorEstado(filtrarLeads(negocios, { ...filtro, estados: [] })),
    [negocios, filtro],
  );
  const idsFiltrados = useMemo(() => new Set(filtrados.map((n) => n.id)), [filtrados]);
  const seleccionActiva = [...seleccionados].filter((id) => idsFiltrados.has(id));
  const seleccionSet = new Set(seleccionActiva);
  const contactablesZak = contactables(filtrados.filter((n) => seleccionSet.has(n.id)));

  function alternar(id: string) {
    setSeleccionados((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  function alternarTodos() {
    setSeleccionados((prev) =>
      seleccionActiva.length === filtrados.length && filtrados.length > 0
        ? new Set([...prev].filter((id) => !idsFiltrados.has(id)))
        : new Set([...prev, ...idsFiltrados]),
    );
  }

  function aplicarLote() {
    setAviso(null);
    startGuardar(async () => {
      const res = await cambiarEstadoLote(seleccionActiva, estadoLote);
      if ("error" in res) {
        setAviso(res.error);
        return;
      }
      setAviso(`${res.actualizados} negocios pasaron a «${labelEstado(estadoLote)}».`);
      setSeleccionados(new Set());
      router.refresh();
    });
  }

  async function eliminarLote() {
    const n = seleccionActiva.length;
    const ok = await confirmar({
      titulo: `¿Eliminar ${n} negocio(s) del CRM?`,
      mensaje:
        "Se borran también sus notas. Los clientes convertidos no se tocan y las conversaciones de Zak siguen en su bandeja.",
      accion: "Eliminar",
      peligro: true,
    });
    if (!ok) return;
    setAviso(null);
    startGuardar(async () => {
      const res = await eliminarNegocios(seleccionActiva);
      if ("error" in res) {
        setAviso(res.error);
        return;
      }
      setAviso(`${res.eliminados} negocio(s) eliminados.`);
      setSeleccionados(new Set());
      router.refresh();
    });
  }

  function contactarConZak() {
    const fuera = seleccionActiva.length - contactablesZak.length;
    void tanda.contactar(
      contactablesZak,
      fuera > 0 ? `${fuera} quedan fuera: sin celular, cliente o descartado.` : undefined,
    );
  }

  function cambiarEstado(id: string, estado: EstadoNegocio) {
    startGuardar(async () => {
      await actualizarNegocio(id, { estado });
      router.refresh();
    });
  }

  return (
    <Cockpit className={className}>
      {dialogo}
      {tanda.dialogo}
      {/* El buscador se queda fijo arriba; los resultados scrollean debajo. */}
      <div className="shrink-0 px-5 pt-4">
        <FiltrosLeads
          filtro={filtro}
          onCambiar={setFiltro}
          negocios={negocios}
          territorios={territorios}
          visibles={filtrados.length}
          conteos={conteos}
          ocultarTerritorio={territorioFijo}
        />
      </div>

      <CockpitBody>
        {seleccionActiva.length > 0 && (
          <AccionesLote
            cantidad={seleccionActiva.length}
            contactables={contactablesZak.length}
            guardando={ocupado}
            estadoLote={estadoLote}
            onEstadoLote={setEstadoLote}
            onAplicar={aplicarLote}
            onContactar={contactarConZak}
            onEliminar={() => void eliminarLote()}
          />
        )}

        {aviso && <Banner>{aviso}</Banner>}
        {tanda.aviso && <Banner>{tanda.aviso}</Banner>}

        {negocios.length === 0 ? (
          <EmptyState
            titulo="Todavía no hay negocios."
            detalle="Ve a Territorio, dibuja el área que quieras trabajar y bárrela: los negocios con teléfono que haya adentro aterrizan solos en esta lista."
          />
        ) : filtrados.length === 0 ? (
          <EmptyState titulo="Ningún negocio coincide con esos filtros." />
        ) : (
          <TablaLeads
            negocios={filtrados}
            seleccionados={seleccionados}
            guardando={ocupado}
            onAlternar={alternar}
            onAlternarTodos={alternarTodos}
            onEstado={cambiarEstado}
            onAbrir={onAbrirLead}
          />
        )}
      </CockpitBody>
    </Cockpit>
  );
}
