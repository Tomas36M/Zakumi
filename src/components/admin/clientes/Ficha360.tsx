"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { registrarPago } from "@/lib/admin/cartera-actions";
import {
  CICLOS,
  TIPOS_PRODUCTO,
  descripcionVencimiento,
  formatearCOP,
  semaforoCobro,
  type Cliente,
  type Pago,
  type ProductoContratado,
  type Semaforo,
  type TipoProducto,
} from "@/lib/admin/cartera";
import { mrrDeProductos, oportunidades } from "@/lib/admin/upsell";
import type { StatusInstancia } from "@/lib/bots/tipos";
import { Badge } from "@/components/admin/ui/Badge";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input } from "@/components/admin/ui/Field";
import { Island } from "@/components/admin/ui/Island";
import { ListRow } from "@/components/admin/ui/ListRow";
import { ProductoForm } from "./ProductoForm";
import { VincularBot } from "./VincularBot";

const LABEL_TIPO = new Map(TIPOS_PRODUCTO.map((t) => [t.valor, t.label]));
const LABEL_CICLO = new Map(CICLOS.map((c) => [c.valor, c.label]));

const COLOR_SEMAFORO: Record<Semaforo, string> = {
  al_dia: "bg-vivo",
  por_vencer: "bg-estado-contactado",
  vencido: "bg-peligro",
  sin_programar: "bg-tinta-40/40",
};

type Props = {
  cliente: Cliente;
  productos: ProductoContratado[];
  pagos: Pago[];
  botStatus: Record<string, StatusInstancia | null>;
  hoy: string;
};

/**
 * Ficha 360°: qué tiene la empresa, cuánto ha pagado, cómo está su bot en
 * vivo y qué se le puede vender todavía (motor de upsell).
 */
