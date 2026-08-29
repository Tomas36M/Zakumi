"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, MessageSquare, Trash2 } from "lucide-react";
import { actualizarNegocio, cambiarEstadoLote, eliminarNegocios } from "@/lib/admin/actions";
import {
  CIUDADES,
  ESTADOS,
  labelEstado,
  type Ciudad,
  type EstadoNegocio,
  type Negocio,
} from "@/lib/admin/negocios";
import { sinMas } from "@/lib/admin/telefono";
import { agruparPorVertical, contactables } from "@/lib/admin/zak";
import { enviarTandaZak } from "@/lib/admin/zak-actions";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Field, Input, Select } from "@/components/admin/ui/Field";
import { ListRow } from "@/components/admin/ui/ListRow";

const LABEL_CIUDAD = new Map<string, string>(
  CIUDADES.map((c) => [c.valor, c.label]),
);
LABEL_CIUDAD.set("otra", "Otra");

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
  const [ciudad, setCiudad] = useState<Ciudad | "todas">("todas");
  const [estado, setEstado] = useState<EstadoNegocio | "todos">("todos");
  const [categoria, setCategoria] = useState<string>("todas");
  const [telefono, setTelefono] = useState<FiltroTelefono>("todos");
  const [seleccionados, setSeleccionados] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [estadoLote, setEstadoLote] = useState<EstadoNegocio>("contactado");
  const [aviso, setAviso] = useState<string | null>(null);

  const categorias = useMemo(() => {
    const set = new Set<string>();
    for (const n of negocios) if (n.categoria) set.add(n.categoria);
    return [...set].sort();
  }, [negocios]);

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

  function eliminarLote() {
    const n = seleccionActiva.length;
    if (
      !window.confirm(
        `¿Eliminar ${n} negocio(s) del CRM? Se borran también sus notas. ` +
          "Los clientes convertidos no se tocan y las conversaciones de Zak siguen en su bandeja.",
      )
    ) {
      return;
    }
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
    const n = contactablesZak.length;
    const fuera = seleccionActiva.length - n;
    const desglose = agruparPorVertical(contactablesZak)
      .map((g) => `${g.negocios.length} ${g.vertical.label}`)
      .join(" · ");
    const ok = window.confirm(
      `Zak abrirá conversación con ${n} negocio(s), cada tipo con SU plantilla:\n${desglose}` +
        (fuera > 0 ? `\n(${fuera} quedan fuera: sin celular, cliente o descartado.)` : "") +
        "\n\nCada envío inicia una conversación de marketing con costo de Meta, y el " +
        "número sin verificar admite máx. 250 iniciadas/día. Cuando respondan, Zak " +
        "conversa con el ángulo de cada vertical y marca a los interesados.\n\n¿Continuar?",
    );
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3" role="search">
        <div className="min-w-48 flex-1">
          <Field label="Buscar por nombre">
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="El Tornillo…"
            />
          </Field>
        </div>
        <div className="w-36">
          <Field label="Ciudad">
            <Select
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value as Ciudad | "todas")}
            >
              <option value="todas">Todas</option>
              {CIUDADES.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.label}
                </option>
              ))}
              <option value="otra">Otra</option>
            </Select>
          </Field>
        </div>
        <div className="w-36">
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
        </div>
        <div className="w-40">
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
        </div>
        <div className="w-36">
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
        <span className="h-control content-center text-sm text-tinta-60">
          <strong className="text-tinta">{filtrados.length}</strong> de{" "}
          {negocios.length}
        </span>
      </div>

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
            onClick={contactarConZak}
          >
            <Bot className="h-4 w-4" /> Que Zak los contacte ({contactablesZak.length})
          </Button>
          <Button variante="peligro" disabled={guardando} onClick={eliminarLote}>
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
            <div className={`${GRID_FILA} px-3 py-1.5 text-xs font-medium text-tinta-40`}>
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
            {filtrados.map((n) => (
              <ListRow
                key={n.id}
                interactiva={false}
                activa={seleccionados.has(n.id)}
                className={GRID_FILA}
              >
                <input
                  type="checkbox"
                  className="accent-acento"
                  aria-label={`Seleccionar ${n.nombre}`}
                  checked={seleccionados.has(n.id)}
                  onChange={() => alternar(n.id)}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-tinta">
                    {n.nombre}
                  </span>
                  {n.categoria ? (
                    <span className="block truncate text-xs text-tinta-40">
                      {n.categoria.replaceAll("_", " ")}
                    </span>
                  ) : null}
                </span>
                <span className="truncate text-sm text-tinta-60">
                  {LABEL_CIUDAD.get(n.ciudad)}
                </span>
                <span className="text-sm text-tinta-60">
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
                  {n.telefono && n.tipo_telefono === "movil" ? (
                    <Link
                      title="Chat Zak"
                      aria-label={`Chat de Zak con ${n.nombre}`}
                      href={`/admin/zak?telefono=${sinMas(n.telefono)}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-tinta-60 transition-colors hover:bg-isla-alta hover:text-tinta"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Link>
                  ) : null}
                </span>
              </ListRow>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
