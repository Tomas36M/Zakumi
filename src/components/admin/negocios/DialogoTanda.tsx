"use client";

import { useEffect, useMemo, useState } from "react";
import type { Negocio } from "@/lib/admin/negocios";
import { verticalDeFila, type PlantillaZakFila } from "@/lib/admin/plantillas";
import {
  gruposParaEnvio,
  MODO_POR_DEFECTO,
  previsualizarEnvio,
  type CatalogoEnvio,
  type ModoPlantilla,
} from "@/lib/admin/envio";
import { TANDA_MAX_BOT, VERTICAL_GENERICO, VERTICALES_PROSPECCION } from "@/lib/admin/zak";
import { cn } from "@/lib/cn";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Select } from "@/components/admin/ui/Field";
import { Modal } from "@/components/admin/ui/Modal";

/** Lo que hay que mandar: los negocios ya pasados por `contactables` y una
 * nota opcional (quiénes quedan fuera, o por qué no van todos hoy). */
export type EnvioPendiente = { elegibles: Negocio[]; nota?: string };

type Props = {
  /** null = cerrado. */
  pendiente: EnvioPendiente | null;
  onCancelar: () => void;
  onConfirmar: (modo: ModoPlantilla) => void;
};

// Mientras llega el estado vivo de las plantillas (o si no llega), el catálogo
// guardado en el código. El servidor lo vuelve a revisar al enviar.
const ESTATICO: CatalogoEnvio = { verticales: VERTICALES_PROSPECCION, generico: VERTICAL_GENERICO };

/** El diálogo de «Que Zak los contacte»: elegir la plantilla, ver cuántos
 * salen y confirmar. */
export function DialogoTanda({ pendiente, onCancelar, onConfirmar }: Props) {
  // Montado solo mientras está abierto: cada envío arranca con el modo por
  // defecto y vuelve a leer el estado de las plantillas.
  if (!pendiente) return null;
  return <Contenido pendiente={pendiente} onCancelar={onCancelar} onConfirmar={onConfirmar} />;
}

