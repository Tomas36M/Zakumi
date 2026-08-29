"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { fechaCorta } from "@/lib/admin/formato";
import {
  edicionesRestantes,
  estadoLocal,
  verticalDeFila,
  type PlantillaZakFila,
} from "@/lib/admin/plantillas";
import {
  adoptarTextoDeMeta,
  enviarARevisionPlantilla,
  guardarBorradorPlantilla,
  refrescarEstadosPlantillas,
  subirFolletoBorrador,
} from "@/lib/admin/plantillas-actions";
import { srcFolleto } from "@/lib/admin/zak";
import type { EstadoMeta } from "@/lib/bots/tipos";
import { Badge, type TonoBadge } from "@/components/admin/ui/Badge";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Field, TextArea } from "@/components/admin/ui/Field";
import { Island } from "@/components/admin/ui/Island";

const TONO_ESTADO: Record<EstadoMeta, TonoBadge> = {
  APPROVED: "vivo",
  PENDING: "contactado",
  REJECTED: "peligro",
  PAUSED: "descartado",
  DISABLED: "peligro",
  DESCONOCIDO: "neutro",
};

const LABEL_ESTADO: Record<EstadoMeta, string> = {
  APPROVED: "Aprobada",
  PENDING: "En revisión",
  REJECTED: "Rechazada",
  PAUSED: "Pausada por Meta",
  DISABLED: "Deshabilitada",
  DESCONOCIDO: "Sin verificar",
};

type Props = { filas: PlantillaZakFila[] };

/**
 * El gestor de plantillas de Meta: ver el estado real de cada saludo, editar
 * texto y folleto, y mandarlo a aprobación — sin Business Manager ni deploys.
 * El envío usa SIEMPRE la versión aprobada: el borrador solo pasa a vigente
 * cuando Meta aprueba (promoción en el refresco de estados).
 */
