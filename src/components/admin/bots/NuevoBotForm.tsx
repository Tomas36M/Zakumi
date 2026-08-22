"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { crearBot } from "@/lib/admin/bots-actions";
import {
  ACUSE_ESCALADO_DEFAULT,
  FALLBACK_REPLY_DEFAULT,
  PLANTILLAS,
} from "@/lib/bots/plantillas";
import { PROVEEDORES, type Proveedor } from "@/lib/bots/tipos";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input, Select, TextArea } from "@/components/admin/ui/Field";
import { IconButton } from "@/components/admin/ui/IconButton";
import { Island } from "@/components/admin/ui/Island";

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
      <Island className="flex max-w-2xl flex-col gap-4 bg-isla-alta/50">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-tinta">Bot nuevo</h2>
            <p className="text-xs text-tinta-40">
              Nace con la plantilla elegida como prompt v1: se afina después en el editor.
            </p>
          </div>
          <IconButton etiqueta="Cancelar" onClick={onCancelar}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-xs font-semibold tracking-wide text-tinta-60 uppercase">
            Identidad
          </legend>
          <Field label="Nombre *">
            <Input
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
          </Field>
          <Field label="Slug (identificador técnico)">
            <Input
              value={slug}
              onChange={(e) => {
                setSlugTocado(true);
                setSlug(e.target.value);
              }}
              pattern="[a-z0-9-]{2,40}"
              title="Letras minúsculas, números y guiones"
              required
            />
          </Field>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-xs font-semibold tracking-wide text-tinta-60 uppercase">
            Canal
          </legend>
          <Field label="Proveedor de WhatsApp">
            <Select
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value as Proveedor)}
            >
              {PROVEEDORES.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>

          {proveedor === "green" ? (
            <>
              <Field label="Green API — URL">
                <Input
                  value={cred("green_api_url")}
                  onChange={(e) => setCred("green_api_url", e.target.value)}
                  placeholder="https://7105.api.greenapi.com"
                />
              </Field>
              <Field label="Green API — Instance ID">
                <Input
                  value={cred("green_instance_id")}
                  onChange={(e) => setCred("green_instance_id", e.target.value)}
                />
              </Field>
              <Field label="Green API — Token">
                <Input
                  value={cred("green_api_token")}
                  onChange={(e) => setCred("green_api_token", e.target.value)}
                />
              </Field>
              <Field label="Green API — Token del webhook">
                <Input
                  value={cred("green_webhook_token")}
                  onChange={(e) => setCred("green_webhook_token", e.target.value)}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Meta — Phone Number ID">
                <Input
                  value={cred("meta_phone_number_id")}
                  onChange={(e) => setCred("meta_phone_number_id", e.target.value)}
                />
              </Field>
              <Field label="Meta — WABA ID">
                <Input
                  value={cred("meta_waba_id")}
                  onChange={(e) => setCred("meta_waba_id", e.target.value)}
                />
              </Field>
              <Field label="Meta — Access token">
                <Input
                  value={cred("meta_access_token")}
                  onChange={(e) => setCred("meta_access_token", e.target.value)}
                />
              </Field>
            </>
          )}

          <Field label="Avisar escalados a (WhatsApp)">
            <Input
              type="tel"
              value={notificarA}
              onChange={(e) => setNotificarA(e.target.value)}
              placeholder="573001234567"
            />
          </Field>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-xs font-semibold tracking-wide text-tinta-60 uppercase">
            Cerebro
          </legend>
          <Field label="Plantilla de prompt">
            <Select value={plantilla} onChange={(e) => setPlantilla(e.target.value)}>
              {PLANTILLAS.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-xs text-tinta-40">
            {PLANTILLAS.find((p) => p.slug === plantilla)?.descripcion}
          </p>
          <Field label="Acuse cuando escala a humano">
            <TextArea
              value={acuse}
              onChange={(e) => setAcuse(e.target.value)}
              rows={2}
              required
            />
          </Field>
          <Field label="Respuesta de respaldo (si el agente falla)">
            <TextArea
              value={fallback}
              onChange={(e) => setFallback(e.target.value)}
              rows={2}
              required
            />
          </Field>
        </fieldset>

        {error ? <Banner variante="error">{error}</Banner> : null}

        <Button
          variante="primaria"
          type="submit"
          className="self-start"
          disabled={guardando || !nombre.trim() || !slug.trim()}
        >
          {guardando ? "Creando…" : "Crear bot"}
        </Button>
      </Island>
    </form>
  );
}
