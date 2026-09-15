"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actualizarNegocio, cambiarEstadoLote, eliminarNegocios } from "@/lib/admin/actions";
import { FILTRO_VACIO, filtrarLeads, type FiltroLeads } from "@/lib/admin/filtros-leads";
import { labelEstado, type EstadoNegocio, type Negocio } from "@/lib/admin/negocios";
import type { Territorio } from "@/lib/admin/territorios";
import { agruparPorVertical, contactables } from "@/lib/admin/zak";
import { enviarTandaZak } from "@/lib/admin/zak-actions";
import { Banner } from "@/components/admin/ui/Banner";
import { Cockpit, CockpitBody } from "@/components/admin/ui/Cockpit";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { AccionesLote } from "./AccionesLote";
import { FiltrosLeads } from "./FiltrosLeads";
import { TablaLeads } from "./TablaLeads";

type Props = {
  negocios: Negocio[];
  territorios?: Territorio[];
  /** Viaja al <Cockpit>: la cara Leads de /admin/prospeccion monta esta vista
   * DENTRO de otro cockpit, y dos cockpits anidados con la altura fija de
   * viewport se desbordan (vuelve el scroll de página). Ahí se le pasa
   * `min-[900px]:h-auto min-[900px]:min-h-0 min-[900px]:flex-1`. */
  className?: string;
  /** Abrir la ficha de un lead (el modal lo monta el dueño de la página). */
  onAbrirLead: (id: string) => void;
};

/** La lista de leads: filtros arriba fijos, resultados scrolleando debajo,
 * acciones en lote sobre lo seleccionado. */
export function NegociosView({ negocios, territorios = [], className, onAbrirLead }: Props) {
  const router = useRouter();
  const [guardando, startGuardar] = useTransition();
  const [filtro, setFiltro] = useState<FiltroLeads>(FILTRO_VACIO);
  const [seleccionados, setSeleccionados] = useState<ReadonlySet<string>>(new Set());
  const [estadoLote, setEstadoLote] = useState<EstadoNegocio>("contactado");
  const [aviso, setAviso] = useState<string | null>(null);
  const { confirmar, dialogo } = useConfirmar();

  const filtrados = useMemo(() => filtrarLeads(negocios, filtro), [negocios, filtro]);
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

  async function contactarConZak() {
    const n = contactablesZak.length;
    const fuera = seleccionActiva.length - n;
    const desglose = agruparPorVertical(contactablesZak)
      .map((g) => `${g.negocios.length} ${g.vertical.label}`)
      .join(" · ");
    const ok = await confirmar({
      titulo: `Zak abrirá conversación con ${n} negocio(s)`,
      mensaje:
        `Cada tipo con SU plantilla: ${desglose}.` +
        (fuera > 0 ? `\n(${fuera} quedan fuera: sin celular, cliente o descartado.)` : "") +
        "\n\nCada envío inicia una conversación de marketing con costo de Meta, y el " +
        "número sin verificar admite máx. 250 iniciadas/día. Cuando respondan, Zak " +
        "conversa con el ángulo de cada vertical y marca a los interesados.",
      accion: "Que Zak los contacte",
    });
    if (!ok) return;
    setAviso(null);
    startGuardar(async () => {
      const res = await enviarTandaZak(contactablesZak.map((x) => x.id));
      if ("error" in res) {
        setAviso(res.error);
        return;
      }
      setAviso(
        `Zak va a contactar a ${res.contactados} negocio(s)` +
          (res.duplicados > 0 ? `, ${res.duplicados} ya eran prospectos` : "") +
          (res.omitidos > 0 ? `, ${res.omitidos} quedaron fuera` : "") +
          ".",
      );
      setSeleccionados(new Set());
      router.refresh();
    });
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
      {/* El buscador se queda fijo arriba; los resultados scrollean debajo. */}
      <div className="shrink-0 px-5 pt-4">
        <FiltrosLeads
          filtro={filtro}
          onCambiar={setFiltro}
          negocios={negocios}
          territorios={territorios}
          visibles={filtrados.length}
        />
      </div>

      <CockpitBody>
        {seleccionActiva.length > 0 && (
          <AccionesLote
            cantidad={seleccionActiva.length}
            contactables={contactablesZak.length}
            guardando={guardando}
            estadoLote={estadoLote}
            onEstadoLote={setEstadoLote}
            onAplicar={aplicarLote}
            onContactar={() => void contactarConZak()}
            onEliminar={() => void eliminarLote()}
          />
        )}

        {aviso && <Banner>{aviso}</Banner>}

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
            guardando={guardando}
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
