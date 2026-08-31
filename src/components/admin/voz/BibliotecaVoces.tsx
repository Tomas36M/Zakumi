"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { agregarVozEspanol, buscarVocesEspanol } from "@/lib/admin/voz-actions";
import { LOCALES_BIBLIOTECA, type VozCompartida } from "@/lib/voz/api";
import { cn } from "@/lib/cn";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { IconButton } from "@/components/admin/ui/IconButton";
import { Input } from "@/components/admin/ui/Field";
import { Island } from "@/components/admin/ui/Island";
import { ListRow } from "@/components/admin/ui/ListRow";

/**
 * Biblioteca pública de ElevenLabs filtrada a español: el workspace nace con
 * puras voces en inglés y las llamadas del negocio son en es-CO. Agregar una
 * voz aquí la deja disponible en el selector de todos los agentes.
 */
export function BibliotecaVoces({ onCerrar }: { onCerrar: () => void }) {
  const router = useRouter();
  const [buscando, startBuscar] = useTransition();
  const [agregando, startAgregar] = useTransition();
  const [locale, setLocale] = useState("es-CO");
  const [busqueda, setBusqueda] = useState("");
  const [voces, setVoces] = useState<VozCompartida[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agregadas, setAgregadas] = useState<Set<string>>(new Set());
  const [agregandoId, setAgregandoId] = useState<string | null>(null);
  // Secuencia de búsquedas: una respuesta vieja y lenta no pisa a la nueva.
  const busquedaSeq = useRef(0);

  const buscar = useCallback((loc: string, q: string) => {
    const id = ++busquedaSeq.current;
    startBuscar(async () => {
      setError(null);
      try {
        const r = await buscarVocesEspanol(loc, q);
        if (busquedaSeq.current !== id) return; // llegó tarde: ya hay otra búsqueda
        if ("error" in r) setError(r.error);
        else setVoces(r.voces);
      } catch {
        if (busquedaSeq.current === id) {
          setError("Se perdió la conexión — intenta la búsqueda otra vez.");
        }
      }
    });
  }, []);

  // Primera carga: voces colombianas sin búsqueda.
  useEffect(() => {
    buscar("es-CO", "");
  }, [buscar]);

  function agregar(v: VozCompartida) {
    setError(null);
    setAgregandoId(v.voice_id);
    startAgregar(async () => {
      try {
        const r = await agregarVozEspanol(v.public_owner_id, v.voice_id, v.nombre);
        if (r.error) {
          setError(r.error);
          return;
        }
        setAgregadas((prev) => new Set(prev).add(v.voice_id));
        router.refresh(); // la voz nueva aparece en los selectores
      } catch {
        setError("Se perdió la conexión — la voz pudo no agregarse; reintenta.");
      } finally {
        setAgregandoId(null);
      }
    });
  }

  return (
    <Island
      titulo="Voces en español"
      acciones={
        <IconButton etiqueta="Cerrar" onClick={onCerrar}>
          <X className="h-4 w-4" />
        </IconButton>
      }
      className="flex flex-col gap-3 bg-isla-alta/50"
    >
      <p className="text-xs text-tinta-60">
        Biblioteca pública de ElevenLabs filtrada a español. “Agregar” la deja en
        el workspace y aparece en el selector de voz de todos los agentes.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {LOCALES_BIBLIOTECA.map((l) => (
          <button
            key={l.valor}
            type="button"
            onClick={() => {
              setLocale(l.valor);
              buscar(l.valor, busqueda);
            }}
            className={cn(
              "h-8 rounded-full px-3.5 text-sm transition-colors",
              locale === l.valor
                ? "bg-acento text-white"
                : "bg-isla-alta text-tinta-60 hover:bg-acento-10 hover:text-tinta",
            )}
          >
            {l.label}
          </button>
        ))}
      </div>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          buscar(locale, busqueda);
        }}
      >
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o estilo (ej. warm, sales)…"
          maxLength={80}
          className="max-w-sm"
        />
        <Button type="submit" disabled={buscando}>
          {buscando ? "Buscando…" : "Buscar"}
        </Button>
      </form>

      {error && <Banner variante="error">{error}</Banner>}

      {voces !== null && voces.length === 0 && !buscando && (
        <EmptyState titulo="Nada con ese filtro." detalle="Prueba otro acento o borra la búsqueda." />
      )}

      <div className="flex flex-col gap-1">
        {(voces ?? []).map((v) => (
          <ListRow key={v.voice_id} interactiva={false} className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-tinta">{v.nombre}</p>
              <p className="text-xs text-tinta-40">
                {[v.locale, v.etiquetas].filter(Boolean).join(" · ")}
              </p>
            </div>
            {v.preview_url && (
              <audio className="h-9 w-56 max-w-full" controls preload="none" src={v.preview_url} />
            )}
            {agregadas.has(v.voice_id) ? (
              <span className="text-xs font-medium text-vivo">✓ En el workspace</span>
            ) : (
              <Button
                disabled={agregando}
                onClick={() => agregar(v)}
              >
                {agregandoId === v.voice_id ? "Agregando…" : "Agregar"}
              </Button>
            )}
          </ListRow>
        ))}
      </div>
    </Island>
  );
}
