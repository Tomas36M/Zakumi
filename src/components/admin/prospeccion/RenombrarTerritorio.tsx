"use client";

import { useState, useTransition } from "react";
import { NOMBRE_MAX, type Territorio } from "@/lib/admin/territorios";
import { renombrarTerritorio } from "@/lib/admin/territorios-actions";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input } from "@/components/admin/ui/Field";
import { Modal } from "@/components/admin/ui/Modal";

type Props = {
  /** El territorio a renombrar; `null` = modal cerrado. */
  territorio: Territorio | null;
  onCerrar: () => void;
  /** Ya guardado: el dueño refresca. */
  onRenombrado: () => void;
};

/** El modal de renombrar, compartido por la ficha del mapa y la página del
 * territorio. Se monta con `key={territorio.id}` desde el dueño para que el
 * campo arranque con el nombre actual. */
export function RenombrarTerritorio({ territorio, onCerrar, onRenombrado }: Props) {
  const [nombre, setNombre] = useState(territorio?.nombre ?? "");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, startAccion] = useTransition();

  function guardar() {
    if (!territorio || nombre.trim().length === 0) return;
    startAccion(async () => {
      const res = await renombrarTerritorio(territorio.id, nombre);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setError(null);
      onRenombrado();
    });
  }

  return (
    <Modal
      abierto={territorio !== null}
      onCerrar={(abierto) => {
        if (!abierto) onCerrar();
      }}
      titulo="Renombrar territorio"
    >
      <div className="flex flex-col gap-3">
        <Field label="Nombre">
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={NOMBRE_MAX}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") guardar();
            }}
          />
        </Field>
        {error && <Banner variante="error">{error}</Banner>}
        <div className="flex justify-end gap-2">
          <Button onClick={onCerrar} disabled={ocupado}>
            Cancelar
          </Button>
          <Button
            variante="primaria"
            disabled={ocupado || nombre.trim().length === 0}
            onClick={guardar}
          >
            {ocupado ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
