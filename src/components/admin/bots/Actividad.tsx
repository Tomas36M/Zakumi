"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { borrarLead, editarLead, vincularLead } from "@/lib/admin/leads-actions";
import { reintentarJob } from "@/lib/admin/bots-actions";
import { fechaCorta } from "@/lib/admin/formato";
import { labelEstado } from "@/lib/admin/negocios";
import type { LeadConOverride } from "@/lib/admin/leads-overrides";
import { type FichaNegocio } from "@/lib/admin/zak";
import { esLabs, type JobFallido, type StatusInstancia } from "@/lib/bots/tipos";
import { Badge } from "@/components/admin/ui/Badge";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { IconButton } from "@/components/admin/ui/IconButton";
import { Island } from "@/components/admin/ui/Island";
import { Input } from "@/components/admin/ui/Field";
import { ListRow } from "@/components/admin/ui/ListRow";
import { Skeleton } from "@/components/admin/ui/Skeleton";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import { Trash2, X } from "lucide-react";

type Props = { instanciaId: number };

type Datos = {
  status: StatusInstancia;
  jobs: JobFallido[];
  leads: LeadConOverride[];
};

const ERROR_CARGA = "No se pudo cargar la actividad. ¿Railway está arriba?";

function resumenLead(datos: Record<string, unknown>): string {
  const partes = Object.entries(datos)
    .filter(([, v]) => typeof v === "string" || typeof v === "number")
    .map(([k, v]) => `${k}: ${v}`);
  return partes.join(" · ") || "(sin datos)";
}

