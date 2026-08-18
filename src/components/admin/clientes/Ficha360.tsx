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
  type TipoProducto,
} from "@/lib/admin/cartera";
import { mrrDeProductos, oportunidades } from "@/lib/admin/upsell";
import type { StatusInstancia } from "@/lib/bots/tipos";
import { ProductoForm } from "./ProductoForm";
import { VincularBot } from "./VincularBot";

const LABEL_TIPO = new Map(TIPOS_PRODUCTO.map((t) => [t.valor, t.label]));
const LABEL_CICLO = new Map(CICLOS.map((c) => [c.valor, c.label]));

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

  return (
    <section className="adm-seccion">
      <div className="adm-toolbar">
        <div>
          <h1 className="adm-titulo">
            <Link href="/admin/clientes" className="adm-bot-volver">
              Clientes
            </Link>{" "}
            / {cliente.nombre}
          </h1>
          <p className="adm-bot-meta">
            {[cliente.telefono, cliente.email].filter(Boolean).join(" · ") ||
              "Sin datos de contacto"}
            {!cliente.activo && " · INACTIVO"}
          </p>
        </div>
      </div>

      <div className="adm-actividad-cifras">
        <div className="adm-cifra-bloque">
          <span className="adm-cifra">{formatearCOP(totalPagado)}</span>
          <span className="adm-cifra-label">pagado en total</span>
        </div>
        <div className="adm-cifra-bloque">
          <span className="adm-cifra">{formatearCOP(Math.round(mrr))}</span>
          <span className="adm-cifra-label">mensualidad actual (MRR)</span>
        </div>
        <div className="adm-cifra-bloque">
          <span className="adm-cifra">{productos.filter((p) => p.activo).length}</span>
          <span className="adm-cifra-label">servicios activos</span>
        </div>
      </div>

      {error && (
        <p className="adm-error" role="alert">
          {error}
        </p>
      )}

      <div className="adm-360-layout">
        <div className="adm-360-principal">
          <section aria-label="Servicios contratados">
            <h2 className="adm-field-label">Lo que tiene</h2>
            {productos.length === 0 && (
              <p className="adm-ficha-sin">Nada contratado todavía.</p>
            )}
            <ul className="adm-productos-lista">
              {productos.map((p) => {
                const estado = semaforoCobro(p.proxima_fecha, hoy);
                const status = p.instancia_id ? botStatus[p.instancia_id] : undefined;
                return (
                  <li key={p.id} className="adm-producto">
                    <div className="adm-producto-fila">
                      <span className={`adm-badge adm-badge--sem-${estado}`} />
                      <div className="adm-producto-info">
                        <span className="adm-tabla-nombre">
                          {p.nombre}
                          {!p.activo ? " · inactivo" : ""}
                        </span>
                        <span className="adm-tabla-categoria">
                          {LABEL_TIPO.get(p.tipo)} · {formatearCOP(p.tarifa)}{" "}
                          {LABEL_CICLO.get(p.ciclo)?.toLowerCase()} ·{" "}
                          {descripcionVencimiento(p.proxima_fecha, hoy)}
                          {p.dominio ? ` · ${p.dominio}` : ""}
                        </span>
                        {p.instancia_id && status !== undefined && (
                          <span className="adm-tabla-categoria">
                            {status ? (
                              <>
                                Bot en vivo: {status.instancia.activo ? "activo" : "APAGADO"} ·
                                prompt v{status.instancia.prompt_version} ·{" "}
                                {status.uso_hoy.llamadas} llamadas hoy ·{" "}
                                <Link
                                  href={`/admin/bots/${p.instancia_id}`}
                                  className="adm-360-link"
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
                        <button
                          type="button"
                          className="adm-ficha-editar"
                          onClick={() => setPagando(pagando === p.id ? null : p.id)}
                        >
                          {pagando === p.id ? "Cancelar" : "Registrar pago"}
                        </button>
                      )}
                    </div>

                    {pagando === p.id && (
                      <form
                        className="adm-pago-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = e.currentTarget;
                          const monto = Number(
                            (form.elements.namedItem("monto") as HTMLInputElement).value,
                          );
                          const fecha = (
                            form.elements.namedItem("fecha") as HTMLInputElement
                          ).value;
                          const nota = (
                            form.elements.namedItem("nota") as HTMLInputElement
                          ).value;
                          setError(null);
                          startGuardar(async () => {
                            const res = await registrarPago(p.id, { monto, fecha, nota });
                            if (res.error) {
                              setError(res.error);
                              return;
                            }
                            refrescar();
                          });
                        }}
                      >
                        <label className="adm-field">
                          <span className="adm-field-label">Monto</span>
                          <input
                            className="adm-input"
                            name="monto"
                            type="number"
                            min={1}
                            step="any"
                            defaultValue={p.tarifa}
                            required
                          />
                        </label>
                        <label className="adm-field">
                          <span className="adm-field-label">Fecha</span>
                          <input
                            className="adm-input"
                            name="fecha"
                            type="date"
                            defaultValue={hoy}
                            required
                          />
                        </label>
                        <label className="adm-field">
                          <span className="adm-field-label">Nota</span>
                          <input
                            className="adm-input"
                            name="nota"
                            placeholder="transferencia, efectivo…"
                            maxLength={2000}
                          />
                        </label>
                        <button className="adm-cta" type="submit" disabled={guardando}>
                          {guardando ? "Guardando…" : "Guardar pago"}
                        </button>
                      </form>
                    )}
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
              <button
                type="button"
                className="adm-cta-ghost"
                onClick={() => setAgregando({})}
              >
                Agregar producto
              </button>
            )}
          </section>

          <section className="adm-notas" aria-label="Pagos">
            <h2 className="adm-field-label">Pagos</h2>
            {pagos.length === 0 ? (
              <p className="adm-ficha-sin">Sin pagos registrados todavía.</p>
            ) : (
              <ul className="adm-notas-lista">
                {pagos.map((pg) => {
                  const producto = productos.find((p) => p.id === pg.producto_id);
                  return (
                    <li key={pg.id} className="adm-nota">
                      <span className="adm-nota-fecha">
                        {pg.fecha} · {producto?.nombre ?? "producto"}
                      </span>
                      <span className="adm-nota-texto">
                        {formatearCOP(pg.monto)}
                        {pg.nota ? ` — ${pg.nota}` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="adm-360-oportunidades" aria-label="Oportunidades de venta">
          <h2 className="adm-field-label">Qué venderle</h2>
          {ops.length === 0 && (
            <p className="adm-ficha-sin">Ya tiene todo el catálogo. 🏆</p>
          )}
          {ops.map(({ servicio, razon }) => (
            <article key={servicio.slug} className="adm-360-oportunidad">
              <header className="adm-conv-cabecera">
                <h3 className="adm-360-oportunidad-nombre">{servicio.nombre}</h3>
                {!servicio.disponible && (
                  <span className="adm-conv-prueba">Próximamente</span>
                )}
              </header>
              <p className="adm-360-oportunidad-tarifa">
                {formatearCOP(servicio.tarifaSugerida)}{" "}
                {LABEL_CICLO.get(servicio.cicloSugerido)?.toLowerCase()}
              </p>
              <p className="adm-editor-notas">{razon}</p>
              {servicio.disponible && (
                <button
                  type="button"
                  className="adm-cta-ghost"
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
                </button>
              )}
            </article>
          ))}
        </aside>
      </div>
    </section>
  );
}
