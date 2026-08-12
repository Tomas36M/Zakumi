"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CICLOS,
  TIPOS_PRODUCTO,
  descripcionVencimiento,
  formatearCOP,
  hoyBogota,
  ordenarPorUrgencia,
  semaforoCobro,
  type Cliente,
  type ProductoConCliente,
} from "@/lib/admin/cartera";
import { FichaCliente } from "./FichaCliente";
import { NuevoClienteForm } from "./NuevoClienteForm";

const LABEL_TIPO = new Map(TIPOS_PRODUCTO.map((t) => [t.valor, t.label]));
const LABEL_CICLO = new Map(CICLOS.map((c) => [c.valor, c.label]));

type Props = {
  productos: ProductoConCliente[];
  clientes: Cliente[];
  abrirInicial: string | null;
};

type Vista = "cobros" | "clientes";

export function ClientesView({ productos, clientes, abrirInicial }: Props) {
  const router = useRouter();
  const [vista, setVista] = useState<Vista>("cobros");
  const [seleccionId, setSeleccionId] = useState<string | null>(abrirInicial);
  const [creando, setCreando] = useState(false);

  const hoy = hoyBogota();

  const cobros = useMemo(
    () => ordenarPorUrgencia(productos.filter((p) => p.activo)),
    [productos],
  );

  const clienteSeleccionado = useMemo(
    () => clientes.find((c) => c.id === seleccionId) ?? null,
    [clientes, seleccionId],
  );

  const productosDelSeleccionado = useMemo(
    () => productos.filter((p) => p.cliente_id === seleccionId),
    [productos, seleccionId],
  );

  return (
    <div className="adm-clientes">
      <div className="adm-toolbar">
        <div className="adm-chips" role="group" aria-label="Vista">
          <button
            type="button"
            className={vista === "cobros" ? "adm-chip adm-chip--activa" : "adm-chip"}
            onClick={() => setVista("cobros")}
          >
            Próximos cobros
          </button>
          <button
            type="button"
            className={vista === "clientes" ? "adm-chip adm-chip--activa" : "adm-chip"}
            onClick={() => setVista("clientes")}
          >
            Clientes
          </button>
        </div>
        <span className="adm-toolbar-conteo">
          <strong className="adm-cifra">{clientes.length}</strong> clientes ·{" "}
          <strong className="adm-cifra">{cobros.length}</strong> cobros activos
        </span>
        <button
          type="button"
          className="adm-cta-ghost"
          onClick={() => {
            setCreando(true);
            setSeleccionId(null);
          }}
        >
          Nuevo cliente
        </button>
      </div>

      <div className="adm-clientes-layout">
        <div className="adm-clientes-tabla">
          {vista === "cobros" ? (
            cobros.length === 0 ? (
              <p className="adm-tabla-vacia">
                Todavía no hay cobros programados. Crea un cliente y agrégale su
                primer producto — el bot, su página web, lo que le vendas.
              </p>
            ) : (
              <div className="adm-tabla-scroll">
                <table className="adm-tabla">
                  <thead>
                    <tr>
                      <th aria-label="Estado" className="adm-th-check" />
                      <th>Cliente</th>
                      <th>Producto</th>
                      <th>Tarifa</th>
                      <th>Próximo cobro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cobros.map((p) => {
                      const estado = semaforoCobro(p.proxima_fecha, hoy);
                      return (
                        <tr
                          key={p.id}
                          className={
                            p.cliente_id === seleccionId ? "adm-tr--activa" : ""
                          }
                          onClick={() => {
                            setCreando(false);
                            setSeleccionId(p.cliente_id);
                          }}
                        >
                          <td className="adm-th-check">
                            <span
                              className={`adm-badge adm-badge--sem-${estado}`}
                              title={estado.replaceAll("_", " ")}
                            />
                          </td>
                          <td>
                            <span className="adm-tabla-nombre">
                              {p.clientes?.nombre ?? "—"}
                            </span>
                          </td>
                          <td>
                            <span className="adm-tabla-nombre">{p.nombre}</span>
                            <span className="adm-tabla-categoria">
                              {LABEL_TIPO.get(p.tipo)}
                              {p.dominio ? ` · ${p.dominio}` : ""}
                            </span>
                          </td>
                          <td className="adm-tabla-telefono">
                            {formatearCOP(p.tarifa)}
                            <span className="adm-tabla-fijo">
                              {" "}
                              {LABEL_CICLO.get(p.ciclo)}
                            </span>
                          </td>
                          <td
                            className={
                              estado === "vencido" ? "adm-cobro-vencido" : ""
                            }
                          >
                            {descripcionVencimiento(p.proxima_fecha, hoy)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : clientes.length === 0 ? (
            <p className="adm-tabla-vacia">
              Sin clientes todavía. Los puedes crear aquí o convertir un negocio
              del CRM desde su ficha en el mapa.
            </p>
          ) : (
            <div className="adm-tabla-scroll">
              <table className="adm-tabla">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Teléfono</th>
                    <th>Productos</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c) => {
                    const suyos = productos.filter((p) => p.cliente_id === c.id);
                    return (
                      <tr
                        key={c.id}
                        className={c.id === seleccionId ? "adm-tr--activa" : ""}
                        onClick={() => {
                          setCreando(false);
                          setSeleccionId(c.id);
                        }}
                      >
                        <td>
                          <span className="adm-tabla-nombre">{c.nombre}</span>
                          {c.email ? (
                            <span className="adm-tabla-categoria">{c.email}</span>
                          ) : null}
                        </td>
                        <td className="adm-tabla-telefono">
                          {c.telefono ?? <span className="adm-ficha-sin">—</span>}
                        </td>
                        <td>
                          <strong className="adm-cifra">{suyos.length}</strong>
                        </td>
                        <td className="adm-tabla-ciudad">
                          {c.activo ? "Activo" : "Inactivo"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="adm-ficha" aria-label="Detalle del cliente">
          {creando ? (
            <NuevoClienteForm
              onCreado={(id) => {
                setCreando(false);
                setSeleccionId(id);
                router.refresh();
              }}
              onCancelar={() => setCreando(false)}
            />
          ) : clienteSeleccionado ? (
            <FichaCliente
              key={clienteSeleccionado.id}
              cliente={clienteSeleccionado}
              productos={productosDelSeleccionado}
              hoy={hoy}
              onCambio={() => router.refresh()}
              onCerrar={() => setSeleccionId(null)}
            />
          ) : (
            <p className="adm-ficha-vacia">
              Toca un cobro o un cliente para ver su ficha. Cada producto que le
              vendas — bot, página web, CRM — lleva su tarifa y su próxima fecha
              de cobro.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
