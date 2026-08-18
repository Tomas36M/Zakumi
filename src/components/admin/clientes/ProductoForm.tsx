"use client";

import { useEffect, useState, useTransition } from "react";
import { crearProducto } from "@/lib/admin/cartera-actions";
import {
  CICLOS,
  TIPOS_PRODUCTO,
  type Ciclo,
  type TipoProducto,
} from "@/lib/admin/cartera";

type InstanciaCorta = { id: number; slug: string; nombre: string; activo: boolean };

type Props = {
  clienteId: string;
  hoy: string;
  onCreado: () => void;
  onCancelar: () => void;
  /** Prefill desde una oportunidad del catálogo (ficha 360). */
  inicial?: { tipo?: TipoProducto; nombre?: string; tarifa?: number; ciclo?: Ciclo };
};

export function ProductoForm({ clienteId, hoy, onCreado, onCancelar, inicial }: Props) {
  const [guardando, startGuardar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoProducto>(inicial?.tipo ?? "bot");
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [tarifa, setTarifa] = useState(inicial?.tarifa != null ? String(inicial.tarifa) : "");
  const [ciclo, setCiclo] = useState<Ciclo>(inicial?.ciclo ?? "mensual");
  const [proximaFecha, setProximaFecha] = useState(hoy);
  const [dominio, setDominio] = useState("");
  const [instanciaId, setInstanciaId] = useState("");
  // null = cargando; [] = sin conexión o sin bots → cae al input de texto.
  const [instancias, setInstancias] = useState<InstanciaCorta[] | null>(null);

  useEffect(() => {
    if (tipo !== "bot") return;
    let activo = true;
    void (async () => {
      try {
        const res = await fetch("/admin/api/bots/instancias");
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { instancias: InstanciaCorta[] };
        if (activo) setInstancias(data.instancias);
      } catch {
        if (activo) setInstancias([]);
      }
    })();
    return () => {
      activo = false;
    };
  }, [tipo]);

  return (
    <form
      className="adm-nuevo-form adm-producto-form"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startGuardar(async () => {
          const res = await crearProducto({
            cliente_id: clienteId,
            tipo,
            nombre,
            tarifa: Number(tarifa),
            ciclo,
            proxima_fecha: ciclo === "unico" ? undefined : proximaFecha,
            dominio: tipo === "web" ? dominio || undefined : undefined,
            instancia_id: tipo === "bot" ? instanciaId || undefined : undefined,
          });
          if ("error" in res) {
            setError(res.error);
            return;
          }
          onCreado();
        });
      }}
    >
      <label className="adm-field">
        <span className="adm-field-label">Tipo</span>
        <select
          className="adm-select"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoProducto)}
        >
          {TIPOS_PRODUCTO.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="adm-field">
        <span className="adm-field-label">Nombre *</span>
        <input
          className="adm-input"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={tipo === "bot" ? "Bot de la ferretería" : "Web corporativa"}
          required
          maxLength={200}
        />
      </label>

      <label className="adm-field">
        <span className="adm-field-label">Tarifa (COP) *</span>
        <input
          className="adm-input"
          type="number"
          min={0}
          step="any"
          value={tarifa}
          onChange={(e) => setTarifa(e.target.value)}
          placeholder="150000"
          required
        />
      </label>

      <label className="adm-field">
        <span className="adm-field-label">Ciclo</span>
        <select
          className="adm-select"
          value={ciclo}
          onChange={(e) => setCiclo(e.target.value as Ciclo)}
        >
          {CICLOS.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      {ciclo !== "unico" ? (
        <label className="adm-field">
          <span className="adm-field-label">Primer cobro</span>
          <input
            className="adm-input"
            type="date"
            value={proximaFecha}
            onChange={(e) => setProximaFecha(e.target.value)}
            required
          />
        </label>
      ) : null}

      {tipo === "web" ? (
        <label className="adm-field">
          <span className="adm-field-label">Dominio</span>
          <input
            className="adm-input"
            value={dominio}
            onChange={(e) => setDominio(e.target.value)}
            placeholder="laferreteria.com.co"
          />
        </label>
      ) : null}

      {tipo === "bot" ? (
        <label className="adm-field">
          <span className="adm-field-label">Instancia del bot</span>
          {instancias && instancias.length > 0 ? (
            <select
              className="adm-select"
              value={instanciaId}
              onChange={(e) => setInstanciaId(e.target.value)}
            >
              <option value="">— sin vincular todavía —</option>
              {instancias.map((i) => (
                <option key={i.id} value={String(i.id)}>
                  {i.nombre} ({i.slug}){i.activo ? "" : " · apagado"}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="adm-input"
              value={instanciaId}
              onChange={(e) => setInstanciaId(e.target.value)}
              placeholder={
                instancias === null ? "cargando bots…" : "id numérico (bot sin conexión)"
              }
            />
          )}
        </label>
      ) : null}

      {error ? (
        <p className="adm-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="adm-ficha-acciones">
        <button className="adm-cta" type="submit" disabled={guardando || !nombre.trim()}>
          {guardando ? "Guardando…" : "Guardar producto"}
        </button>
        <button className="adm-cta-ghost" type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
