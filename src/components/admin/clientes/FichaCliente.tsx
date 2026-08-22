"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
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
  type Semaforo,
} from "@/lib/admin/cartera";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input } from "@/components/admin/ui/Field";
import { IconButton } from "@/components/admin/ui/IconButton";
import { Island } from "@/components/admin/ui/Island";
import { ListRow } from "@/components/admin/ui/ListRow";
import { Skeleton } from "@/components/admin/ui/Skeleton";
import { ProductoForm } from "./ProductoForm";

const LABEL_TIPO = new Map(TIPOS_PRODUCTO.map((t) => [t.valor, t.label]));
const LABEL_CICLO = new Map(CICLOS.map((c) => [c.valor, c.label]));

const COLOR_SEMAFORO: Record<Semaforo, string> = {
  al_dia: "bg-vivo",
  por_vencer: "bg-estado-contactado",
  vencido: "bg-peligro",
  sin_programar: "bg-tinta-40/40",
};

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
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-tinta">{cliente.nombre}</h2>
          <p className="text-xs text-tinta-40">
            {[cliente.telefono, cliente.email].filter(Boolean).join(" · ") ||
              "Sin datos de contacto"}
          </p>
          <Link
            href={`/admin/clientes/${cliente.id}`}
            className="text-sm font-medium text-acento hover:underline"
          >
            Ver ficha completa →
          </Link>
        </div>
        <IconButton etiqueta="Cerrar ficha" onClick={onCerrar}>
          <X className="h-4 w-4" />
        </IconButton>
      </div>

      {error ? <Banner variante="error">{error}</Banner> : null}

      <Island
        className="bg-isla-alta/50"
        titulo="Productos"
        aria-label="Productos contratados"
      >
        {productos.length === 0 ? (
          <p className="mb-3 text-sm text-tinta-40">
            Nada contratado todavía. Agrégale su primer producto.
          </p>
        ) : (
          <ul className="mb-3 flex flex-col gap-1">
            {productos.map((p) => {
              const estado = semaforoCobro(p.proxima_fecha, hoy);
              return (
                <li key={p.id}>
                  <ListRow interactiva={false} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${COLOR_SEMAFORO[estado]}`}
                        title={estado.replaceAll("_", " ")}
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
                        <Button
                          onClick={() => setPagando(pagando === p.id ? null : p.id)}
                        >
                          {pagando === p.id ? "Cancelar" : "Registrar pago"}
                        </Button>
                      ) : null}
                    </div>

                    {pagando === p.id ? (
                      <form
                        className="flex flex-col gap-3"
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
                    ) : null}
                  </ListRow>
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
          <Button onClick={() => setAgregando(true)}>Agregar producto</Button>
        )}
      </Island>

      <Island className="bg-isla-alta/50" titulo="Pagos recientes" aria-label="Pagos recientes">
        {pagos === null ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ) : pagos.length === 0 ? (
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
  );
}
