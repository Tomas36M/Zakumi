"use client";

import { useState, useTransition } from "react";
import { crearBot } from "@/lib/admin/bots-actions";
import {
  ACUSE_ESCALADO_DEFAULT,
  FALLBACK_REPLY_DEFAULT,
  PLANTILLAS,
} from "@/lib/bots/plantillas";
import { PROVEEDORES, type Proveedor } from "@/lib/bots/tipos";

type Props = {
  onCreado: (id: number) => void;
  onCancelar: () => void;
};

function slugDeNombre(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Formulario único (sin wizard): el API es un solo POST y los defaults cubren
 * el 80%. Tres grupos: identidad, canal (solo las credenciales del proveedor
 * elegido) y cerebro (plantilla por vertical).
 */
export function NuevoBotForm({ onCreado, onCancelar }: Props) {
  const [guardando, startGuardar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTocado, setSlugTocado] = useState(false);
  const [proveedor, setProveedor] = useState<Proveedor>("cloud");
  const [plantilla, setPlantilla] = useState(PLANTILLAS[0].slug);
  const [acuse, setAcuse] = useState(ACUSE_ESCALADO_DEFAULT);
  const [fallback, setFallback] = useState(FALLBACK_REPLY_DEFAULT);
  const [notificarA, setNotificarA] = useState("");
  const [credenciales, setCredenciales] = useState<Record<string, string>>({});

  const cred = (campo: string) => credenciales[campo] ?? "";
  const setCred = (campo: string, valor: string) =>
    setCredenciales((c) => ({ ...c, [campo]: valor }));

  return (
    <form
      className="adm-nuevo-form adm-bot-form"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startGuardar(async () => {
          const res = await crearBot({
            nombre,
            slug,
            proveedor,
            plantilla,
            acuse_escalado: acuse,
            fallback_reply: fallback,
            escalation_notify_to: notificarA || undefined,
            ...credenciales,
          });
          if ("error" in res) {
            setError(res.error);
            return;
          }
          onCreado(res.id);
        });
      }}
    >
      <div className="adm-ficha-cabecera">
        <div>
          <h2 className="adm-ficha-nombre">Bot nuevo</h2>
          <p className="adm-ficha-meta">
            Nace con la plantilla elegida como prompt v1: se afina después en el editor.
          </p>
        </div>
        <button
          type="button"
          className="adm-ficha-cerrar"
          aria-label="Cancelar"
          onClick={onCancelar}
        >
          ×
        </button>
      </div>

      <fieldset className="adm-bot-form-grupo">
        <legend className="adm-field-label">Identidad</legend>
        <label className="adm-field">
          <span className="adm-field-label">Nombre *</span>
          <input
            className="adm-input"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              if (!slugTocado) setSlug(slugDeNombre(e.target.value));
            }}
            required
            maxLength={120}
            autoFocus
            placeholder="Panadería La Espiga"
          />
        </label>
        <label className="adm-field">
          <span className="adm-field-label">Slug (identificador técnico)</span>
          <input
            className="adm-input"
            value={slug}
            onChange={(e) => {
              setSlugTocado(true);
              setSlug(e.target.value);
            }}
            pattern="[a-z0-9-]{2,40}"
            title="Letras minúsculas, números y guiones"
            required
          />
        </label>
      </fieldset>

      <fieldset className="adm-bot-form-grupo">
        <legend className="adm-field-label">Canal</legend>
        <label className="adm-field">
          <span className="adm-field-label">Proveedor de WhatsApp</span>
          <select
            className="adm-select"
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value as Proveedor)}
          >
            {PROVEEDORES.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        {proveedor === "green" ? (
          <>
            <label className="adm-field">
              <span className="adm-field-label">Green API — URL</span>
              <input
                className="adm-input"
                value={cred("green_api_url")}
                onChange={(e) => setCred("green_api_url", e.target.value)}
                placeholder="https://7105.api.greenapi.com"
              />
            </label>
            <label className="adm-field">
              <span className="adm-field-label">Green API — Instance ID</span>
              <input
                className="adm-input"
                value={cred("green_instance_id")}
                onChange={(e) => setCred("green_instance_id", e.target.value)}
              />
            </label>
            <label className="adm-field">
              <span className="adm-field-label">Green API — Token</span>
              <input
                className="adm-input"
                value={cred("green_api_token")}
                onChange={(e) => setCred("green_api_token", e.target.value)}
              />
            </label>
            <label className="adm-field">
              <span className="adm-field-label">Green API — Token del webhook</span>
              <input
                className="adm-input"
                value={cred("green_webhook_token")}
                onChange={(e) => setCred("green_webhook_token", e.target.value)}
              />
            </label>
          </>
        ) : (
          <>
            <label className="adm-field">
              <span className="adm-field-label">Meta — Phone Number ID</span>
              <input
                className="adm-input"
                value={cred("meta_phone_number_id")}
                onChange={(e) => setCred("meta_phone_number_id", e.target.value)}
              />
            </label>
            <label className="adm-field">
              <span className="adm-field-label">Meta — WABA ID</span>
              <input
                className="adm-input"
                value={cred("meta_waba_id")}
                onChange={(e) => setCred("meta_waba_id", e.target.value)}
              />
            </label>
            <label className="adm-field">
              <span className="adm-field-label">Meta — Access token</span>
              <input
                className="adm-input"
                value={cred("meta_access_token")}
                onChange={(e) => setCred("meta_access_token", e.target.value)}
              />
            </label>
          </>
        )}

        <label className="adm-field">
          <span className="adm-field-label">Avisar escalados a (WhatsApp)</span>
          <input
            className="adm-input"
            type="tel"
            value={notificarA}
            onChange={(e) => setNotificarA(e.target.value)}
            placeholder="573001234567"
          />
        </label>
      </fieldset>

      <fieldset className="adm-bot-form-grupo">
        <legend className="adm-field-label">Cerebro</legend>
        <label className="adm-field">
          <span className="adm-field-label">Plantilla de prompt</span>
          <select
            className="adm-select"
            value={plantilla}
            onChange={(e) => setPlantilla(e.target.value)}
          >
            {PLANTILLAS.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <p className="adm-ficha-meta">
          {PLANTILLAS.find((p) => p.slug === plantilla)?.descripcion}
        </p>
        <label className="adm-field">
          <span className="adm-field-label">Acuse cuando escala a humano</span>
          <textarea
            className="adm-textarea"
            value={acuse}
            onChange={(e) => setAcuse(e.target.value)}
            rows={2}
            required
          />
        </label>
        <label className="adm-field">
          <span className="adm-field-label">Respuesta de respaldo (si el agente falla)</span>
          <textarea
            className="adm-textarea"
            value={fallback}
            onChange={(e) => setFallback(e.target.value)}
            rows={2}
            required
          />
        </label>
      </fieldset>

      {error ? (
        <p className="adm-error" role="alert">
          {error}
        </p>
      ) : null}

      <button
        className="adm-cta"
        type="submit"
        disabled={guardando || !nombre.trim() || !slug.trim()}
      >
        {guardando ? "Creando…" : "Crear bot"}
      </button>
    </form>
  );
}
