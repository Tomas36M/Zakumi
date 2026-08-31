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
  type Semaforo,
} from "@/lib/admin/cartera";
import { Button } from "@/components/admin/ui/Button";
import { Cockpit, CockpitBody } from "@/components/admin/ui/Cockpit";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { ListRow } from "@/components/admin/ui/ListRow";
import { Tabs } from "@/components/admin/ui/Tabs";
import { FichaCliente } from "./FichaCliente";
import { NuevoClienteForm } from "./NuevoClienteForm";

const LABEL_TIPO = new Map(TIPOS_PRODUCTO.map((t) => [t.valor, t.label]));
const LABEL_CICLO = new Map(CICLOS.map((c) => [c.valor, c.label]));

// Punto de color del semáforo de cobro (clases literales para Tailwind).
const COLOR_SEMAFORO: Record<Semaforo, string> = {
  al_dia: "bg-vivo",
  por_vencer: "bg-estado-contactado",
  vencido: "bg-peligro",
  sin_programar: "bg-tinta-40/40",
};

const GRID_COBRO =
  "grid grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3";
const GRID_CLIENTE =
  "grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto_minmax(0,0.8fr)] items-center gap-3";

type Props = {
  productos: ProductoConCliente[];
  clientes: Cliente[];
  abrirInicial: string | null;
};

type Vista = "cobros" | "clientes";

const VISTAS = [
  { id: "cobros", label: "Próximos cobros" },
  { id: "clientes", label: "Clientes" },
] as const;

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
    <Cockpit>
      {/* Pestañas y acciones: alto natural, siempre a la vista. */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <Tabs pestanas={VISTAS} activa={vista} onCambiar={setVista} />
        <span className="text-xs text-tinta-40">
          <strong className="text-tinta-85">{clientes.length}</strong> clientes ·{" "}
          <strong className="text-tinta-85">{cobros.length}</strong> cobros activos
        </span>
        <Button
          onClick={() => {
            setCreando(true);
            setSeleccionId(null);
          }}
        >
          Nuevo cliente
        </Button>
      </div>

      <CockpitBody>
        <div className="grid items-start gap-aire min-[1000px]:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            {vista === "cobros" ? (
              cobros.length === 0 ? (
                <EmptyState
                  titulo="Todavía no hay cobros programados."
                  detalle="Crea un cliente y agrégale su primer producto — el bot, su página web, lo que le vendas."
                />
              ) : (
                <div className="barra-fina overflow-x-auto">
                  <div className="flex min-w-[560px] flex-col gap-1">
                    <div className={`${GRID_COBRO} px-3 py-1.5 text-xs font-medium text-tinta-40`}>
                      <span className="w-2" aria-label="Estado" />
                      <span>Cliente</span>
                      <span>Producto</span>
                      <span>Tarifa</span>
                      <span>Próximo cobro</span>
                    </div>
                    {cobros.map((p) => {
                      const estado = semaforoCobro(p.proxima_fecha, hoy);
                      return (
                        <ListRow
                          key={p.id}
                          activa={p.cliente_id === seleccionId}
                          className={GRID_COBRO}
                          onClick={() => {
                            setCreando(false);
                            setSeleccionId(p.cliente_id);
                          }}
                        >
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${COLOR_SEMAFORO[estado]}`}
                            title={estado.replaceAll("_", " ")}
                          />
                          <span className="truncate text-sm font-medium text-tinta">
                            {p.clientes?.nombre ?? "—"}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-tinta">
                              {p.nombre}
                            </span>
                            <span className="block truncate text-xs text-tinta-40">
                              {LABEL_TIPO.get(p.tipo)}
                              {p.dominio ? ` · ${p.dominio}` : ""}
                            </span>
                          </span>
                          <span className="text-sm text-tinta-60">
                            {formatearCOP(p.tarifa)}
                            <span className="text-xs text-tinta-40">
                              {" "}
                              {LABEL_CICLO.get(p.ciclo)}
                            </span>
                          </span>
                          <span
                            className={
                              estado === "vencido"
                                ? "text-sm font-medium text-peligro"
                                : "text-sm text-tinta-60"
                            }
                          >
                            {descripcionVencimiento(p.proxima_fecha, hoy)}
                          </span>
                        </ListRow>
                      );
                    })}
                  </div>
                </div>
              )
            ) : clientes.length === 0 ? (
              <EmptyState
                titulo="Sin clientes todavía."
                detalle="Los puedes crear aquí o convertir un negocio del CRM desde su ficha en el mapa."
              />
            ) : (
              <div className="barra-fina overflow-x-auto">
                <div className="flex min-w-[520px] flex-col gap-1">
                  <div className={`${GRID_CLIENTE} px-3 py-1.5 text-xs font-medium text-tinta-40`}>
                    <span>Cliente</span>
                    <span>Teléfono</span>
                    <span>Productos</span>
                    <span>Estado</span>
                  </div>
                  {clientes.map((c) => {
                    const suyos = productos.filter((p) => p.cliente_id === c.id);
                    return (
                      <ListRow
                        key={c.id}
                        activa={c.id === seleccionId}
                        className={GRID_CLIENTE}
                        onClick={() => {
                          setCreando(false);
                          setSeleccionId(c.id);
                        }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-tinta">
                            {c.nombre}
                          </span>
                          {c.email ? (
                            <span className="block truncate text-xs text-tinta-40">
                              {c.email}
                            </span>
                          ) : null}
                        </span>
                        <span className="text-sm text-tinta-60">
                          {c.telefono ?? <span className="text-tinta-40">—</span>}
                        </span>
                        <strong className="text-sm text-tinta">{suyos.length}</strong>
                        <span className="text-sm text-tinta-60">
                          {c.activo ? "Activo" : "Inactivo"}
                        </span>
                      </ListRow>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <aside
            className="min-w-0 border-t border-hairline pt-aire min-[1000px]:border-t-0 min-[1000px]:border-l min-[1000px]:border-hairline min-[1000px]:pt-0 min-[1000px]:pl-aire"
            aria-label="Detalle del cliente"
          >
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
              <EmptyState
                titulo="Toca un cobro o un cliente para ver su ficha."
                detalle="Cada producto que le vendas — bot, página web, CRM — lleva su tarifa y su próxima fecha de cobro."
              />
            )}
          </aside>
        </div>
      </CockpitBody>
    </Cockpit>
  );
}
