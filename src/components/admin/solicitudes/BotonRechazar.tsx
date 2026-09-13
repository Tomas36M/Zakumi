"use client";

import { useState } from "react";
import { Button } from "@/components/admin/ui/Button";
import { Input } from "@/components/admin/ui/Field";

type Props = {
  ocupado: boolean;
  onRechazar: (motivo: string) => void;
};

/** «Rechazar» despliega el motivo en línea antes de confirmar. */
export function BotonRechazar({ ocupado, onRechazar }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");

  if (!abierto) {
    return (
      <Button disabled={ocupado} onClick={() => setAbierto(true)}>
        Rechazar
      </Button>
    );
  }
  return (
    <span className="flex flex-1 flex-wrap items-center gap-2">
      <Input
        className="min-w-48 flex-1"
        value={motivo}
        maxLength={2000}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Motivo (el cliente lo ve)"
      />
      <Button variante="peligro" disabled={ocupado} onClick={() => onRechazar(motivo)}>
        Confirmar rechazo
      </Button>
    </span>
  );
}
