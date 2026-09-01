"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import { useRouter } from "next/navigation";
import { Bot, MessageSquare, Trash2 } from "lucide-react";
import { actualizarNegocio, cambiarEstadoLote, eliminarNegocios } from "@/lib/admin/actions";
import {
  ciudadesDe,
  ESTADOS,
  labelEstado,
  type EstadoNegocio,
  type Negocio,
} from "@/lib/admin/negocios";
import { agruparPorVertical, contactables, linkChatZak } from "@/lib/admin/zak";
import { enviarTandaZak } from "@/lib/admin/zak-actions";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Cockpit, CockpitBody } from "@/components/admin/ui/Cockpit";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Field, Input, Select } from "@/components/admin/ui/Field";
import { Island } from "@/components/admin/ui/Island";
import { ListRow } from "@/components/admin/ui/ListRow";

// Punto de color del pipeline (clases literales: Tailwind no ve plantillas).
const COLOR_ESTADO: Record<EstadoNegocio, string> = {
  nuevo: "bg-estado-nuevo",
  contactado: "bg-estado-contactado",
  respondido: "bg-estado-respondido",
  interesado: "bg-estado-interesado",
  cliente: "bg-estado-cliente",
  descartado: "bg-estado-descartado",
};

const GRID_FILA =
  "grid grid-cols-[auto_minmax(0,3fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto_2.5rem] items-center gap-3";

type FiltroTelefono = "todos" | "con" | "sin";

