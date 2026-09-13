"use client";

import { useState, useTransition } from "react";
import { actualizarProducto, registrarPago } from "@/lib/admin/cartera-actions";
import {
  CICLOS,
  TIPOS_PRODUCTO,
  descripcionVencimiento,
  formatearCOP,
  semaforoCobro,
  type ProductoContratado,
} from "@/lib/admin/cartera";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import { Field, Input } from "@/components/admin/ui/Field";
import { Island } from "@/components/admin/ui/Island";
import { ListRow } from "@/components/admin/ui/ListRow";
import { ProductoForm } from "./ProductoForm";
import { COLOR_SEMAFORO } from "./semaforo";

const LABEL_TIPO = new Map(TIPOS_PRODUCTO.map((t) => [t.valor, t.label]));
const LABEL_CICLO = new Map(CICLOS.map((c) => [c.valor, c.label]));

type Props = {
  clienteId: string;
  productos: ProductoContratado[];
  hoy: string;
  /** Algo cambió en la base: el dueño refresca. */
  onCambio: () => void;
  /** Se registró un pago: la lista de pagos se vuelve a leer. */
  onPago: () => void;
};

/** Los productos del cliente: registrar pago, dar de baja o reactivar, y
 * agregar uno nuevo. */
export function ProductosCliente({ clienteId, productos, hoy, onCambio, onPago }: Props) {
  const [guardando, startGuardar] = useTransition();
  const { confirmar, dialogo } = useConfirmar();
  const [error, setError] = useState<string | null>(null);
  const [pagando, setPagando] = useState<string | null>(null); // producto_id del mini-form abierto
  const [agregando, setAgregando] = useState(false);

  function cambiarActivo(p: ProductoContratado, activo: boolean) {
    setError(null);
    startGuardar(async () => {
      const res = await actualizarProducto(p.id, { activo });
      if (res.error) {
        setError(res.error);
        return;
      }
      onCambio();
    });
  }

  async function darDeBaja(p: ProductoContratado) {
    const ok = await confirmar({
      titulo: `¿Dar de baja ${p.nombre}?`,
      mensaje:
        "Deja de contar en los cobros y en el ingreso mensual. El historial de pagos se conserva y se puede reactivar después.",
      accion: "Dar de baja",
      peligro: true,
    });
    if (ok) cambiarActivo(p, false);
  }

  return (
    <Island className="bg-isla-alta/50" titulo="Productos" aria-label="Productos contratados">
      {dialogo}
      {error && <Banner variante="error" className="mb-3">{error}</Banner>}

      {productos.length === 0 ? (
        <p className="mb-3 text-sm text-tinta-40">Nada contratado todavía. Agrégale su primer producto.</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-1">
          {productos.map((p) => {
            const estado = semaforoCobro(p.proxima_fecha, hoy);
            return (
              <li key={p.id}>
                <ListRow interactiva={false} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${p.activo ? COLOR_SEMAFORO[estado] : "bg-tinta-40/40"}`}
                      title={p.activo ? estado.replaceAll("_", " ") : "inactivo"}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-tinta">
                        {p.nombre}
                        {!p.activo ? " · inactivo" : ""}
                      </span>
                      <span className="block text-xs text-tinta-40">
                        {LABEL_TIPO.get(p.tipo)} · {formatearCOP(p.tarifa)}{" "}
                        {LABEL_CICLO.get(p.ciclo)?.toLowerCase()} ·{" "}
                        {descripcionVencimiento(p.proxima_fecha, hoy)}
                        {p.dominio ? ` · ${p.dominio}` : ""}
                      </span>
                    </div>
                    {p.activo ? (
                      <>
                        <Button onClick={() => setPagando(pagando === p.id ? null : p.id)}>
                          {pagando === p.id ? "Cancelar" : "Registrar pago"}
                        </Button>
                        <Button variante="peligro" disabled={guardando} onClick={() => void darDeBaja(p)}>
                          Dar de baja
                        </Button>
                      </>
                    ) : (
                      <Button disabled={guardando} onClick={() => cambiarActivo(p, true)}>
                        Reactivar
                      </Button>
                    )}
                  </div>

                  {pagando === p.id && (
                    <form
                      className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const monto = Number((form.elements.namedItem("monto") as HTMLInputElement).value);
                        const fecha = (form.elements.namedItem("fecha") as HTMLInputElement).value;
                        const nota = (form.elements.namedItem("nota") as HTMLInputElement).value;
                        setError(null);
                        startGuardar(async () => {
                          const res = await registrarPago(p.id, { monto, fecha, nota });
                          if (res.error) {
                            setError(res.error);
                            return;
                          }
                          setPagando(null);
                          onPago();
                          onCambio();
                        });
                      }}
                    >
                      <Field label="Monto">
                        <Input name="monto" type="number" min={1} step="any" defaultValue={p.tarifa} required />
                      </Field>
                      <Field label="Fecha">
                        <Input name="fecha" type="date" defaultValue={hoy} required />
                      </Field>
                      <Field label="Nota">
                        <Input name="nota" placeholder="transferencia, efectivo…" maxLength={2000} />
                      </Field>
                      <Button variante="primaria" type="submit" className="self-start" disabled={guardando}>
                        {guardando ? "Guardando…" : "Guardar pago"}
                      </Button>
                    </form>
                  )}
                </ListRow>
              </li>
            );
          })}
        </ul>
      )}

      {agregando ? (
        <ProductoForm
          clienteId={clienteId}
          hoy={hoy}
          onCreado={() => {
            setAgregando(false);
            onCambio();
          }}
          onCancelar={() => setAgregando(false)}
        />
      ) : (
        <Button onClick={() => setAgregando(true)}>Agregar producto</Button>
      )}
    </Island>
  );
}
