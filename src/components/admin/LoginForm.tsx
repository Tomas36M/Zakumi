"use client";

import { useActionState } from "react";
import { login, type EstadoLogin } from "@/lib/admin/actions";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input } from "@/components/admin/ui/Field";

const INICIAL: EstadoLogin = { error: null };

export function LoginForm() {
  const [estado, accion, enviando] = useActionState(login, INICIAL);

  return (
    <form action={accion} className="flex flex-col gap-4">
      <Field label="Correo">
        <Input type="email" name="email" autoComplete="email" required autoFocus />
      </Field>
      <Field label="Contraseña">
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </Field>
      {estado.error ? <Banner variante="error">{estado.error}</Banner> : null}
      <Button variante="primaria" type="submit" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
