"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { crearCliente } from "@/lib/admin/cartera-actions";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input } from "@/components/admin/ui/Field";
import { IconButton } from "@/components/admin/ui/IconButton";

type Props = {
  onCreado: (id: string) => void;
  onCancelar: () => void;
};

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
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-tinta">Cliente nuevo</h2>
          <p className="text-xs text-tinta-40">
            También puedes convertir un negocio del CRM desde su ficha.
          </p>
        </div>
        <IconButton etiqueta="Cancelar" onClick={onCancelar}>
          <X className="h-4 w-4" />
        </IconButton>
      </div>

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

      <Button
        variante="primaria"
        type="submit"
        className="self-start"
        disabled={guardando || !nombre.trim()}
      >
        {guardando ? "Guardando…" : "Crear cliente"}
      </Button>
    </form>
  );
}
