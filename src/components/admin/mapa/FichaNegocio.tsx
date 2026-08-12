"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actualizarNegocio, agregarNota } from "@/lib/admin/actions";
import { convertirNegocioEnCliente } from "@/lib/admin/cartera-actions";
import {
  CIUDADES,
  ESTADOS,
  type EstadoNegocio,
  type Negocio,
  type Nota,
} from "@/lib/admin/negocios";
import { waMeUrl } from "@/lib/admin/telefono";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

const LABEL_CIUDAD = new Map<string, string>(
  CIUDADES.map((c) => [c.valor, c.label]),
);
LABEL_CIUDAD.set("otra", "Otra");

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
    <div className="adm-ficha-contenido">
      <div className="adm-ficha-cabecera">
        <div>
          <h2 className="adm-ficha-nombre">{negocio.nombre}</h2>
          <p className="adm-ficha-meta">
            {[
              negocio.categoria?.replaceAll("_", " "),
              LABEL_CIUDAD.get(negocio.ciudad),
              negocio.rating !== null ? `${negocio.rating.toFixed(1)}★` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <button
          type="button"
          className="adm-ficha-cerrar"
          aria-label="Cerrar ficha"
          onClick={onCerrar}
        >
          ×
        </button>
      </div>

      {negocio.direccion ? (
        <p className="adm-ficha-direccion">{negocio.direccion}</p>
      ) : null}

      <label className="adm-field">
        <span className="adm-field-label">Estado</span>
        <select
          className="adm-select"
          value={negocio.estado}
          disabled={guardando}
          onChange={(e) => guardar({ estado: e.target.value as EstadoNegocio })}
        >
          {ESTADOS.map((e) => (
            <option key={e.valor} value={e.valor}>
              {e.label}
            </option>
          ))}
        </select>
      </label>

      <div className="adm-field">
        <span className="adm-field-label">Teléfono</span>
        {telefonoEdit === null ? (
          <div className="adm-ficha-telefono">
            <span className={negocio.telefono ? "" : "adm-ficha-sin"}>
              {negocio.telefono ?? "Sin teléfono"}
              {negocio.tipo_telefono === "fijo" ? " · fijo, sin WhatsApp" : ""}
            </span>
            <button
              type="button"
              className="adm-ficha-editar"
              onClick={() => setTelefonoEdit(negocio.telefono ?? "")}
            >
              Editar
            </button>
          </div>
        ) : (
          <form
            className="adm-ficha-telefono-form"
            onSubmit={(e) => {
              e.preventDefault();
              guardar({ telefono: telefonoEdit });
              setTelefonoEdit(null);
            }}
          >
            <input
              className="adm-input"
              type="tel"
              value={telefonoEdit}
              onChange={(e) => setTelefonoEdit(e.target.value)}
              placeholder="310 1234567"
              autoFocus
            />
            <button className="adm-cta-ghost" type="submit" disabled={guardando}>
              Guardar
            </button>
          </form>
        )}
      </div>

      {error ? (
        <p className="adm-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="adm-ficha-acciones">
        {negocio.telefono && negocio.tipo_telefono === "movil" ? (
          <a
            className="adm-cta"
            href={waMeUrl(negocio.telefono)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir WhatsApp
          </a>
        ) : null}
        {negocio.sitio_web ? (
          <a
            className="adm-cta-ghost"
            href={negocio.sitio_web}
            target="_blank"
            rel="noopener noreferrer"
          >
            Sitio web
          </a>
        ) : null}
        <button
          type="button"
          className="adm-cta-ghost"
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
        </button>
      </div>

      <section className="adm-notas" aria-label="Notas del negocio">
        <h3 className="adm-notas-titulo">Notas</h3>
        <form
          className="adm-notas-form"
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
          <textarea
            className="adm-textarea"
            value={notaNueva}
            onChange={(e) => setNotaNueva(e.target.value)}
            placeholder="Qué pasó con este negocio…"
            rows={2}
            maxLength={4000}
          />
          <button
            className="adm-cta-ghost"
            type="submit"
            disabled={guardando || !notaNueva.trim()}
          >
            Anotar
          </button>
        </form>

        {notas === null ? (
          <p className="adm-notas-cargando">Cargando notas…</p>
        ) : notas.length === 0 ? (
          <p className="adm-notas-vacias">
            Todavía no hay notas. La primera se escribe sola al cambiar el
            estado.
          </p>
        ) : (
          <ul className="adm-notas-lista">
            {notas.map((n) => (
              <li
                key={n.id}
                className={n.automatica ? "adm-nota adm-nota--auto" : "adm-nota"}
              >
                <span className="adm-nota-fecha">
                  {new Date(n.created_at).toLocaleDateString("es-CO", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="adm-nota-texto">{n.texto}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
