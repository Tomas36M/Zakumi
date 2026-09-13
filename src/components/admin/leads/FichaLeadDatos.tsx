"use client";

import { useState, useTransition } from "react";
import { actualizarNegocio } from "@/lib/admin/actions";
import { ESTADOS, type EstadoNegocio, type Negocio } from "@/lib/admin/negocios";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input, Select } from "@/components/admin/ui/Field";

type Cambios = Parameters<typeof actualizarNegocio>[1];

type Form = {
  nombre: string;
  telefono: string;
  ciudad: string;
  categoria: string;
  estado: EstadoNegocio;
  direccion: string;
  sitio_web: string;
};

function formDe(n: Negocio): Form {
  return {
    nombre: n.nombre,
    telefono: n.telefono ?? "",
    ciudad: n.ciudad ?? "",
    categoria: n.categoria ?? "",
    estado: n.estado,
    direccion: n.direccion ?? "",
    sitio_web: n.sitio_web ?? "",
  };
}

/** Solo lo que cambió viaja a la action: la whitelist del servidor hace el
 * resto (normaliza el teléfono, valida la URL, limpia la ciudad). */
function cambiosEntre(antes: Form, ahora: Form): Cambios {
  const c: Cambios = {};
  if (ahora.nombre !== antes.nombre) c.nombre = ahora.nombre;
  if (ahora.telefono !== antes.telefono) c.telefono = ahora.telefono;
  if (ahora.ciudad !== antes.ciudad) c.ciudad = ahora.ciudad;
  if (ahora.categoria !== antes.categoria) c.categoria = ahora.categoria;
  if (ahora.estado !== antes.estado) c.estado = ahora.estado;
  if (ahora.direccion !== antes.direccion) c.direccion = ahora.direccion;
  if (ahora.sitio_web !== antes.sitio_web) c.sitio_web = ahora.sitio_web;
  return c;
}

/** Los datos del lead, editables en un solo formulario con un solo Guardar
 * (no por tecla: cada guardado revalida la pantalla entera). El dueño monta
 * la ficha con `key={negocio.id}`, así que el estado nace del negocio. */
export function FichaLeadDatos({ negocio, onCambio }: { negocio: Negocio; onCambio: () => void }) {
  const [guardando, startGuardar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [form, setForm] = useState<Form>(() => formDe(negocio));
  const original = formDe(negocio);
  const cambios = cambiosEntre(original, form);
  const hayCambios = Object.keys(cambios).length > 0;

  function poner<K extends keyof Form>(clave: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setGuardado(false);
      setForm((f) => ({ ...f, [clave]: e.target.value }));
    };
  }

  return (
    <form
      className="flex flex-col gap-3"
      aria-label="Datos del negocio"
      onSubmit={(e) => {
        e.preventDefault();
        if (!hayCambios) return;
        setError(null);
        startGuardar(async () => {
          const res = await actualizarNegocio(negocio.id, cambios);
          if (res.error) {
            setError(res.error);
            return;
          }
          setGuardado(true);
          onCambio();
        });
      }}
    >
      <Field label="Nombre">
        <Input value={form.nombre} onChange={poner("nombre")} maxLength={300} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Teléfono">
          <Input
            type="tel"
            value={form.telefono}
            onChange={poner("telefono")}
            placeholder="310 1234567"
          />
        </Field>
        <Field label="Ciudad">
          <Input value={form.ciudad} onChange={poner("ciudad")} maxLength={120} />
        </Field>
        <Field label="Categoría">
          <Input
            value={form.categoria}
            onChange={poner("categoria")}
            placeholder="ferretería, panadería…"
            maxLength={120}
          />
        </Field>
        <Field label="Estado">
          <Select value={form.estado} onChange={poner("estado")}>
            {ESTADOS.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Dirección">
        <Input value={form.direccion} onChange={poner("direccion")} maxLength={300} />
      </Field>
      <Field label="Sitio web">
        <Input
          type="url"
          value={form.sitio_web}
          onChange={poner("sitio_web")}
          placeholder="https://…"
        />
      </Field>

      {negocio.tipo_telefono === "fijo" && (
        <p className="text-xs text-tinta-40">Teléfono fijo: sin WhatsApp, pero Zak sí puede llamar.</p>
      )}
      {error && <Banner variante="error">{error}</Banner>}

      <div className="flex items-center gap-3">
        <Button variante="primaria" type="submit" disabled={guardando || !hayCambios}>
          {guardando ? "Guardando…" : "Guardar cambios"}
        </Button>
        {guardado && !hayCambios && <span className="text-xs text-tinta-40">Guardado.</span>}
      </div>
    </form>
  );
}
