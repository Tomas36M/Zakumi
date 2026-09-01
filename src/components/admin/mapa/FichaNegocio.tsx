"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { actualizarNegocio, agregarNota } from "@/lib/admin/actions";
import { convertirNegocioEnCliente } from "@/lib/admin/cartera-actions";
import {
  ESTADOS,
  type EstadoNegocio,
  type Negocio,
  type Nota,
} from "@/lib/admin/negocios";
import Link from "next/link";
import { linkChatZak } from "@/lib/admin/zak";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input, Select, TextArea } from "@/components/admin/ui/Field";
import { IconButton } from "@/components/admin/ui/IconButton";
import { Island } from "@/components/admin/ui/Island";
import { ListRow } from "@/components/admin/ui/ListRow";
import { Skeleton } from "@/components/admin/ui/Skeleton";

async function fetchNotas(negocioId: string): Promise<Nota[]> {
  const supabase = createSupabaseBrowser();
  const { data } = await supabase
    .from("notas")
    .select("*")
    .eq("negocio_id", negocioId)
    .order("created_at", { ascending: false });
  return (data as Nota[]) ?? [];
}

type Props = {
  negocio: Negocio;
  onCambio: () => void; // router.refresh() del dueño
  onCerrar: () => void;
};

export function FichaNegocio({ negocio, onCambio, onCerrar }: Props) {
  const router = useRouter();
  const [guardando, startGuardar] = useTransition();
  const chatZak = linkChatZak(negocio);
  const [error, setError] = useState<string | null>(null);
  const [telefonoEdit, setTelefonoEdit] = useState<string | null>(null);
  const [notas, setNotas] = useState<Nota[] | null>(null);
  const [notaNueva, setNotaNueva] = useState("");

  // El dueño monta esta ficha con key={negocio.id}: al cambiar de negocio el
  // componente se remonta y el estado vuelve solo a su valor inicial.
  useEffect(() => {
    let activo = true;
    fetchNotas(negocio.id).then((ns) => {
      if (activo) setNotas(ns);
    });
    return () => {
      activo = false;
    };
  }, [negocio.id]);

  async function cargarNotas() {
    setNotas(await fetchNotas(negocio.id));
  }

  function guardar(cambios: Parameters<typeof actualizarNegocio>[1]) {
    setError(null);
    startGuardar(async () => {
      const res = await actualizarNegocio(negocio.id, cambios);
      if (res.error) {
        setError(res.error);
        return;
      }
      onCambio();
      // El cambio de estado deja nota automática en la base: refrescarlas.
      void cargarNotas();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-tinta">{negocio.nombre}</h2>
          <p className="text-xs text-tinta-40">
            {[
              negocio.categoria?.replaceAll("_", " "),
              negocio.ciudad,
              negocio.rating !== null ? `${negocio.rating.toFixed(1)}★` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <IconButton etiqueta="Cerrar ficha" onClick={onCerrar}>
          <X className="h-4 w-4" />
        </IconButton>
      </div>

      {negocio.direccion ? (
        <p className="text-sm text-tinta-60">{negocio.direccion}</p>
      ) : null}

      <Field label="Estado">
        <Select
          value={negocio.estado}
          disabled={guardando}
          onChange={(e) => guardar({ estado: e.target.value as EstadoNegocio })}
        >
          {ESTADOS.map((e) => (
            <option key={e.valor} value={e.valor}>
              {e.label}
            </option>
          ))}
        </Select>
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-tinta-60">Teléfono</span>
        {telefonoEdit === null ? (
          <div className="flex items-center justify-between gap-2">
            <span
              className={negocio.telefono ? "text-sm text-tinta" : "text-sm text-tinta-40"}
            >
              {negocio.telefono ?? "Sin teléfono"}
              {negocio.tipo_telefono === "fijo" ? " · fijo, sin WhatsApp" : ""}
            </span>
            <Button onClick={() => setTelefonoEdit(negocio.telefono ?? "")}>
              Editar
            </Button>
          </div>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              guardar({ telefono: telefonoEdit });
              setTelefonoEdit(null);
            }}
          >
            <Input
              className="flex-1"
              type="tel"
              value={telefonoEdit}
              onChange={(e) => setTelefonoEdit(e.target.value)}
              placeholder="310 1234567"
              autoFocus
            />
            <Button type="submit" disabled={guardando}>
              Guardar
            </Button>
          </form>
        )}
      </div>

      {error ? <Banner variante="error">{error}</Banner> : null}

      <div className="flex flex-wrap gap-2">
        {chatZak !== null ? (
          <Link
            href={chatZak}
            className="inline-flex h-control items-center justify-center gap-2 rounded-full bg-acento px-4 text-sm font-medium text-white transition-colors hover:bg-acento-85"
          >
            Chat con Zak
          </Link>
        ) : null}
        {negocio.sitio_web ? (
          <a
            href={negocio.sitio_web}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-control items-center justify-center gap-2 rounded-full bg-isla-alta px-4 text-sm font-medium text-tinta-85 transition-colors hover:bg-acento-10 hover:text-tinta"
          >
            Sitio web
          </a>
        ) : null}
        <Button
          disabled={guardando}
          onClick={() => {
            setError(null);
            startGuardar(async () => {
              const res = await convertirNegocioEnCliente(negocio.id);
              if ("error" in res) {
                setError(res.error);
                return;
              }
              // Idempotente: si ya era cliente, aterriza en su misma ficha.
              router.push(`/admin/clientes?cliente=${res.clienteId}`);
            });
          }}
        >
          Convertir en cliente
        </Button>
      </div>

      <Island className="bg-isla-alta/50" titulo="Notas" aria-label="Notas del negocio">
        <form
          className="mb-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const texto = notaNueva.trim();
            if (!texto) return;
            setError(null);
            startGuardar(async () => {
              const res = await agregarNota(negocio.id, texto);
              if (res.error) {
                setError(res.error);
                return;
              }
              setNotaNueva("");
              void cargarNotas();
            });
          }}
        >
          <TextArea
            value={notaNueva}
            onChange={(e) => setNotaNueva(e.target.value)}
            placeholder="Qué pasó con este negocio…"
            rows={2}
            maxLength={4000}
          />
          <Button
            type="submit"
            className="self-start"
            disabled={guardando || !notaNueva.trim()}
          >
            Anotar
          </Button>
        </form>

        {notas === null ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ) : notas.length === 0 ? (
          <p className="text-sm text-tinta-40">
            Todavía no hay notas. La primera se escribe sola al cambiar el
            estado.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {notas.map((n) => (
              <li key={n.id}>
                <ListRow interactiva={false} className="flex flex-col gap-0.5">
                  <span className="text-xs text-tinta-40">
                    {new Date(n.created_at).toLocaleDateString("es-CO", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span
                    className={
                      n.automatica ? "text-sm text-tinta-60 italic" : "text-sm text-tinta"
                    }
                  >
                    {n.texto}
                  </span>
                </ListRow>
              </li>
            ))}
          </ul>
        )}
      </Island>
    </div>
  );
}
