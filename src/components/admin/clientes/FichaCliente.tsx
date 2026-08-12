"use client";

import { useEffect, useState, useTransition } from "react";
import { registrarPago } from "@/lib/admin/cartera-actions";
import {
  CICLOS,
  TIPOS_PRODUCTO,
  descripcionVencimiento,
  formatearCOP,
  semaforoCobro,
  type Cliente,
  type Pago,
  type ProductoConCliente,
} from "@/lib/admin/cartera";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { ProductoForm } from "./ProductoForm";

const LABEL_TIPO = new Map(TIPOS_PRODUCTO.map((t) => [t.valor, t.label]));
const LABEL_CICLO = new Map(CICLOS.map((c) => [c.valor, c.label]));

async function fetchPagos(productoIds: string[]): Promise<Pago[]> {
  if (productoIds.length === 0) return [];
  const supabase = createSupabaseBrowser();
  const { data } = await supabase
    .from("pagos")
    .select("*")
    .in("producto_id", productoIds)
    .order("fecha", { ascending: false })
    .limit(20);
  return (data as Pago[]) ?? [];
}

type Props = {
  cliente: Cliente;
  productos: ProductoConCliente[];
  hoy: string;
  onCambio: () => void;
  onCerrar: () => void;
};

export function FichaCliente({ cliente, productos, hoy, onCambio, onCerrar }: Props) {
  const [guardando, startGuardar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pagos, setPagos] = useState<Pago[] | null>(null);
  const [pagando, setPagando] = useState<string | null>(null); // producto_id del mini-form abierto
  const [agregando, setAgregando] = useState(false);

  const ids = productos.map((p) => p.id).join(",");

  useEffect(() => {
    let activo = true;
    fetchPagos(ids ? ids.split(",") : []).then((ps) => {
      if (activo) setPagos(ps);
    });
    return () => {
      activo = false;
    };
  }, [ids]);

  async function recargarPagos() {
    setPagos(await fetchPagos(productos.map((p) => p.id)));
  }

  return (
    <div className="adm-ficha-contenido">
      <div className="adm-ficha-cabecera">
        <div>
          <h2 className="adm-ficha-nombre">{cliente.nombre}</h2>
          <p className="adm-ficha-meta">
            {[cliente.telefono, cliente.email].filter(Boolean).join(" · ") ||
              "Sin datos de contacto"}
          </p>
        </div>
        <button
          type="button"
          className="adm-ficha-cerrar"
          aria-label="Cerrar ficha"
          onClick={onCerrar}
        >
          ×
        </button>
      </div>

      {error ? (
        <p className="adm-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="adm-productos" aria-label="Productos contratados">
        <h3 className="adm-notas-titulo">Productos</h3>
        {productos.length === 0 ? (
          <p className="adm-notas-vacias">
            Nada contratado todavía. Agrégale su primer producto.
          </p>
        ) : (
          <ul className="adm-productos-lista">
            {productos.map((p) => {
              const estado = semaforoCobro(p.proxima_fecha, hoy);
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
                    </div>
                    {p.activo ? (
                      <button
                        type="button"
                        className="adm-ficha-editar"
                        onClick={() => setPagando(pagando === p.id ? null : p.id)}
                      >
                        {pagando === p.id ? "Cancelar" : "Registrar pago"}
                      </button>
                    ) : null}
                  </div>

                  {pagando === p.id ? (
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
                          setPagando(null);
                          onCambio();
                          void recargarPagos();
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
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {agregando ? (
          <ProductoForm
            clienteId={cliente.id}
            hoy={hoy}
            onCreado={() => {
              setAgregando(false);
              onCambio();
            }}
            onCancelar={() => setAgregando(false)}
          />
        ) : (
          <button
            type="button"
            className="adm-cta-ghost"
            onClick={() => setAgregando(true)}
          >
            Agregar producto
          </button>
        )}
      </section>

      <section className="adm-notas" aria-label="Pagos recientes">
        <h3 className="adm-notas-titulo">Pagos recientes</h3>
        {pagos === null ? (
          <p className="adm-notas-cargando">Cargando pagos…</p>
        ) : pagos.length === 0 ? (
          <p className="adm-notas-vacias">Sin pagos registrados todavía.</p>
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
  );
}