/** Uso de hoy (tokens reales), jobs fallidos con reintento y leads del bot. */
export function Actividad({ instanciaId }: Props) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avisoJob, setAvisoJob] = useState<string | null>(null);
  const [operando, startOperar] = useTransition();
  const { confirmar, dialogo } = useConfirmar();
  const [editando, setEditando] = useState<string | null>(null);
  const [textoEdit, setTextoEdit] = useState("");
  const [errorEdit, setErrorEdit] = useState<string | null>(null);
  const [avisoLead, setAvisoLead] = useState<string | null>(null);
  const [vinculando, setVinculando] = useState<string | null>(null);
  const [busquedaNegocio, setBusquedaNegocio] = useState("");
  // La última búsqueda completada, atada a SU término: si el término actual
  // es otro, esa respuesta no se muestra (y «buscando» se deriva de ahí) —
  // mismo patrón que NuevoChatZak.tsx.
  const [busqueda, setBusqueda] = useState<
    { q: string; fichas: FichaNegocio[]; fallo: boolean } | null
  >(null);
  const busquedaId = useRef(0);

  // El fetch no toca estado: así el efecto de montaje puede llamarlo y aplicar
  // el resultado en su propia continuación (con guarda de desmontaje), y
  // `cargar` reutiliza lo mismo tras reintentar un job.
  const pedirDatos = useCallback(async (): Promise<Datos> => {
    const res = await fetch(`/admin/api/bots/${instanciaId}/actividad`);
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as Datos;
  }, [instanciaId]);

  const cargar = useCallback(async () => {
    try {
      setDatos(await pedirDatos());
      setError(null);
    } catch {
      setError(ERROR_CARGA);
    }
  }, [pedirDatos]);

  useEffect(() => {
    let activo = true;
    void (async () => {
      try {
        const nuevos = await pedirDatos();
        if (!activo) return;
        setDatos(nuevos);
        setError(null);
      } catch {
        if (activo) setError(ERROR_CARGA);
      }
    })();
    return () => {
      activo = false;
    };
  }, [pedirDatos]);

  const q = busquedaNegocio.trim();
  const busquedaActiva = vinculando !== null && q.length >= 2;
  const resultadosNegocio = busquedaActiva && busqueda?.q === q ? busqueda.fichas : null;
  const falloBusqueda = busquedaActiva && busqueda?.q === q && busqueda.fallo;
  const buscandoNegocio = busquedaActiva && busqueda?.q !== q;

  // Búsqueda con debounce; el contador descarta respuestas viejas que
  // llegan tarde (el CRM es chico, pero la red no promete orden) — mismo
  // patrón que NuevoChatZak.tsx.
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

  function reintentar(jobId: number) {
    setAvisoJob(null);
    startOperar(async () => {
      const res = await reintentarJob(jobId);
      if (res.error) {
        setAvisoJob(res.error);
        return;
      }
      await cargar();
    });
  }

  function abrirEdicion(l: LeadConOverride) {
    setEditando(l.phone);
    setErrorEdit(null);
    setTextoEdit(JSON.stringify(l.datos, null, 2));
  }

  function guardarEdicion(phone: string) {
    let datos: Record<string, unknown>;
    try {
      datos = JSON.parse(textoEdit) as Record<string, unknown>;
    } catch {
      setErrorEdit("Eso no es JSON válido.");
      return;
    }
    setErrorEdit(null);
    startOperar(async () => {
      const res = await editarLead(instanciaId, phone, datos);
      if (res.error) {
        setErrorEdit(res.error);
        return;
      }
      setEditando(null);
      await cargar();
    });
  }

  async function borrar(phone: string) {
    const ok = await confirmar({
      titulo: "¿Borrar este lead?",
      mensaje: "Se oculta de esta lista — no toca nada en el bot.",
      accion: "Borrar",
      peligro: true,
    });
    if (!ok) return;
    setAvisoLead(null);
    startOperar(async () => {
      const res = await borrarLead(instanciaId, phone);
      if (res.error) {
        setAvisoLead(res.error);
        return;
      }
      await cargar();
    });
  }

  function abrirVinculo(phone: string) {
    setVinculando(phone);
    setBusquedaNegocio("");
    setBusqueda(null);
  }

  function vincular(phone: string, negocioId: string | null) {
    setAvisoLead(null);
    startOperar(async () => {
      const res = await vincularLead(instanciaId, phone, negocioId);
      if (res.error) {
        setAvisoLead(res.error);
        return;
      }
      setVinculando(null);
      await cargar();
    });
  }

  if (error) return <Banner>{error}</Banner>;
  if (!datos) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    );
  }

  const uso = datos.status.uso_hoy;

  const cifras = [
    { valor: String(uso.llamadas), label: "llamadas a Claude hoy" },
    {
      valor: (uso.tokens_entrada + uso.tokens_salida).toLocaleString("es-CO"),
      label: "tokens hoy (entrada + salida)",
    },
    { valor: String(datos.status.conversaciones), label: "conversaciones totales" },
    { valor: String(datos.status.pausados), label: "chats pausados" },
  ];

  return (
    <>
      {dialogo}
      <div className="flex flex-col gap-aire">
      <div className="grid grid-cols-2 gap-aire md:grid-cols-4">
        {cifras.map((c) => (
          <div key={c.label} className="rounded-fila bg-isla-alta px-4 py-3">
            <span className="block text-2xl font-semibold text-tinta">{c.valor}</span>
            <span className="text-xs text-tinta-60">{c.label}</span>
          </div>
        ))}
      </div>

      <Island className="bg-isla-alta/50" titulo="Jobs fallidos">
        {avisoJob && (
          <Banner variante="error" className="mb-2">
            {avisoJob}
          </Banner>
        )}
        {datos.jobs.length === 0 ? (
          <p className="text-sm text-tinta-40">Ninguno. Todo respondido. ✓</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {datos.jobs.map((j) => (
              <li key={j.id}>
                <ListRow
                  interactiva={false}
                  className="flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-tinta">
                      <strong>{j.telefono}</strong>
                      <span className="text-xs text-tinta-40"> · {fechaCorta(j.creado_en)}</span>
                    </p>
                    <p className="text-sm text-tinta-60">
                      “{j.texto.slice(0, 120)}” — {j.error ?? "sin detalle"} (
                      {j.intentos} intentos)
                    </p>
                  </div>
                  <Button disabled={operando} onClick={() => reintentar(j.id)}>
                    Reintentar
                  </Button>
                </ListRow>
              </li>
            ))}
          </ul>
        )}
      </Island>

      <Island className="bg-isla-alta/50" titulo="Leads capturados">
        {avisoLead && (
          <Banner variante="error" className="mb-2">
            {avisoLead}
          </Banner>
        )}
        {datos.leads.length === 0 ? (
          <p className="text-sm text-tinta-40">Todavía no hay leads.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {datos.leads.map((l, i) => (
              <li key={`${l.phone}-${i}`}>
                <ListRow interactiva={false} className="flex-col items-stretch gap-2 text-sm text-tinta">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <strong>{l.phone}</strong>
                    {esLabs(l.phone) && <Badge tono="neutro">Prueba</Badge>}
                    {l.negocioId && <Badge tono="neutro">vinculado a un negocio</Badge>}
                    <span className="text-tinta-60"> — {resumenLead(l.datos)}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <Button disabled={operando} onClick={() => abrirEdicion(l)}>
                        Editar
                      </Button>
                      <Button disabled={operando} onClick={() => abrirVinculo(l.phone)}>
                        {l.negocioId ? "Cambiar negocio" : "Vincular a negocio"}
                      </Button>
                      <IconButton
                        etiqueta="Borrar lead"
                        disabled={operando}
                        onClick={() => void borrar(l.phone)}
                        className="hover:bg-peligro/10 hover:text-peligro"
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>

                  {editando === l.phone && (
                    <div className="flex flex-col gap-2 rounded-fila border border-hairline p-3">
                      {errorEdit && <Banner variante="error">{errorEdit}</Banner>}
                      <textarea
                        className="min-h-32 rounded-fila border border-hairline bg-isla p-2 font-mono text-xs text-tinta"
                        value={textoEdit}
                        onChange={(e) => setTextoEdit(e.target.value)}
                        disabled={operando}
                      />
                      <div className="flex gap-2">
                        <Button
                          variante="primaria"
                          disabled={operando}
                          onClick={() => guardarEdicion(l.phone)}
                        >
                          Guardar
                        </Button>
                        <Button disabled={operando} onClick={() => setEditando(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}

                  {vinculando === l.phone && (
                    <div className="flex flex-col gap-2 rounded-fila border border-hairline p-3">
                      <div className="flex items-center gap-2">
                        <Input
                          className="flex-1"
                          placeholder="Buscar negocio por nombre…"
                          value={busquedaNegocio}
                          onChange={(e) => setBusquedaNegocio(e.target.value)}
                          disabled={operando}
                          autoFocus
                        />
                        {l.negocioId && (
                          <Button disabled={operando} onClick={() => vincular(l.phone, null)}>
                            Quitar vínculo
                          </Button>
                        )}
                        <IconButton etiqueta="Cancelar" onClick={() => setVinculando(null)}>
                          <X className="h-4 w-4" />
                        </IconButton>
                      </div>
                      {(buscandoNegocio || resultadosNegocio !== null) && (
                        <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                          {buscandoNegocio && (
                            <li className="px-3 py-2 text-xs text-tinta-40">
                              Buscando en el CRM…
                            </li>
                          )}
                          {!buscandoNegocio && resultadosNegocio?.length === 0 && (
                            <li className="px-3 py-2 text-xs text-tinta-40">
                              {falloBusqueda
                                ? "La búsqueda en el CRM falló — reintenta."
                                : "No se encontró ningún negocio con ese nombre."}
                            </li>
                          )}
                          {!buscandoNegocio &&
                            (resultadosNegocio ?? []).map((f) => (
                              <li key={f.negocioId}>
                                <button
                                  type="button"
                                  className="flex w-full flex-col gap-0.5 rounded-fila px-3 py-2 text-left text-sm hover:bg-isla"
                                  onClick={() => vincular(l.phone, f.negocioId)}
                                  disabled={operando}
                                >
                                  <span className="flex items-center gap-1.5 font-medium text-tinta">
                                    {f.nombre}
                                    <Badge tono="neutro">{f.verticalLabel}</Badge>
                                    <Badge tono={f.estado}>{labelEstado(f.estado)}</Badge>
                                  </span>
                                  <span className="text-xs text-tinta-40">{f.telefono}</span>
                                </button>
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>
                  )}
                </ListRow>
              </li>
            ))}
          </ul>
        )}
      </Island>
      </div>
    </>
  );
}
