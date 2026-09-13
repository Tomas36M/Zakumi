"use client";

import { useState, useTransition } from "react";
import { actualizarCliente } from "@/lib/admin/cartera-actions";
import type { Cliente } from "@/lib/admin/cartera";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input, TextArea } from "@/components/admin/ui/Field";
import { Toggle } from "@/components/admin/ui/Toggle";

type Cambios = Parameters<typeof actualizarCliente>[1];

type Form = { nombre: string; telefono: string; email: string; notas: string; activo: boolean };

function formDe(c: Cliente): Form {
  return {
    nombre: c.nombre,
    telefono: c.telefono ?? "",
    email: c.email ?? "",
    notas: c.notas ?? "",
    activo: c.activo,
  };
}

/** Solo lo que cambió viaja a la action. */
function cambiosEntre(antes: Form, ahora: Form): Cambios {
  const c: Cambios = {};
  if (ahora.nombre !== antes.nombre) c.nombre = ahora.nombre;
  if (ahora.telefono !== antes.telefono) c.telefono = ahora.telefono;
  if (ahora.email !== antes.email) c.email = ahora.email;
  if (ahora.notas !== antes.notas) c.notas = ahora.notas;
  if (ahora.activo !== antes.activo) c.activo = ahora.activo;
  return c;
}

type Props = {
  cliente: Cliente;
  onGuardado: () => void;
  onCancelar: () => void;
};

/** Editar los datos del cliente: nombre, contacto, notas y si sigue activo. */
export function FormCliente({ cliente, onGuardado, onCancelar }: Props) {
  const [guardando, startGuardar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(() => formDe(cliente));
  const cambios = cambiosEntre(formDe(cliente), form);
  const hayCambios = Object.keys(cambios).length > 0;

  function poner<K extends keyof Form>(clave: K, valor: Form[K]) {
    setForm((f) => ({ ...f, [clave]: valor }));
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-fila border border-hairline p-3"
      aria-label="Datos del cliente"
      onSubmit={(e) => {
        e.preventDefault();
        if (!hayCambios) return;
        setError(null);
        startGuardar(async () => {
          const res = await actualizarCliente(cliente.id, cambios);
          if (res.error) {
            setError(res.error);
            return;
          }
          onGuardado();
        });
      }}
    >
      <Field label="Nombre">
        <Input value={form.nombre} onChange={(e) => poner("nombre", e.target.value)} maxLength={300} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Teléfono">
          <Input
            type="tel"
            value={form.telefono}
            onChange={(e) => poner("telefono", e.target.value)}
            placeholder="310 1234567"
          />
        </Field>
        <Field label="Correo">
          <Input type="email" value={form.email} onChange={(e) => poner("email", e.target.value)} />
        </Field>
      </div>
      <Field label="Notas">
        <TextArea value={form.notas} onChange={(e) => poner("notas", e.target.value)} rows={2} maxLength={4000} />
      </Field>
      <Toggle activo={form.activo} onCambiar={(v) => poner("activo", v)} etiqueta="Cliente activo" />

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
