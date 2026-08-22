"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { crearNegocioManual } from "@/lib/admin/actions";
import { CIUDADES, type Ciudad } from "@/lib/admin/negocios";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input, Select } from "@/components/admin/ui/Field";
import { IconButton } from "@/components/admin/ui/IconButton";

type Props = {
  lat: number;
  lng: number;
  ciudadSugerida: Exclude<Ciudad, "otra"> | null;
  onCreado: (id: string) => void;
  onCancelar: () => void;
};

export function NuevoNegocioForm(props: Props) {
  const [guardando, startGuardar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [ciudad, setCiudad] = useState<Ciudad>(props.ciudadSugerida ?? "otra");
  const [categoria, setCategoria] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startGuardar(async () => {
          const res = await crearNegocioManual({
            nombre,
            lat: props.lat,
            lng: props.lng,
            ciudad,
            categoria: categoria || undefined,
            telefono: telefono || undefined,
            direccion: direccion || undefined,
          });
          if ("error" in res) {
            setError(res.error);
            return;
          }
          props.onCreado(res.id);
        });
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-tinta">Negocio nuevo</h2>
          <p className="text-xs text-tinta-40">
            {props.lat.toFixed(5)}, {props.lng.toFixed(5)}
          </p>
        </div>
        <IconButton etiqueta="Cancelar" onClick={props.onCancelar}>
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

      <Field label="Ciudad">
        <Select value={ciudad} onChange={(e) => setCiudad(e.target.value as Ciudad)}>
          {CIUDADES.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.label}
            </option>
          ))}
          <option value="otra">Otra</option>
        </Select>
      </Field>

      <Field label="Teléfono">
        <Input
          type="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="310 1234567"
        />
      </Field>

      <Field label="Oficio / categoría">
        <Input
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          placeholder="ferretería, panadería…"
          maxLength={120}
        />
      </Field>

      <Field label="Dirección">
        <Input
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          maxLength={300}
        />
      </Field>

      {error ? <Banner variante="error">{error}</Banner> : null}

      <Button
        variante="primaria"
        type="submit"
        className="self-start"
        disabled={guardando || !nombre.trim()}
      >
        {guardando ? "Guardando…" : "Guardar negocio"}
      </Button>
    </form>
  );
}