export function PlantillasZak({ filas: filasIniciales }: Props) {
  const [filas, setFilas] = useState(filasIniciales);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorAviso, setErrorAviso] = useState<string | null>(null);
  const [desincronizadas, setDesincronizadas] = useState<string[]>([]);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [textoEdit, setTextoEdit] = useState("");
  const [operando, startOperar] = useTransition();
  const refrescoHecho = useRef(false);
  // "Ahora" congelado al montar: los límites 1/24h y 10/30d no necesitan más
  // resolución, y Date.now() en render viola la pureza (regla del repo).
  const [ahoraMs] = useState(() => Date.now());

  async function recargarFilas() {
    const res = await fetch("/admin/api/zak/plantillas");
    if (!res.ok) return;
    const data = (await res.json()) as { filas: PlantillaZakFila[] };
    setFilas(data.filas);
  }

  function refrescar(silencioso: boolean) {
    startOperar(async () => {
      const r = await refrescarEstadosPlantillas();
      if ("error" in r) {
        if (!silencioso) setErrorAviso(r.error);
        return;
      }
      await recargarFilas();
      setDesincronizadas(r.desincronizadas);
      const partes = [
        r.promovidas.length > 0 &&
          `${r.promovidas.length} aprobada(s) — el borrador ya es la versión que se envía`,
        r.rechazadas.length > 0 && `${r.rechazadas.length} rechazada(s) — mira el motivo`,
        r.desincronizadas.length > 0 &&
          `${r.desincronizadas.length} editada(s) por fuera del panel`,
      ].filter(Boolean);
      setAviso(
        partes.length > 0 ? `Estados al día: ${partes.join(" · ")}.` : "Estados al día con Meta.",
      );
    });
  }

  // Refresco automático UNA vez por visita (patrón del sync del CRM en
  // ZakView): los setState viven tras los await del callback async.
  useEffect(() => {
    if (refrescoHecho.current || filasIniciales.length === 0) return;
    refrescoHecho.current = true;
    refrescar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (filasIniciales.length === 0) {
    return (
      <EmptyState
        titulo="El catálogo editable aún no está encendido."
        detalle="Corre supabase/plantillas.sql en el SQL Editor de Supabase; mientras tanto los saludos usan el catálogo del código."
      />
    );
  }

  function guardarBorrador(slug: string) {
    setErrorAviso(null);
    startOperar(async () => {
      const r = await guardarBorradorPlantilla(slug, textoEdit);
      if ("error" in r) {
        setErrorAviso(r.error);
        return;
      }
      await recargarFilas();
      setAviso("Borrador guardado — cuando esté listo, envíalo a aprobación.");
    });
  }

  function subirFolleto(slug: string, archivo: File) {
    setErrorAviso(null);
    const fd = new FormData();
    fd.set("folleto", archivo);
    startOperar(async () => {
      const r = await subirFolletoBorrador(slug, fd);
      if ("error" in r) {
        setErrorAviso(r.error);
        return;
      }
      await recargarFilas();
      setAviso("Folleto subido como borrador.");
    });
  }

  function enviarAMeta(slug: string) {
    setErrorAviso(null);
    startOperar(async () => {
      const r = await enviarARevisionPlantilla(slug);
      if ("error" in r) {
        setErrorAviso(r.error);
        return;
      }
      await recargarFilas();
      setAviso(
        "Enviada a revisión de Meta (24–48h). El saludo sigue usando la versión aprobada; " +
          "evita abrir chats con este vertical hasta que apruebe.",
      );
    });
  }

  function adoptar(slug: string) {
    setErrorAviso(null);
    startOperar(async () => {
      const r = await adoptarTextoDeMeta(slug);
      if ("error" in r) {
        setErrorAviso(r.error);
        return;
      }
      await recargarFilas();
      setDesincronizadas((prev) => prev.filter((s) => s !== slug));
      setAviso("Espejo actualizado con el texto de Meta.");
    });
  }

  return (
    // Cockpit: la pestaña ocupa el alto de la pantalla y la lista scrollea
    // por dentro — el intro, el botón de refrescar y los avisos quedan fijos.
    <div className="flex flex-col gap-4 min-[900px]:h-[calc(100dvh-13.5rem)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-tinta-60">
          Lo que Zak envía es siempre la <strong className="text-tinta">versión aprobada</strong>.
          Edita texto o folleto, envíalo a Meta, y cuando apruebe el borrador pasa a ser
          la versión vigente solo.
        </p>
        <Button disabled={operando} onClick={() => refrescar(false)}>
          {operando ? "Hablando con Meta…" : "Refrescar estados de Meta"}
        </Button>
      </div>

      {aviso && <Banner>{aviso}</Banner>}
      {errorAviso && <Banner variante="error">{errorAviso}</Banner>}

      <div className="barra-fina flex flex-col gap-4 min-[900px]:min-h-0 min-[900px]:flex-1 min-[900px]:overflow-y-auto min-[900px]:pr-1">
      {filas.map((f) => {
        const vertical = verticalDeFila(f);
        const local = estadoLocal(f);
        const limites = edicionesRestantes(f.envios_revision, ahoraMs);
        const editando = abierta === f.slug;
        return (
          <Island
            key={f.slug}
            className="bg-isla-alta"
            titulo={
              <span className="flex flex-wrap items-center gap-2">
                {f.label}
                <span className="font-normal text-tinta-40">{f.plantilla}</span>
                <Badge tono={TONO_ESTADO[f.estado_meta]}>{LABEL_ESTADO[f.estado_meta]}</Badge>
                {local === "borrador" && <Badge tono="neutro">borrador sin enviar</Badge>}
              </span>
            }
            acciones={
              <Button
                disabled={operando}
                onClick={() => {
                  setAbierta(editando ? null : f.slug);
                  setTextoEdit(f.texto_borrador ?? f.texto_vigente);
                }}
              >
                {editando ? "Cerrar" : "Editar"}
              </Button>
            }
          >
            <div className="flex flex-col gap-3">
              {f.estado_meta === "REJECTED" && f.motivo_rechazo && (
                <Banner variante="error">
                  Meta la rechazó: {f.motivo_rechazo}. Corrige el borrador y reenvíala.
                </Banner>
              )}
              {desincronizadas.includes(f.slug) && (
                <Banner>
                  El texto en Meta no coincide con el espejo — alguien la editó en
                  Business Manager.{" "}
                  <button
                    type="button"
                    className="font-medium text-acento underline-offset-2 hover:underline"
                    onClick={() => adoptar(f.slug)}
                  >
                    Adoptar el texto de Meta
                  </button>
                </Banner>
              )}

              <div className="grid gap-aire min-[900px]:grid-cols-2">
                <div className="flex items-start gap-3 rounded-fila bg-isla p-3">
                  <Image
                    src={srcFolleto(vertical)}
                    alt={`Folleto vigente de ${f.label}`}
                    width={56}
                    height={70}
                    className="h-[70px] w-14 shrink-0 rounded-fila object-cover object-top"
                  />
                  <div className="min-w-0">
                    <p className="mb-1 text-xs font-medium text-tinta-40">
                      Vigente (lo que se envía)
                    </p>
                    <p className="text-xs leading-relaxed text-tinta-60">{f.texto_vigente}</p>
                  </div>
                </div>
                {(f.texto_borrador || f.folleto_url_borrador) && (
                  <div className="flex items-start gap-3 rounded-fila bg-acento-10 p-3">
                    {f.folleto_url_borrador && (
                      <Image
                        src={f.folleto_url_borrador}
                        alt={`Folleto borrador de ${f.label}`}
                        width={56}
                        height={70}
                        className="h-[70px] w-14 shrink-0 rounded-fila object-cover object-top"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="mb-1 text-xs font-medium text-acento">
                        Borrador {local === "en_revision" ? "(en revisión en Meta)" : ""}
                      </p>
                      <p className="text-xs leading-relaxed text-tinta-60">
                        {f.texto_borrador ?? f.texto_vigente}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {editando && (
                <div className="flex flex-col gap-3 rounded-fila border border-hairline p-4">
                  <Field label={`Texto del saludo (${textoEdit.trim().length}/1024)`}>
                    <TextArea
                      value={textoEdit}
                      onChange={(e) => setTextoEdit(e.target.value)}
                      disabled={operando}
                      rows={4}
                    />
                  </Field>
                  <Field label="Folleto nuevo (PNG/JPG, máx. 5 MB — reemplaza al enviar a Meta)">
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="text-sm text-tinta-60 file:mr-3 file:rounded-full file:border-0 file:bg-isla file:px-4 file:py-2 file:text-sm file:text-tinta"
                      disabled={operando}
                      onChange={(e) => {
                        const archivo = e.target.files?.[0];
                        if (archivo) subirFolleto(f.slug, archivo);
                      }}
                    />
                  </Field>
                  <p className="text-xs text-tinta-40">
                    Ediciones usadas este mes: {limites.usadasMes} de 10
                    {limites.puedeEnviar ? "" : ` — ${limites.motivo}`}
                    {" · "}último refresco: {fechaCorta(f.estados_refrescados_en) || "nunca"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={operando} onClick={() => guardarBorrador(f.slug)}>
                      Guardar borrador
                    </Button>
                    <Button
                      variante="primaria"
                      disabled={operando || !limites.puedeEnviar || local === "en_revision"}
                      onClick={() => enviarAMeta(f.slug)}
                    >
                      {operando ? "…" : "Enviar a aprobación de Meta"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Island>
        );
      })}
      </div>
    </div>
  );
}
