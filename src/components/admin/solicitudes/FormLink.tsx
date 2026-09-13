"use client";

import { useState } from "react";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input } from "@/components/admin/ui/Field";
import { BotonRechazar } from "./BotonRechazar";

type Props = {
  ocupado: boolean;
  onEnviar: (link: string) => void;
  onRechazar: (motivo: string) => void;
};

/** El link de pago manual (Wompi / Bold) que se le publica al cliente. */
export function FormLink({ ocupado, onEnviar, onRechazar }: Props) {
  const [link, setLink] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <Field label="Link de pago (Wompi / Bold)">
        <Input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://checkout.wompi.co/…"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variante="primaria"
          disabled={ocupado || !/^https:\/\/\S+$/i.test(link.trim())}
          onClick={() => onEnviar(link.trim())}
        >
          {ocupado ? "Publicando…" : "Publicar link al cliente"}
        </Button>
        <BotonRechazar ocupado={ocupado} onRechazar={onRechazar} />
      </div>
    </div>
  );
}