function Contenido({
  pendiente,
  onCancelar,
  onConfirmar,
}: Omit<Props, "pendiente"> & { pendiente: EnvioPendiente }) {
  const [tipo, setTipo] = useState<ModoPlantilla["tipo"]>(MODO_POR_DEFECTO.tipo);
  const [slug, setSlug] = useState(MODO_POR_DEFECTO.tipo === "una" ? MODO_POR_DEFECTO.slug : "generico");
  const [catalogo, setCatalogo] = useState<CatalogoEnvio>(ESTATICO);
  const [cargando, setCargando] = useState(true);
  const [sinEstado, setSinEstado] = useState(false);

  useEffect(() => {
    let activo = true;
    void (async () => {
      try {
        const res = await fetch("/admin/api/zak/plantillas");
        if (!res.ok) throw new Error(String(res.status));
        const { filas } = (await res.json()) as { filas?: PlantillaZakFila[] };
        if (!activo || !filas || filas.length === 0) return;
        const todos = filas.map(verticalDeFila);
        setCatalogo({
          verticales: todos.filter((v) => v.slug !== "generico"),
          generico: todos.find((v) => v.slug === "generico") ?? VERTICAL_GENERICO,
        });
      } catch {
        if (activo) setSinEstado(true);
      } finally {
        if (activo) setCargando(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, []);

  const opciones = useMemo(() => [catalogo.generico, ...catalogo.verticales], [catalogo]);
  const vista = useMemo(() => {
    const modo: ModoPlantilla = tipo === "una" ? { tipo: "una", slug } : { tipo: "nicho" };
    return previsualizarEnvio(gruposParaEnvio(pendiente.elegibles, modo, catalogo));
  }, [pendiente.elegibles, tipo, slug, catalogo]);

  const etiquetaUna = opciones.find((v) => v.slug === slug)?.label ?? VERTICAL_GENERICO.label;
  const bloqueadaUna = tipo === "una" && vista.bloqueados > 0;
  const puedeEnviar = !cargando && vista.total > 0 && !bloqueadaUna;
  const desglose =
    tipo === "una"
      ? `${vista.total} con la plantilla «${etiquetaUna}».`
      : vista.tandas
          .filter((t) => !t.enRevision)
          .map((t) => `${t.cantidad} ${t.label}`)
          .join(" · ") + ".";

  return (
    <Modal
      abierto
      onCerrar={(abierto) => {
        if (!abierto) onCancelar();
      }}
      titulo={`Zak abrirá conversación con ${vista.total} ${vista.total === 1 ? "negocio" : "negocios"}`}
    >
      <div className="flex flex-col gap-4 text-sm">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs font-medium text-tinta-60">¿Con qué plantilla?</legend>
          <Opcion activa={tipo === "una"} onElegir={() => setTipo("una")} titulo="Una sola plantilla para todos">
            <Select
              className="mt-2"
              value={slug}
              aria-label="Plantilla para todos"
              onChange={(e) => {
                setSlug(e.target.value);
                setTipo("una");
              }}
            >
              {opciones.map((v) => (
                <option key={v.slug} value={v.slug}>
                  {v.label}
                  {v.enRevision ? " (en revisión)" : ""}
                </option>
              ))}
            </Select>
          </Opcion>
          <Opcion
            activa={tipo === "nicho"}
            onElegir={() => setTipo("nicho")}
            titulo="Según el tipo de negocio"
            detalle="Cada uno con la plantilla y el folleto de su nicho."
          />
        </fieldset>

        {bloqueadaUna ? (
          <Banner variante="error">
            La plantilla «{etiquetaUna}» está en revisión. En Zak → Plantillas dale «Refrescar
            estados»: si Meta ya la aprobó, queda lista para enviar.
          </Banner>
        ) : (
          <p className="leading-relaxed text-tinta-85">{desglose}</p>
        )}

        {vista.sobrantes > 0 && (
          <p className="leading-relaxed text-tinta-60">
            {vista.sobrantes} {vista.sobrantes === 1 ? "queda" : "quedan"} para otro envío: cada
            tanda lleva máximo {TANDA_MAX_BOT}, y primero salen los que siguen en «Nuevo».
          </p>
        )}
        {tipo === "nicho" && vista.bloqueados > 0 && (
          <p className="leading-relaxed text-tinta-60">
            {vista.bloqueados} no {vista.bloqueados === 1 ? "sale" : "salen"}: la plantilla de su tipo
            de negocio está en revisión.
          </p>
        )}
        {pendiente.nota && <p className="leading-relaxed text-tinta-60">({pendiente.nota})</p>}
        {cargando && <p className="text-xs text-tinta-40">Revisando el estado de las plantillas…</p>}
        {sinEstado && (
          <p className="text-xs text-tinta-40">
            No se pudo leer el estado de las plantillas; al enviar se revisa otra vez.
          </p>
        )}

        <p className="leading-relaxed text-tinta-60">
          Cada envío inicia una conversación de marketing con costo de Meta, y el número sin
          verificar admite máx. 250 iniciadas al día. Cuando respondan, Zak conversa con el ángulo
          del tipo de cada negocio y marca a los interesados.
        </p>

        <div className="flex justify-end gap-2">
          <Button onClick={onCancelar}>Cancelar</Button>
          <Button
            variante="primaria"
            disabled={!puedeEnviar}
            onClick={() => onConfirmar(tipo === "una" ? { tipo: "una", slug } : { tipo: "nicho" })}
          >
            Que Zak los contacte
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Opcion({
  activa,
  onElegir,
  titulo,
  detalle,
  children,
}: {
  activa: boolean;
  onElegir: () => void;
  titulo: string;
  detalle?: string;
  children?: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-fila border px-3 py-2.5 transition-colors",
        activa ? "border-acento bg-acento-10" : "border-hairline hover:border-acento/40",
      )}
    >
      <input
        type="radio"
        name="modo-plantilla"
        className="mt-1 accent-acento"
        checked={activa}
        onChange={onElegir}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium text-tinta">{titulo}</span>
        {detalle && <span className="text-xs text-tinta-60">{detalle}</span>}
        {children}
      </span>
    </label>
  );
}
