"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Lead } from "@/lib/bots/tipos";
import { formatearCOP } from "@/lib/admin/cartera";
import { eliminarVenta, registrarVenta } from "@/lib/portal/actions";

export type Venta = {
  id: string;
  contacto: string;
  telefono: string | null;
  detalle: string | null;
  monto: number | null;
  moneda: string;
  fecha: string;
  origen: "manual" | "bot";
};

type Props = {
  ventas: Venta[];
  /** null = sin bot o sin conexión. */
  leads: Lead[] | null;
  tieneBot: boolean;
};

export function VentasView({ ventas, leads, tieneBot }: Props) {
  const total = ventas.reduce((s, v) => s + Number(v.monto ?? 0), 0);

  return (
    <div>
      <div className="app-grid" style={{ marginBottom: "1.3rem" }}>
        <div className="app-card">
          <p className="app-card-titulo">Ventas registradas</p>
          <p className="app-cifra">{ventas.length}</p>
        </div>
        <div className="app-card">
          <p className="app-card-titulo">Total registrado</p>
          <p className="app-cifra">{formatearCOP(total)}</p>
        </div>
      </div>

      <FormNuevaVenta />

      <h2 className="app-seccion-titulo">Tus ventas</h2>
      {ventas.length === 0 ? (
        <div className="app-vacio app-card">
          <p>Registra tu primera venta arriba — toma diez segundos.</p>
        </div>
      ) : (
        <TablaVentas ventas={ventas} />
      )}

      <h2 className="app-seccion-titulo">Contactos que captó tu agente</h2>
      {!tieneBot ? (
        <div className="app-vacio app-card">
          <p>Cuando tengas un agente de WhatsApp, sus contactos aparecerán aquí.</p>
          <Link href="/app/tienda" className="app-btn-ghost">
            Conocer el bot de WhatsApp
          </Link>
        </div>
      ) : leads === null ? (
        <p className="app-aviso">
          No pudimos cargar los contactos ahora mismo. Vuelve a intentar en un
          momento.
        </p>
      ) : leads.length === 0 ? (
        <div className="app-vacio app-card">
          <p>Tu agente todavía no ha captado contactos.</p>
        </div>
      ) : (
        <div className="app-tabla-scroll">
          <table className="app-tabla">
            <thead>
              <tr>
                <th>Teléfono</th>
                <th>Datos que dejó</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead, i) => (
                <tr key={`${lead.phone}-${i}`}>
                  <td className="app-tabla-num">{lead.phone}</td>
                  <td>
                    {Object.entries(lead.datos).length === 0
                      ? "—"
                      : Object.entries(lead.datos)
                          .map(([k, v]) => `${k}: ${String(v)}`)
                          .join(" · ")}
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

function FormNuevaVenta() {
  const [contacto, setContacto] = useState("");
  const [telefono, setTelefono] = useState("");
  const [monto, setMonto] = useState("");
  const [detalle, setDetalle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, startTransition] = useTransition();

  function guardar() {
    setError(null);
    const montoNumero = monto.trim() === "" ? undefined : Number(monto);
    if (montoNumero !== undefined && !Number.isFinite(montoNumero)) {
      setError("El monto no es un número.");
      return;
    }
    startTransition(async () => {
      const r = await registrarVenta({
        contacto,
        telefono: telefono || undefined,
        detalle: detalle || undefined,
        monto: montoNumero,
      });
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setContacto("");
      setTelefono("");
      setMonto("");
      setDetalle("");
    });
  }

  return (
    <div className="app-card">
      <p className="app-card-titulo">Registrar una venta</p>
      <div className="app-field">
        <label className="app-field-label" htmlFor="venta-contacto">
          A quién le vendiste
        </label>
        <input
          id="venta-contacto"
          className="app-input"
          value={contacto}
          maxLength={200}
          onChange={(e) => setContacto(e.target.value)}
          placeholder="Nombre del cliente o negocio"
        />
      </div>
      <div className="app-field">
        <label className="app-field-label" htmlFor="venta-telefono">
          Teléfono (opcional)
        </label>
        <input
          id="venta-telefono"
          className="app-input"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="300 123 4567"
          inputMode="tel"
        />
      </div>
      <div className="app-field">
        <label className="app-field-label" htmlFor="venta-monto">
          Monto en pesos (opcional)
        </label>
        <input
          id="venta-monto"
          className="app-input"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="150000"
          inputMode="numeric"
        />
      </div>
      <div className="app-field">
        <label className="app-field-label" htmlFor="venta-detalle">
          Qué vendiste (opcional)
        </label>
        <input
          id="venta-detalle"
          className="app-input"
          value={detalle}
          maxLength={2000}
          onChange={(e) => setDetalle(e.target.value)}
          placeholder="Ej.: 2 cortes + barba"
        />
      </div>
      {error && (
        <p className="app-error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="app-btn"
        onClick={guardar}
        disabled={guardando || !contacto.trim()}
      >
        {guardando ? "Guardando…" : "Guardar venta"}
      </button>
    </div>
  );
}

function TablaVentas({ ventas }: { ventas: Venta[] }) {
  const [borrando, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function borrar(id: string) {
    setError(null);
    startTransition(async () => {
      const r = await eliminarVenta(id);
      if (r.error) setError(r.error);
    });
  }

  return (
    <>
      {error && (
        <p className="app-error" role="alert">
          {error}
        </p>
      )}
      <div className="app-tabla-scroll">
        <table className="app-tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Contacto</th>
              <th>Detalle</th>
              <th>Monto</th>
              <th aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {ventas.map((v) => (
              <tr key={v.id}>
                <td className="app-tabla-num">{v.fecha}</td>
                <td>
                  {v.contacto}
                  {v.telefono ? (
                    <span className="app-card-nota"> · {v.telefono}</span>
                  ) : null}
                </td>
                <td>{v.detalle ?? "—"}</td>
                <td className="app-tabla-num">
                  {v.monto === null ? "—" : formatearCOP(Number(v.monto))}
                </td>
                <td>
                  <button
                    type="button"
                    className="app-tabla-accion"
                    onClick={() => borrar(v.id)}
                    disabled={borrando}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
