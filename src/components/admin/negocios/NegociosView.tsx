"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actualizarNegocio, cambiarEstadoLote, eliminarNegocios } from "@/lib/admin/actions";
import {
  CIUDADES,
  ESTADOS,
  type Ciudad,
  type EstadoNegocio,
  type Negocio,
} from "@/lib/admin/negocios";
import { sinMas } from "@/lib/admin/telefono";
import { contactables } from "@/lib/admin/zak";
import { enviarTandaZak } from "@/lib/admin/zak-actions";

const LABEL_CIUDAD = new Map<string, string>(
  CIUDADES.map((c) => [c.valor, c.label]),
);
LABEL_CIUDAD.set("otra", "Otra");

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
      const label = ESTADOS.find((e) => e.valor === estadoLote)?.label;
      setAviso(`${res.actualizados} negocios pasaron a «${label}».`);
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
    const ok = window.confirm(
      `Zak les enviará la plantilla «saludo_zakumi» por WhatsApp a ${n} negocio(s)` +
        (fuera > 0 ? ` (${fuera} quedan fuera: sin celular, cliente o descartado).` : ".") +
        "\n\nCada envío inicia una conversación de marketing con costo de Meta, y el " +
        "número sin verificar admite máx. 250 iniciadas/día. Cuando respondan, Zak " +
        "conversa solo y marca a los interesados.\n\n¿Continuar?",
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
    <div className="adm-negocios">
      <div className="adm-filtros" role="search">
        <label className="adm-field adm-filtro-q">
          <span className="adm-field-label">Buscar por nombre</span>
          <input
            className="adm-input"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="El Tornillo…"
          />
        </label>
        <label className="adm-field">
          <span className="adm-field-label">Ciudad</span>
          <select
            className="adm-select"
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
          </select>
        </label>
        <label className="adm-field">
          <span className="adm-field-label">Estado</span>
          <select
            className="adm-select"
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
          </select>
        </label>
        <label className="adm-field">
          <span className="adm-field-label">Categoría</span>
          <select
            className="adm-select"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            <option value="todas">Todas</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="adm-field">
          <span className="adm-field-label">Teléfono</span>
          <select
            className="adm-select"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value as FiltroTelefono)}
          >
            <option value="todos">Todos</option>
            <option value="con">Con teléfono</option>
            <option value="sin">Sin teléfono</option>
          </select>
        </label>
        <span className="adm-filtros-conteo">
          <strong className="adm-cifra">{filtrados.length}</strong> de{" "}
          {negocios.length}
        </span>
      </div>

      {seleccionActiva.length > 0 ? (
        <div className="adm-lote-bar">
          <span>
            <strong className="adm-cifra">{seleccionActiva.length}</strong>{" "}
            seleccionados
          </span>
          <label className="adm-field adm-lote-select">
            <span className="adm-field-label">Pasar a</span>
            <select
              className="adm-select"
              value={estadoLote}
              onChange={(e) => setEstadoLote(e.target.value as EstadoNegocio)}
            >
              {ESTADOS.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="adm-cta"
            type="button"
            disabled={guardando}
            onClick={aplicarLote}
          >
            {guardando ? "Aplicando…" : `Aplicar a ${seleccionActiva.length}`}
          </button>
          <button
            className="adm-cta"
            type="button"
            disabled={guardando || contactablesZak.length === 0}
            title={
              contactablesZak.length === 0
                ? "Ninguno de los seleccionados tiene celular contactable"
                : undefined
            }
            onClick={contactarConZak}
          >
            🧡 Que Zak los contacte ({contactablesZak.length})
          </button>
          <button
            className="adm-cta-ghost adm-cta--peligro"
            type="button"
            disabled={guardando}
            onClick={eliminarLote}
          >
            🗑 Eliminar ({seleccionActiva.length})
          </button>
        </div>
      ) : null}

      {aviso ? (
        <p className="adm-aviso" role="status">
          {aviso}
        </p>
      ) : null}

      {negocios.length === 0 ? (
        <p className="adm-tabla-vacia">
          Todavía no hay negocios. Ve al Mapa, busca «ferreterías en Ubaté» e
          importa los que tengan teléfono.
        </p>
      ) : filtrados.length === 0 ? (
        <p className="adm-tabla-vacia">
          Ningún negocio coincide con esos filtros.
        </p>
      ) : (
        <div className="adm-tabla-scroll">
          <table className="adm-tabla">
            <thead>
              <tr>
                <th className="adm-th-check">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todos los filtrados"
                    checked={
                      filtrados.length > 0 &&
                      seleccionActiva.length === filtrados.length
                    }
                    onChange={alternarTodos}
                  />
                </th>
                <th>Negocio</th>
                <th>Ciudad</th>
                <th>Teléfono</th>
                <th>Estado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((n) => (
                <tr
                  key={n.id}
                  className={seleccionados.has(n.id) ? "adm-tr--activa" : ""}
                >
                  <td className="adm-th-check">
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${n.nombre}`}
                      checked={seleccionados.has(n.id)}
                      onChange={() => alternar(n.id)}
                    />
                  </td>
                  <td>
                    <span className="adm-tabla-nombre">{n.nombre}</span>
                    {n.categoria ? (
                      <span className="adm-tabla-categoria">
                        {n.categoria.replaceAll("_", " ")}
                      </span>
                    ) : null}
                  </td>
                  <td className="adm-tabla-ciudad">
                    {LABEL_CIUDAD.get(n.ciudad)}
                  </td>
                  <td className="adm-tabla-telefono">
                    {n.telefono ?? <span className="adm-ficha-sin">—</span>}
                    {n.tipo_telefono === "fijo" ? (
                      <span className="adm-tabla-fijo"> fijo</span>
                    ) : null}
                  </td>
                  <td>
                    <label className="adm-badge-select">
                      <span className={`adm-badge adm-badge--${n.estado}`} />
                      <select
                        className="adm-select adm-select-estado"
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
                      </select>
                    </label>
                  </td>
                  <td className="adm-tabla-acciones">
                    {n.telefono && n.tipo_telefono === "movil" ? (
                      <Link
                        className="adm-tabla-wa"
                        href={`/admin/zak?telefono=${sinMas(n.telefono)}`}
                      >
                        Chat Zak
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
