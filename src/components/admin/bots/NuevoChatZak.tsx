"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { labelEstado } from "@/lib/admin/negocios";
import { sinMas } from "@/lib/admin/telefono";
import { abrirChatZak } from "@/lib/admin/zak-actions";
import { pareceTelefono, type FichaNegocio } from "@/lib/admin/zak";
import { Badge } from "@/components/admin/ui/Badge";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Input } from "@/components/admin/ui/Field";
import { IconButton } from "@/components/admin/ui/IconButton";
import { SelectorPlantilla } from "./SelectorPlantilla";

type Props = {
  /** El saludo salió: la conversación ya existe en la bandeja. */
  onAbierto: () => void;
  onCancelar: () => void;
};

/**
 * «+ Nuevo chat» de Zak: un solo campo que busca negocios del CRM por nombre
 * (elegir uno autollenan teléfono y plantilla) o acepta un número suelto.
 * Debajo, el selector de plantilla con vista previa de lo que va a salir.
 */
export function NuevoChatZak({ onAbierto, onCancelar }: Props) {
  const [consulta, setConsulta] = useState("");
  // La última búsqueda completada, atada a SU término: si el término actual
  // es otro, esa respuesta no se muestra (y «buscando» se deriva de ahí).
  const [busqueda, setBusqueda] = useState<
    { q: string; fichas: FichaNegocio[]; fallo: boolean } | null
  >(null);
  const [elegido, setElegido] = useState<FichaNegocio | null>(null);
  const [slug, setSlug] = useState("generico");
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, startEnviar] = useTransition();
  const busquedaId = useRef(0);

  const q = consulta.trim();
  const busquedaActiva = !elegido && q.length >= 2 && !pareceTelefono(q);
  const resultados = busquedaActiva && busqueda?.q === q ? busqueda.fichas : null;
  const falloBusqueda = busquedaActiva && busqueda?.q === q && busqueda.fallo;
  const buscando = busquedaActiva && busqueda?.q !== q;

  // Búsqueda con debounce; el contador descarta respuestas viejas que
  // llegan tarde (el CRM es chico, pero la red no promete orden).
  useEffect(() => {
    if (!busquedaActiva) return;
    const id = ++busquedaId.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/admin/api/zak/negocios?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { fichas: FichaNegocio[] };
        if (id !== busquedaId.current) return;
        setBusqueda({ q, fichas: data.fichas, fallo: false });
      } catch {
        if (id !== busquedaId.current) return;
        setBusqueda({ q, fichas: [], fallo: true });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q, busquedaActiva]);

  function elegir(f: FichaNegocio) {
    setElegido(f);
    setConsulta(f.nombre);
    setSlug(f.verticalSlug);
  }

  const telefono = elegido ? sinMas(elegido.telefono) : q;
  const puedeEnviar = elegido !== null || pareceTelefono(consulta);

  function saludar() {
    if (!puedeEnviar || !telefono) return;
    setAviso(null);
    startEnviar(async () => {
      const res = await abrirChatZak(telefono, slug);
      if ("error" in res) {
        setAviso(res.error);
        return;
      }
      onAbierto();
    });
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-fila border border-hairline p-3"
      onSubmit={(e) => {
        e.preventDefault();
        saludar();
      }}
    >
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            className="w-full"
            value={consulta}
            onChange={(e) => {
              setConsulta(e.target.value);
              setElegido(null);
            }}
            placeholder="Nombre del negocio en el CRM, o un número (310 123 4567 · +56 9…)"
            autoFocus
            disabled={enviando}
          />
          {(buscando || resultados !== null) && (
            <ul className="absolute inset-x-0 top-full z-10 mt-1 flex max-h-64 flex-col overflow-y-auto rounded-fila border border-hairline bg-isla-alta shadow-lg">
              {buscando && (
                <li className="px-3 py-2 text-xs text-tinta-40">Buscando en el CRM…</li>
              )}
              {!buscando && resultados?.length === 0 && (
                <li className="px-3 py-2 text-xs text-tinta-40">
                  {falloBusqueda
                    ? "La búsqueda en el CRM falló — reintenta o pega el número directo."
                    : "Nada en el CRM con ese nombre — pega el número directo."}
                </li>
              )}
              {!buscando &&
                (resultados ?? []).map((f) => (
                  <li key={f.negocioId}>
                    <button
                      type="button"
                      className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-isla"
                      onClick={() => elegir(f)}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-medium text-tinta">
                        {f.nombre}
                        <Badge tono="neutro">{f.verticalLabel}</Badge>
                        <Badge tono={f.estado}>{labelEstado(f.estado)}</Badge>
                      </span>
                      <span className="text-xs text-tinta-40">
                        {f.categoria ?? "sin categoría"} · {f.telefono}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
        <IconButton etiqueta="Cancelar" onClick={onCancelar}>
          <X className="h-4 w-4" />
        </IconButton>
      </div>

      <SelectorPlantilla valor={slug} onCambiar={setSlug} disabled={enviando} />

      {aviso && <Banner variante="error">{aviso}</Banner>}

      <Button
        variante="primaria"
        type="submit"
        className="self-start"
        disabled={enviando || !puedeEnviar}
      >
        {enviando ? "Enviando…" : "Saludar"}
      </Button>
    </form>
  );
}
