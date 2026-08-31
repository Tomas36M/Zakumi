"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { asignarNumeroAAgente, estadoTelefonia } from "@/lib/admin/voz-actions";
import type { NumeroEleven } from "@/lib/voz/api";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Field, Select } from "@/components/admin/ui/Field";

/**
 * Con qué número llama este agente. Autocontenido: carga los números del
 * workspace por su cuenta, así la ficha no arrastra props ni el server hace
 * un fetch más cuando nadie abre "Avanzado".
 */
export function NumeroAgente({
  agenteId,
  numeroActual,
}: {
  agenteId: string;
  numeroActual: string | null;
}) {
  const router = useRouter();
  const [cargando, startCargar] = useTransition();
  const [guardando, startGuardar] = useTransition();
  const [numeros, setNumeros] = useState<NumeroEleven[] | null>(null);
  const [envPorDefecto, setEnvPorDefecto] = useState<string | null>(null);
  const [valor, setValor] = useState(numeroActual ?? "");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    startCargar(async () => {
      try {
        const e = await estadoTelefonia();
        setNumeros(e.numeros);
        setEnvPorDefecto(e.numeroEnv);
      } catch {
        setNumeros([]);
      }
    });
  }, []);

  function guardar() {
    setError(null);
    setAviso(null);
    startGuardar(async () => {
      try {
        const r = await asignarNumeroAAgente(agenteId, valor || null);
        if (r.error) {
          setError(r.error);
          return;
        }
        setAviso(valor ? "Número asignado." : "Vuelve al número por defecto.");
        router.refresh();
      } catch {
        setError("Se perdió la conexión asignando el número.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Field label="Número desde el que llama">
        <Select value={valor} onChange={(e) => setValor(e.target.value)} disabled={cargando}>
          <option value="">
            {envPorDefecto ? "El número por defecto de Zakumi" : "Sin número (no puede llamar)"}
          </option>
          {(numeros ?? []).map((n) => (
            <option key={n.phone_number_id} value={n.phone_number_id}>
              {n.numero} — {n.etiqueta}
            </option>
          ))}
        </Select>
      </Field>
      {numeros !== null && numeros.length === 0 && (
        <p className="text-xs text-tinta-40">
          No hay números en el workspace. Cómpralo o impórtalo en Voz → Telefonía.
        </p>
      )}
      {valor !== (numeroActual ?? "") && (
        <Button className="self-start" onClick={guardar} disabled={guardando}>
          {guardando ? "Asignando…" : "Asignar número"}
        </Button>
      )}
      {error && <Banner variante="error">{error}</Banner>}
      {aviso && <Banner>{aviso}</Banner>}
    </div>
  );
}
