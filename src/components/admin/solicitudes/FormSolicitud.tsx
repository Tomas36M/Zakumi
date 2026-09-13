"use client";

import { useState, useTransition } from "react";
import { actualizarSolicitud } from "@/lib/admin/solicitudes-actions";
import { CATALOGO_ZAKUMI, SLUG_POR_DEFINIR } from "@/lib/catalogo";
import type { CambiosSolicitud, Solicitud } from "@/lib/portal/solicitudes";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input, Select, TextArea } from "@/components/admin/ui/Field";

type Form = {
  contacto_nombre: string;
  contacto_telefono: string;
  contacto_email: string;
  servicio_slug: string;
  mensaje: string;
};

function formDe(s: Solicitud): Form {
  return {
    contacto_nombre: s.contacto_nombre ?? "",
    contacto_telefono: s.contacto_telefono ?? "",
    contacto_email: s.contacto_email ?? "",
    servicio_slug: s.servicio_slug,
    mensaje: s.mensaje ?? "",
  };
}

/** Solo lo que cambió viaja a la action (la whitelist vive en el servidor). */
function cambiosEntre(antes: Form, ahora: Form): CambiosSolicitud {
  const c: CambiosSolicitud = {};
  if (ahora.contacto_nombre !== antes.contacto_nombre) c.contacto_nombre = ahora.contacto_nombre;
  if (ahora.contacto_telefono !== antes.contacto_telefono) c.contacto_telefono = ahora.contacto_telefono;
  if (ahora.contacto_email !== antes.contacto_email) c.contacto_email = ahora.contacto_email;
  if (ahora.servicio_slug !== antes.servicio_slug) c.servicio_slug = ahora.servicio_slug;
  if (ahora.mensaje !== antes.mensaje) c.mensaje = ahora.mensaje;
  return c;
}

type Props = {
  solicitud: Solicitud;
  onGuardado: () => void;
  onCancelar: () => void;
};

/** Editar a mano lo que Zak (o la tienda) capturó: contacto, servicio, mensaje. */
export function FormSolicitud({ solicitud: s, onGuardado, onCancelar }: Props) {
  const [guardando, startGuardar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(() => formDe(s));
  const cambios = cambiosEntre(formDe(s), form);
  const hayCambios = Object.keys(cambios).length > 0;

  function poner<K extends keyof Form>(clave: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [clave]: e.target.value }));
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-fila border border-hairline p-3"
      aria-label="Editar solicitud"
      onSubmit={(e) => {
        e.preventDefault();
        if (!hayCambios) return;
        setError(null);
        startGuardar(async () => {
          const res = await actualizarSolicitud(s.id, cambios);
          if (res.error) {
            setError(res.error);
            return;
          }
          onGuardado();
        });
      }}
    >
      <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2">
        <Field label="Nombre">
          <Input value={form.contacto_nombre} onChange={poner("contacto_nombre")} maxLength={200} />
        </Field>
        <Field label="Teléfono">
          <Input
            type="tel"
            value={form.contacto_telefono}
            onChange={poner("contacto_telefono")}
            placeholder="310 1234567"
          />
        </Field>
        <Field label="Correo">
          <Input type="email" value={form.contacto_email} onChange={poner("contacto_email")} maxLength={200} />
        </Field>
        <Field label="Servicio">
          <Select
            value={form.servicio_slug}
            onChange={poner("servicio_slug")}
            // Con producto contratado el servicio ya no se cambia (lo
            // rechaza también el servidor).
            disabled={s.producto_id !== null}
          >
            <option value={SLUG_POR_DEFINIR}>Por definir</option>
            {CATALOGO_ZAKUMI.map((sv) => (
              <option key={sv.slug} value={sv.slug}>
                {sv.nombre}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Lo que pidió">
        <TextArea value={form.mensaje} onChange={poner("mensaje")} rows={3} maxLength={2000} />
      </Field>

      {error && <Banner variante="error">{error}</Banner>}

      <div className="flex flex-wrap gap-2">
        <Button variante="primaria" type="submit" disabled={guardando || !hayCambios}>
          {guardando ? "Guardando…" : "Guardar cambios"}
        </Button>
        <Button onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