export function NegociosView({ negocios }: { negocios: Negocio[] }) {
  const router = useRouter();
  const [guardando, startGuardar] = useTransition();
  const [q, setQ] = useState("");
  const [ciudad, setCiudad] = useState<string | "todas">("todas");
  const [estado, setEstado] = useState<EstadoNegocio | "todos">("todos");
  const [categoria, setCategoria] = useState<string>("todas");
  const [telefono, setTelefono] = useState<FiltroTelefono>("todos");
  const [seleccionados, setSeleccionados] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [estadoLote, setEstadoLote] = useState<EstadoNegocio>("contactado");
  const [aviso, setAviso] = useState<string | null>(null);
  const { confirmar, dialogo } = useConfirmar();

  const categorias = useMemo(() => {
    const set = new Set<string>();
    for (const n of negocios) if (n.categoria) set.add(n.categoria);
    return [...set].sort();
  }, [negocios]);

  const ciudades = useMemo(() => ciudadesDe(negocios), [negocios]);

  const filtrados = useMemo(() => {
    const texto = q.trim().toLowerCase();
    return negocios.filter((n) => {
      if (ciudad !== "todas" && n.ciudad !== ciudad) return false;
      if (estado !== "todos" && n.estado !== estado) return false;
      if (categoria !== "todas" && n.categoria !== categoria) return false;
      if (telefono === "con" && n.telefono === null) return false;
      if (telefono === "sin" && n.telefono !== null) return false;
      if (texto && !n.nombre.toLowerCase().includes(texto)) return false;
      return true;
    });
  }, [negocios, q, ciudad, estado, categoria, telefono]);

  const idsFiltrados = useMemo(
    () => new Set(filtrados.map((n) => n.id)),
    [filtrados],
  );
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
          ". Sigue el funnel en la pestaña Zak → Tandas.",
      );
      setSeleccionados(new Set());
      router.refresh();
    });
  }

  return (
    <Cockpit>
      {dialogo}
      {/* El buscador se queda fijo arriba; los resultados scrollean debajo. */}
      <div className="shrink-0 px-5 pt-4">
        <Island role="search" className="p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <Input
                type="search"
                className="h-12 min-w-64 flex-1 px-5 text-base"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar negocio por nombre — El Tornillo…"
                aria-label="Buscar por nombre"
              />
              <p className="whitespace-nowrap">
                <span className="font-editorial text-3xl italic text-tinta">
                  {filtrados.length}
                </span>
                <span className="text-sm text-tinta-40"> de {negocios.length} negocios</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
              <Field label="Ciudad">
                <Select value={ciudad} onChange={(e) => setCiudad(e.target.value)}>
                  <option value="todas">Todas</option>
                  {ciudades.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Estado">
                <Select
                  value={estado}
                  onChange={(e) =>
                    setEstado(e.target.value as EstadoNegocio | "todos")
                  }
                >
                  <option value="todos">Todos</option>
                  {ESTADOS.map((e) => (
                    <option key={e.valor} value={e.valor}>
                      {e.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Categoría">
                <Select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                >
                  <option value="todas">Todas</option>
                  {categorias.map((c) => (
                    <option key={c} value={c}>
                      {c.replaceAll("_", " ")}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Teléfono">
                <Select
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value as FiltroTelefono)}
                >
                  <option value="todos">Todos</option>
                  <option value="con">Con teléfono</option>
                  <option value="sin">Sin teléfono</option>
                </Select>
              </Field>
            </div>
          </div>
        </Island>
      </div>

      <CockpitBody>
        {seleccionActiva.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3 rounded-fila bg-isla-alta px-4 py-2.5">
            <span className="text-sm text-tinta">
              <strong>{seleccionActiva.length}</strong> seleccionados
            </span>
            <label className="flex items-center gap-2 text-xs font-medium text-tinta-60">
              Pasar a
              <span className="w-40">
                <Select
                  className="bg-isla"
                  value={estadoLote}
                  onChange={(e) => setEstadoLote(e.target.value as EstadoNegocio)}
                >
                  {ESTADOS.map((e) => (
                    <option key={e.valor} value={e.valor}>
                      {e.label}
                    </option>
                  ))}
                </Select>
              </span>
            </label>
            <Button disabled={guardando} onClick={aplicarLote}>
              {guardando ? "Aplicando…" : `Aplicar a ${seleccionActiva.length}`}
            </Button>
            <Button
              variante="primaria"
              disabled={guardando || contactablesZak.length === 0}
              title={
                contactablesZak.length === 0
                  ? "Ninguno de los seleccionados tiene celular contactable"
                  : undefined
              }
              onClick={() => void contactarConZak()}
            >
              <Bot className="h-4 w-4" /> Que Zak los contacte ({contactablesZak.length})
            </Button>
            <Button variante="peligro" disabled={guardando} onClick={() => void eliminarLote()}>
              <Trash2 className="h-4 w-4" /> Eliminar ({seleccionActiva.length})
            </Button>
          </div>
        ) : null}

        {aviso ? <Banner>{aviso}</Banner> : null}

        {negocios.length === 0 ? (
          <EmptyState
            titulo="Todavía no hay negocios."
            detalle="Ve al Mapa, busca «ferreterías en Ubaté» e importa los que tengan teléfono."
          />
        ) : filtrados.length === 0 ? (
          <EmptyState titulo="Ningún negocio coincide con esos filtros." />
        ) : (
          <div className="barra-fina overflow-x-auto">
            <div className="flex min-w-[680px] flex-col gap-1">
              <div
                className={`${GRID_FILA} px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-tinta-40`}
              >
                <input
                  type="checkbox"
                  className="accent-acento"
                  aria-label="Seleccionar todos los filtrados"
                  checked={
                    filtrados.length > 0 &&
                    seleccionActiva.length === filtrados.length
                  }
                  onChange={alternarTodos}
                />
                <span>Negocio</span>
                <span>Ciudad</span>
                <span>Teléfono</span>
                <span>Estado</span>
                <span aria-label="Acciones" />
              </div>
              {filtrados.map((n) => {
                const link = linkChatZak(n);
                return (
                  <ListRow
                    key={n.id}
                    interactiva={link !== null}
                    activa={seleccionados.has(n.id)}
                    className={`${GRID_FILA} py-3.5`}
                    // Conveniencia de mouse: la fila navega, pero cede ante los
                    // controles (checkbox/select/link) y ante una selección de
                    // texto (copiar el teléfono no debe botarte al chat). El
                    // link accesible/real es el ícono del final de la fila.
                    onClick={
                      link === null
                        ? undefined
                        : (e) => {
                            const objetivo = e.target as HTMLElement;
                            if (objetivo.closest("a, input, select, label, button")) return;
                            if (window.getSelection()?.toString()) return;
                            router.push(link);
                          }
                    }
                  >
                    <input
                      type="checkbox"
                      className="accent-acento"
                      aria-label={`Seleccionar ${n.nombre}`}
                      checked={seleccionados.has(n.id)}
                      onChange={() => alternar(n.id)}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-medium text-tinta">
                        {n.nombre}
                      </span>
                      {n.categoria ? (
                        <span className="block truncate text-xs text-tinta-40">
                          {n.categoria.replaceAll("_", " ")}
                        </span>
                      ) : null}
                    </span>
                    <span className="truncate text-sm text-tinta-60">
                      {n.ciudad ?? <span className="text-tinta-40">—</span>}
                    </span>
                    <span className="text-sm tabular-nums text-tinta-60">
                      {n.telefono ?? <span className="text-tinta-40">—</span>}
                      {n.tipo_telefono === "fijo" ? (
                        <span className="text-xs text-tinta-40"> fijo</span>
                      ) : null}
                    </span>
                    <label className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className={`h-2 w-2 shrink-0 rounded-full ${COLOR_ESTADO[n.estado]}`}
                      />
                      <Select
                        className="h-8 w-36 text-xs"
                        value={n.estado}
                        aria-label={`Estado de ${n.nombre}`}
                        disabled={guardando}
                        onChange={(e) => {
                          startGuardar(async () => {
                            await actualizarNegocio(n.id, {
                              estado: e.target.value as EstadoNegocio,
                            });
                            router.refresh();
                          });
                        }}
                      >
                        {ESTADOS.map((e) => (
                          <option key={e.valor} value={e.valor}>
                            {e.label}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <span className="flex justify-end">
                      {link !== null ? (
                        <Link
                          title="Chat Zak"
                          aria-label={`Chat de Zak con ${n.nombre}`}
                          href={link}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-tinta-60 transition-colors hover:bg-isla-alta hover:text-tinta"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Link>
                      ) : null}
                    </span>
                  </ListRow>
                );
              })}
            </div>
          </div>
        )}
      </CockpitBody>
    </Cockpit>
  );
}
