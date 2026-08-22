import type { Metadata } from "next";
import Link from "next/link";
import { verifySesionPortal } from "@/lib/portal/dal";
import {
  TIPOS_PRODUCTO,
  formatearCOP,
  type Pago,
  type ProductoContratado,
} from "@/lib/admin/cartera";
import { mrrDeProductos } from "@/lib/admin/upsell";

export const metadata: Metadata = { title: "Pagos" };

const CICLO_LABEL: Record<string, string> = {
  mensual: "al mes",
  anual: "al año",
  unico: "pago único",
};

function labelTipo(tipo: string): string {
  return TIPOS_PRODUCTO.find((t) => t.valor === tipo)?.label ?? tipo;
}

export default async function PagosPage() {
  const sesion = await verifySesionPortal();

  if (!sesion.clienteId) {
    return (
      <div className="app-pagina">
        <p className="app-eyebrow">Pagos</p>
        <h1 className="app-titulo">Servicios y pagos</h1>
        <div className="app-vacio app-card">
          <p>
            Cuando actives tu primer servicio con Zakumi, aquí verás lo que
            tienes contratado y el historial de tus pagos.
          </p>
          <Link href="/app/tienda" className="app-btn">
            Ir a la tienda
          </Link>
        </div>
      </div>
    );
  }

  const productos = await sesion.supabase
    .from("productos_contratados")
    .select("*")
    .eq("cliente_id", sesion.clienteId)
    .order("created_at", { ascending: true })
    .then((r) => (r.data ?? []) as ProductoContratado[]);

  const pagos =
    productos.length > 0
      ? await sesion.supabase
          .from("pagos")
          .select("*")
          .in(
            "producto_id",
            productos.map((p) => p.id),
          )
          .order("fecha", { ascending: false })
          .then((r) => (r.data ?? []) as Pago[])
      : [];

  const nombreDeProducto = new Map(productos.map((p) => [p.id, p.nombre]));
  const activos = productos.filter((p) => p.activo);
  const mensualidad = mrrDeProductos(productos);

  return (
    <div className="app-pagina">
      <p className="app-eyebrow">Pagos</p>
      <h1 className="app-titulo">Servicios y pagos</h1>
      <p className="app-lead">
        Lo que tienes contratado con Zakumi y los pagos que hemos recibido.
      </p>

      <div className="app-grid" style={{ marginBottom: "1.3rem" }}>
        <div className="app-card">
          <p className="app-card-titulo">Servicios activos</p>
          <p className="app-cifra">{activos.length}</p>
        </div>
        <div className="app-card">
          <p className="app-card-titulo">Tu mensualidad</p>
          <p className="app-cifra">{formatearCOP(mensualidad)}</p>
          <p className="app-card-nota">Suma de tus servicios recurrentes.</p>
        </div>
      </div>

      <h2 className="app-seccion-titulo">Tus servicios</h2>
      {productos.length === 0 ? (
        <div className="app-vacio app-card">
          <p>Todavía no tienes servicios contratados.</p>
          <Link href="/app/tienda" className="app-btn-ghost">
            Ir a la tienda
          </Link>
        </div>
      ) : (
        <div className="app-tabla-scroll">
          <table className="app-tabla">
            <thead>
              <tr>
                <th>Servicio</th>
                <th>Tipo</th>
                <th>Tarifa</th>
                <th>Próximo cobro</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.id}>
                  <td>{p.nombre}</td>
                  <td>{labelTipo(p.tipo)}</td>
                  <td className="app-tabla-num">
                    {formatearCOP(Number(p.tarifa))}{" "}
                    <span className="app-card-nota">
                      {CICLO_LABEL[p.ciclo] ?? p.ciclo}
                    </span>
                  </td>
                  <td className="app-tabla-num">{p.proxima_fecha ?? "—"}</td>
                  <td>
                    {p.activo ? (
                      <span className="app-chip app-chip--ok">Activo</span>
                    ) : (
                      <span className="app-chip app-chip--neutro">Inactivo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="app-seccion-titulo">Historial de pagos</h2>
      {pagos.length === 0 ? (
        <div className="app-vacio app-card">
          <p>Aún no registramos pagos tuyos.</p>
        </div>
      ) : (
        <div className="app-tabla-scroll">
          <table className="app-tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Servicio</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((p) => (
                <tr key={p.id}>
                  <td className="app-tabla-num">{p.fecha}</td>
                  <td>{nombreDeProducto.get(p.producto_id) ?? "—"}</td>
                  <td className="app-tabla-num">{formatearCOP(Number(p.monto))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
