"use client";

import { useState, useTransition } from "react";
import { crearCliente } from "@/lib/admin/cartera-actions";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input } from "@/components/admin/ui/Field";

type Props = {
  onCreado: (id: string) => void;
  onCancelar: () => void;
};

/** El alta de un cliente. Va dentro de un Modal, que pone el título. */
export function NuevoClienteForm({ onCreado, onCancelar }: Props) {
  const [guardando, startGuardar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startGuardar(async () => {
          const res = await crearCliente({
            nombre,
            telefono: telefono || undefined,
            email: email || undefined,
          });
          if ("error" in res) {
            setError(res.error);
            return;
          }
          onCreado(res.id);
        });
      }}
    >
      <Field label="Nombre *">
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          maxLength={300}
          autoFocus
        />
      </Field>

      <Field label="Teléfono">
        <Input
          type="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="310 1234567"
        />
      </Field>

      <Field label="Correo">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>

      {error ? <Banner variante="error">{error}</Banner> : null}

      <div className="flex flex-wrap gap-2">
        <Button variante="primaria" type="submit" disabled={guardando || !nombre.trim()}>
          {guardando ? "Guardando…" : "Crear cliente"}
        </Button>
        <Button onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