export function Ficha360({ cliente, productos, pagos, botStatus, hoy }: Props) {
  const router = useRouter();
  const [guardando, startGuardar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pagando, setPagando] = useState<string | null>(null);
  const [agregando, setAgregando] = useState<null | {
    tipo?: TipoProducto;
    nombre?: string;
    tarifa?: number;
    ciclo?: ProductoContratado["ciclo"];
  }>(null);

  const totalPagado = pagos.reduce((t, p) => t + p.monto, 0);
  const mrr = mrrDeProductos(productos);
  const ops = oportunidades(productos);

  function refrescar() {
    setAgregando(null);
    setPagando(null);
    router.refresh();
  }

  const cifras = [
    { valor: formatearCOP(totalPagado), label: "pagado en total" },
    { valor: formatearCOP(Math.round(mrr)), label: "mensualidad actual (MRR)" },
    {
      valor: String(productos.filter((p) => p.activo).length),
      label: "servicios activos",
    },
  ];

  return (
    <section>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <div>
          <h1 className="text-lg font-semibold text-tinta">
            <Link href="/admin/clientes" className="text-tinta-60 hover:text-tinta">
              Clientes
            </Link>{" "}
            / {cliente.nombre}
          </h1>
          <p className="text-xs text-tinta-60">
            {[cliente.telefono, cliente.email].filter(Boolean).join(" · ") ||
              "Sin datos de contacto"}
            {!cliente.activo && " · INACTIVO"}
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-aire px-5 py-4">
        <div className="grid grid-cols-1 gap-aire sm:grid-cols-3">
          {cifras.map((c) => (
            <div key={c.label} className="rounded-fila bg-isla-alta px-4 py-3">
              <span className="block text-2xl font-semibold text-tinta">{c.valor}</span>
              <span className="text-xs text-tinta-60">{c.label}</span>
            </div>
          ))}
        </div>

        {error && <Banner variante="error">{error}</Banner>}

        <div className="grid items-start gap-aire min-[1000px]:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-aire">
            <Island
              className="bg-isla-alta/50"
              titulo="Lo que tiene"
              aria-label="Servicios contratados"
            >
              {productos.length === 0 && (
                <p className="mb-3 text-sm text-tinta-40">Nada contratado todavía.</p>
              )}
              <ul className="mb-3 flex flex-col gap-1">
                {productos.map((p) => {
                  const estado = semaforoCobro(p.proxima_fecha, hoy);
                  const status = p.instancia_id ? botStatus[p.instancia_id] : undefined;
                  return (
                    <li key={p.id}>
                      <ListRow interactiva={false} className="flex flex-col gap-2">
                        <div className="flex items-start gap-2.5">
                          <span
                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${COLOR_SEMAFORO[estado]}`}
                            title={estado.replaceAll("_", " ")}
                          />
                          <div className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-tinta">
                              {p.nombre}
                              {!p.activo ? " · inactivo" : ""}
                            </span>
                            <span className="block text-xs text-tinta-40">
                              {LABEL_TIPO.get(p.tipo)} · {formatearCOP(p.tarifa)}{" "}
                              {LABEL_CICLO.get(p.ciclo)?.toLowerCase()} ·{" "}
                              {descripcionVencimiento(p.proxima_fecha, hoy)}
                              {p.dominio ? ` · ${p.dominio}` : ""}
                            </span>
                            {p.instancia_id && status !== undefined && (
                              <span className="block text-xs text-tinta-40">
                                {status ? (
                                  <>
                                    Bot en vivo:{" "}
                                    {status.instancia.activo ? "activo" : "APAGADO"} ·
                                    prompt v{status.instancia.prompt_version} ·{" "}
                                    {status.uso_hoy.llamadas} llamadas hoy ·{" "}
                                    <Link
                                      href={`/admin/bots/${p.instancia_id}`}
                                      className="font-medium text-acento hover:underline"
                                    >
                                      abrir en consola →
                                    </Link>
                                  </>
                                ) : (
                                  "Bot: sin conexión con Railway"
                                )}
                              </span>
                            )}
                            {p.activo && p.tipo === "bot" && !p.instancia_id && (
                              <VincularBot productoId={p.id} onVinculado={refrescar} />
                            )}
                          </div>
                          {p.activo && (
                            <Button
                              onClick={() => setPagando(pagando === p.id ? null : p.id)}
                            >
                              {pagando === p.id ? "Cancelar" : "Registrar pago"}
                            </Button>
                          )}
                        </div>

                        {pagando === p.id && (
                          <form
                            className="flex flex-col gap-3"
                            onSubmit={(e) => {
                              e.preventDefault();
                              const form = e.currentTarget;
                              const monto = Number(
                                (form.elements.namedItem("monto") as HTMLInputElement)
                                  .value,
                              );
                              const fecha = (
                                form.elements.namedItem("fecha") as HTMLInputElement
                              ).value;
                              const nota = (
                                form.elements.namedItem("nota") as HTMLInputElement
                              ).value;
                              setError(null);
                              startGuardar(async () => {
                                const res = await registrarPago(p.id, {
                                  monto,
                                  fecha,
                                  nota,
                                });
                                if (res.error) {
                                  setError(res.error);
                                  return;
                                }
                                refrescar();
                              });
                            }}
                          >
                            <Field label="Monto">
                              <Input
                                name="monto"
                                type="number"
                                min={1}
                                step="any"
                                defaultValue={p.tarifa}
                                required
                              />
                            </Field>
                            <Field label="Fecha">
                              <Input name="fecha" type="date" defaultValue={hoy} required />
                            </Field>
                            <Field label="Nota">
                              <Input
                                name="nota"
                                placeholder="transferencia, efectivo…"
                                maxLength={2000}
                              />
                            </Field>
                            <Button
                              variante="primaria"
                              type="submit"
                              className="self-start"
                              disabled={guardando}
                            >
                              {guardando ? "Guardando…" : "Guardar pago"}
                            </Button>
                          </form>
                        )}
                      </ListRow>
                    </li>
                  );
                })}
              </ul>

              {agregando !== null ? (
                <ProductoForm
                  clienteId={cliente.id}
                  hoy={hoy}
                  inicial={agregando}
                  onCreado={refrescar}
                  onCancelar={() => setAgregando(null)}
                />
              ) : (
                <Button onClick={() => setAgregando({})}>Agregar producto</Button>
              )}
            </Island>

            <Island className="bg-isla-alta/50" titulo="Pagos" aria-label="Pagos">
              {pagos.length === 0 ? (
                <p className="text-sm text-tinta-40">Sin pagos registrados todavía.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {pagos.map((pg) => {
                    const producto = productos.find((p) => p.id === pg.producto_id);
                    return (
                      <li key={pg.id}>
                        <ListRow interactiva={false} className="flex flex-col gap-0.5">
                          <span className="text-xs text-tinta-40">
                            {pg.fecha} · {producto?.nombre ?? "producto"}
                          </span>
                          <span className="text-sm text-tinta">
                            {formatearCOP(pg.monto)}
                            {pg.nota ? ` — ${pg.nota}` : ""}
                          </span>
                        </ListRow>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Island>
          </div>

          <aside aria-label="Oportunidades de venta">
            <Island className="bg-isla-alta/50" titulo="Qué venderle">
              {ops.length === 0 && (
                <p className="text-sm text-tinta-40">Ya tiene todo el catálogo. 🏆</p>
              )}
              <div className="flex flex-col gap-3">
                {ops.map(({ servicio, razon }) => (
                  <article
                    key={servicio.slug}
                    className="flex flex-col gap-1 rounded-fila border border-hairline p-3"
                  >
                    <header className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-medium text-tinta">{servicio.nombre}</h3>
                      {!servicio.disponible && <Badge tono="neutro">Próximamente</Badge>}
                    </header>
                    <p className="text-sm font-medium text-acento">
                      {formatearCOP(servicio.tarifaSugerida)}{" "}
                      {LABEL_CICLO.get(servicio.cicloSugerido)?.toLowerCase()}
                    </p>
                    <p className="text-sm text-tinta-60">{razon}</p>
                    {servicio.disponible && (
                      <Button
                        className="mt-1 self-start"
                        onClick={() =>
                          setAgregando({
                            tipo: servicio.tipo,
                            nombre: servicio.nombre,
                            tarifa: servicio.tarifaSugerida,
                            ciclo: servicio.cicloSugerido,
                          })
                        }
                      >
                        Agregar
                      </Button>
                    )}
                  </article>
                ))}
              </div>
            </Island>
          </aside>
        </div>
      </div>
    </section>
  );
}
