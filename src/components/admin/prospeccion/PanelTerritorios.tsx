"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilLine, Trash2 } from "lucide-react";
import { PRECIO_POR_LLAMADA_USD } from "@/lib/admin/barrido";
import { fechaCorta, formatoUsd } from "@/lib/admin/formato";
import type { Negocio } from "@/lib/admin/negocios";
import type { Territorio } from "@/lib/admin/territorios";
import { eliminarTerritorio, renombrarTerritorio } from "@/lib/admin/territorios-actions";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Field, Input } from "@/components/admin/ui/Field";
import { IconButton } from "@/components/admin/ui/IconButton";
import { ListRow } from "@/components/admin/ui/ListRow";
import { Modal } from "@/components/admin/ui/Modal";

type Props = {
  territorios: Territorio[];
  negocios: Negocio[];
  dibujando: boolean;
  onDibujar: () => void;
  /** El territorio cuyo barrido está montado ahora mismo (o null). */
  barriendoId: string | null;
  onBarrer: (territorio: Territorio) => void;
};

/**
 * La lista de territorios: qué produjo cada uno, cuánto costó y los tres
 * botones que se pueden apretar. El diálogo de estimación lo abre el padre —
 * este panel solo pide "barrer este".
 */
export function PanelTerritorios({
  territorios,
  negocios,
  dibujando,
  onDibujar,
  barriendoId,
  onBarrer,
}: Props) {
  const router = useRouter();
  const { confirmar, dialogo } = useConfirmar();
  const [renombrando, setRenombrando] = useState<Territorio | null>(null);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, startAccion] = useTransition();

  // Un solo recorrido de los negocios para todos los territorios: la lista se
  // repinta en cada refresh del barrido.
  const cuentas = useMemo(() => {
    const mapa = new Map<string, { leads: number; sinWeb: number }>();
    for (const n of negocios) {
      if (!n.territorio_id) continue;
      const fila = mapa.get(n.territorio_id) ?? { leads: 0, sinWeb: 0 };
      fila.leads++;
      if (!n.sitio_web) fila.sinWeb++;
      mapa.set(n.territorio_id, fila);
    }
    return mapa;
  }, [negocios]);

  function guardarNombre() {
    const territorio = renombrando;
    if (!territorio) return;
    startAccion(async () => {
      const res = await renombrarTerritorio(territorio.id, nombre);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setRenombrando(null);
      setError(null);
      router.refresh();
    });
  }

  async function borrar(territorio: Territorio) {
    const ok = await confirmar({
      titulo: `¿Eliminar ${territorio.nombre}?`,
      mensaje:
        "Se borra el área y su historial de teselas barridas: volver a barrirla se " +
        "le paga a Google otra vez. Los leads que ya produjo NO se borran.",
      accion: "Eliminar",
      peligro: true,
    });
    if (!ok) return;
    startAccion(async () => {
      const res = await eliminarTerritorio(territorio.id);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setError(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {dialogo}

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-tinta-85">Territorios</h2>
        <Button variante={dibujando ? "primaria" : "fantasma"} onClick={onDibujar}>
          {dibujando ? "Dibujando… (clic para salir)" : "Dibujar territorio"}
        </Button>
      </div>

      {error && <Banner variante="error">{error}</Banner>}

      {territorios.length === 0 ? (
        <EmptyState
          titulo="Ningún territorio todavía"
          detalle="Dibuja un área sobre el mapa y ponle nombre. Barrerla llena el CRM con los negocios que hay dentro."
        />
      ) : (
        <ul className="flex flex-col gap-1">
          {territorios.map((t) => {
            const cuenta = cuentas.get(t.id) ?? { leads: 0, sinWeb: 0 };
            const llamadas = t.llamadas ?? 0;
            return (
              <li key={t.id}>
                <ListRow interactiva={false} className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-tinta">{t.nombre}</p>
                      <p className="text-xs text-tinta-60">
                        {cuenta.leads} leads · {cuenta.sinWeb} sin web
                      </p>
                      <p className="text-xs text-tinta-40">
                        {t.ultimo_barrido
                          ? `barrido ${fechaCorta(t.ultimo_barrido)}`
                          : "sin barrer"}{" "}
                        · {llamadas} {llamadas === 1 ? "llamada" : "llamadas"} ≈{" "}
                        {formatoUsd(llamadas * PRECIO_POR_LLAMADA_USD)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <IconButton
                        etiqueta={`Renombrar ${t.nombre}`}
                        disabled={ocupado}
                        onClick={() => {
                          setRenombrando(t);
                          setNombre(t.nombre);
                          setError(null);
                        }}
                      >
                        <PencilLine className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        etiqueta={`Eliminar ${t.nombre}`}
                        disabled={ocupado}
                        onClick={() => void borrar(t)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>
                  <Button
                    variante="primaria"
                    className="self-start"
                    disabled={barriendoId === t.id}
                    onClick={() => onBarrer(t)}
                  >
                    {barriendoId === t.id ? "Barrido abierto" : "Barrer"}
                  </Button>
                </ListRow>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        abierto={renombrando !== null}
        onCerrar={(abierto) => {
          if (!abierto) {
            setRenombrando(null);
            setError(null);
          }
        }}
        titulo="Renombrar territorio"
      >
        <div className="flex flex-col gap-3">
          <Field label="Nombre">
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={120}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && nombre.trim().length > 0) guardarNombre();
              }}
            />
          </Field>
          {error && <Banner variante="error">{error}</Banner>}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setRenombrando(null)} disabled={ocupado}>
              Cancelar
            </Button>
            <Button
              variante="primaria"
              disabled={ocupado || nombre.trim().length === 0}
              onClick={guardarNombre}
            >
              {ocupado ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
