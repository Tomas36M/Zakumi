"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actualizarNegocio, cambiarEstadoLote, eliminarNegocios } from "@/lib/admin/actions";
import { FILTRO_VACIO, hayFiltro, type FiltroLeads } from "@/lib/admin/filtros-leads";
import {
  paramsDeFiltro,
  rangoEnPantalla,
  type OpcionesLeads,
  type RespuestaLeads,
} from "@/lib/admin/leads-consulta";
import { conteoPorEstado, labelEstado, type EstadoNegocio } from "@/lib/admin/negocios";
import { LEADS_POR_PAGINA, totalDePaginas } from "@/lib/admin/paginacion";
import type { Territorio } from "@/lib/admin/territorios";
import { contactables } from "@/lib/admin/zak";
import { cn } from "@/lib/cn";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Cockpit, CockpitBody } from "@/components/admin/ui/Cockpit";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Paginador } from "@/components/admin/ui/Paginador";
import { AccionesLote } from "./AccionesLote";
import { FiltrosLeads } from "./FiltrosLeads";
import { TablaLeads } from "./TablaLeads";
import { useTandaZak } from "./useTandaZak";

type Props = {
  territorios?: Territorio[];
  /** Viaja al <Cockpit>: la cara Leads de /admin/prospeccion y la página de un
   * territorio montan esta vista DENTRO de otro cockpit, y dos cockpits
   * anidados con la altura fija de viewport se desbordan (vuelve el scroll de
   * página). Ahí se le pasa
   * `min-[900px]:h-auto min-[900px]:min-h-0 min-[900px]:flex-1`. */
  className?: string;
  /** Abrir la ficha de un lead (el modal lo monta el dueño de la página). */
  onAbrirLead: (id: string) => void;
  /** La lista vive en la página de UN territorio: su id. Sin select de territorio. */
  territorioFijo?: string;
  /** Cuando cambia, la página actual se vuelve a pedir: el dueño cambió algo por
   * fuera de la lista (la ficha de un lead, un envío, la cuenta de la base). */
  recarga?: string;
};

const OPCIONES_VACIAS: OpcionesLeads = { ciudades: [], categorias: [] };
const CONTEOS_VACIOS = conteoPorEstado([]);
/** Espera tras el último tecleo antes de pedir: una consulta por palabra, no por letra. */
const ESPERA_TECLEO_MS = 300;

/** La última respuesta que llegó y la consulta que la pidió. */
type Resultado = { clave: string; respuesta: RespuestaLeads };

/** La lista de leads, paginada de a 50 contra la base entera: filtros arriba
 * fijos, la página debajo, acciones en lote sobre lo seleccionado. */
export function NegociosView({
  territorios = [],
  className,
  onAbrirLead,
  territorioFijo,
  recarga = "",
}: Props) {
  const router = useRouter();
  const [guardando, startGuardar] = useTransition();
  const [filtro, setFiltro] = useState<FiltroLeads>(FILTRO_VACIO);
  // El texto que ya viaja a la base: `filtro.q` 300 ms después del último tecleo.
  const [qAplicada, setQAplicada] = useState("");
  // La página vive con los filtros, en el estado de la lista. En la URL
  // describiría una página de una lista que la URL no identifica (los filtros
  // no viajan), y se escribiría en otro render que el filtro: dos consultas.
  const [pagina, setPagina] = useState(1);
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [fallida, setFallida] = useState<string | null>(null);
  const [opciones, setOpciones] = useState<OpcionesLeads | null>(null);
  // De qué territorio y de qué recarga son las opciones que ya llegaron. Ref y
  // no estado: pedir o no las opciones no debe cambiar la clave de la consulta.
  const opcionesDe = useRef<string | null>(null);
  const [seleccionados, setSeleccionados] = useState<ReadonlySet<string>>(new Set());
  const [estadoLote, setEstadoLote] = useState<EstadoNegocio>("contactado");
  const [aviso, setAviso] = useState<string | null>(null);
  const { confirmar, dialogo } = useConfirmar();

  function recargar() {
    setIntento((i) => i + 1);
  }

  const tanda = useTandaZak(() => {
    setSeleccionados(new Set());
    recargar();
  });
  const ocupado = guardando || tanda.enviando;

  const consulta = paramsDeFiltro(
    { ...filtro, q: qAplicada, territorio: territorioFijo ?? filtro.territorio },
    pagina,
  ).toString();
  const clave = `${consulta}#${recarga}#${intento}`;

  // El buscador: aplica el texto cuando se deja de teclear y, en el mismo
  // render, vuelve a la página 1 y suelta la selección (una sola consulta).
  useEffect(() => {
    const q = filtro.q.trim();
    if (q === qAplicada) return;
    const espera = setTimeout(() => {
      setQAplicada(q);
      setPagina(1);
      setSeleccionados(new Set());
    }, ESPERA_TECLEO_MS);
    return () => clearTimeout(espera);
  }, [filtro.q, qAplicada]);

  // La página: una consulta por clave. La respuesta vieja que llega tarde se
  // descarta (`activo`) y el fetch en vuelo se cancela. Las opciones de los
  // selects viajan con la primera consulta, al cambiar el territorio y en cada
  // recarga: un barrido trae ciudades y categorías nuevas.
  useEffect(() => {
    const control = new AbortController();
    let activo = true;
    const params = new URLSearchParams(consulta);
    const deOpciones = `${params.get("territorio") ?? "todos"}#${recarga}`;
    if (opcionesDe.current !== deOpciones) params.set("opciones", "1");
    void (async () => {
      try {
        const res = await fetch(`/admin/api/leads?${params.toString()}`, { signal: control.signal });
        if (!res.ok) throw new Error(String(res.status));
        const respuesta = (await res.json()) as RespuestaLeads;
        if (!activo) return;
        // Si se pidió una página que ya no existe (filas borradas), la ruta
        // respondió la última: se muestra tal cual (`paginaVista`), sin pedirla
        // otra vez.
        setResultado({ clave, respuesta });
        setFallida(null);
        if (respuesta.opciones) {
          opcionesDe.current = deOpciones;
          setOpciones(respuesta.opciones);
        }
      } catch {
        if (activo) setFallida(clave);
      }
    })();
    return () => {
      activo = false;
      control.abort();
    };
  }, [clave, consulta, recarga]);

  const respuesta = resultado?.respuesta ?? null;
  const cargando = resultado?.clave !== clave && fallida !== clave;
  const fallo = fallida === clave;
  const filas = respuesta?.filas ?? [];
  const total = respuesta?.total ?? 0;
  const paginaVista = respuesta?.pagina ?? pagina;
  const elegidos = filas.filter((n) => seleccionados.has(n.id));
  const seleccionActiva = elegidos.map((n) => n.id);
  const contactablesZak = contactables(elegidos);

  function cambiarFiltro(nuevo: FiltroLeads) {
    // FiltrosLeads cambia una clave por vez. El texto espera al buscador (efecto
    // de arriba); cualquier otro filtro vuelve a la página 1 y suelta la
    // selección en el mismo render.
    const soloTexto = nuevo.q !== filtro.q;
    setFiltro(nuevo);
    if (soloTexto) return;
    setPagina(1);
    setSeleccionados(new Set());
  }

  function irAPagina(n: number) {
    setPagina(n);
    setSeleccionados(new Set());
  }

  function alternar(id: string) {
    setSeleccionados((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  function alternarTodos() {
    // «Todos» es la página visible: exactamente una tanda de Zak.
    const todos = filas.length > 0 && filas.every((n) => seleccionados.has(n.id));
    setSeleccionados(todos ? new Set() : new Set(filas.map((n) => n.id)));
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
      recargar();
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
      recargar();
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
      recargar();
      router.refresh();
    });
  }

  return (
    <Cockpit className={className}>
      {dialogo}
      {tanda.dialogo}
      {/* El buscador se queda fijo arriba; la página scrollea debajo. */}
      <div className="shrink-0 px-5 pt-4">
        <FiltrosLeads
          filtro={filtro}
          onCambiar={cambiarFiltro}
          opciones={opciones ?? OPCIONES_VACIAS}
          territorios={territorios}
          total={respuesta ? total : null}
          enPantalla={rangoEnPantalla(paginaVista, filas.length, LEADS_POR_PAGINA)}
          conteos={respuesta?.conteos ?? CONTEOS_VACIOS}
          ocultarTerritorio={territorioFijo !== undefined}
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
        {fallo && (
          <Banner variante="error">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                No se pudo cargar la lista de negocios
                {respuesta ? ": lo que ves es de la consulta anterior." : "."}
              </span>
              <Button onClick={recargar}>Reintentar</Button>
            </div>
          </Banner>
        )}

        {respuesta === null ? (
          !fallo && (
            <p role="status" className="px-3 py-6 text-sm text-tinta-40">
              Cargando…
            </p>
          )
        ) : (
          <>
            {cargando && (
              <p role="status" className="px-3 text-xs text-tinta-40">
                Cargando…
              </p>
            )}
            <div
              // Mientras llega la página nueva, la vieja se ve pero no se toca: un
              // clic o una selección sobre ella actuaría sobre filas que ya se fueron.
              inert={cargando}
              className={cn("flex flex-col gap-3 transition-opacity", cargando && "opacity-60")}
            >
              {total === 0 ? (
                hayFiltro({ ...filtro, q: qAplicada }) ? (
                  <EmptyState titulo="Ningún negocio coincide con esos filtros." />
                ) : territorioFijo !== undefined ? (
                  <EmptyState titulo="Este territorio todavía no tiene locales." />
                ) : (
                  <EmptyState
                    titulo="Todavía no hay negocios."
                    detalle="Ve a Territorio, dibuja el área que quieras trabajar y bárrela: los negocios con teléfono que haya adentro aterrizan solos en esta lista."
                  />
                )
              ) : (
                <>
                  <TablaLeads
                    negocios={filas}
                    seleccionados={seleccionados}
                    guardando={ocupado}
                    onAlternar={alternar}
                    onAlternarTodos={alternarTodos}
                    onEstado={cambiarEstado}
                    onAbrir={onAbrirLead}
                  />
                  <Paginador
                    pagina={paginaVista}
                    totalPaginas={totalDePaginas(total, LEADS_POR_PAGINA)}
                    onPagina={irAPagina}
                  />
                </>
              )}
            </div>
          </>
        )}
      </CockpitBody>
    </Cockpit>
  );
}
