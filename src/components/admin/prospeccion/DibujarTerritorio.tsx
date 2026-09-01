"use client";

import { useMemo, useState, useTransition } from "react";
import { crearTerritorio } from "@/lib/admin/territorios-actions";
import { poligonoSeCruza, type Punto } from "@/lib/admin/barrido";
import { VERTICES_MAX } from "@/lib/admin/territorios";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input } from "@/components/admin/ui/Field";
import { Modal } from "@/components/admin/ui/Modal";

type Props = {
  /** Los vértices que lleva puestos el usuario. */
  trazo: Punto[];
  onDeshacer: () => void;
  onDescartar: () => void;
  /** El trazo se guardó: el padre limpia el modo dibujo y refresca. */
  onGuardado: () => void;
};

/**
 * La barra del modo dibujo y el diálogo que le pone nombre al área. Vive FUERA
 * del mapa (el trazo lo pinta `TrazoEnCurso`, que sí necesita su contexto).
 */
export function DibujarTerritorio({ trazo, onDeshacer, onDescartar, onGuardado }: Props) {
  const [nombrando, setNombrando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, startGuardar] = useTransition();

  const cerrable = trazo.length >= 3 && trazo.length <= VERTICES_MAX;

  // Con clic-por-vértice, cruzar dos lados sin querer es fácil y no se ve: el
  // relleno tapa el moño. Y el resultado es el peor de esta pantalla — un
  // barrido que llega al 100 % sobre media área que nunca miró. Se AVISA y se
  // deja guardar igual: no hay edición de vértices, solo Deshacer, y bloquear
  // el guardado obligaría a rehacer un trazo de cuarenta clics por un cruce en
  // el tercero. El aviso dice qué pasa; la decisión es de quien dibuja.
  const seCruza = useMemo(() => poligonoSeCruza(trazo), [trazo]);

  function guardar() {
    startGuardar(async () => {
      const res = await crearTerritorio(nombre, trazo);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setNombrando(false);
      setNombre("");
      setError(null);
      onGuardado();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-fila border border-acento/40 bg-acento-10 px-4 py-2.5">
      <span className="text-sm text-tinta-85">
        Toca el mapa para poner vértices.{" "}
        <strong className="text-tinta">{trazo.length}</strong>{" "}
        {trazo.length === 1 ? "puesto" : "puestos"}
        {trazo.length > 0 && trazo.length < 3 && " — faltan para cerrar un área"}
      </span>
      {seCruza && (
        <span className="text-sm text-peligro">
          El contorno se cruza consigo mismo.
        </span>
      )}
      <span className="flex-1" />
      <Button disabled={trazo.length === 0} onClick={onDeshacer}>
        Deshacer
      </Button>
      <Button onClick={onDescartar}>Salir del dibujo</Button>
      <Button variante="primaria" disabled={!cerrable} onClick={() => setNombrando(true)}>
        Cerrar área
      </Button>

      <Modal
        abierto={nombrando}
        onCerrar={(abierto) => {
          if (!abierto) {
            setNombrando(false);
            setError(null);
          }
        }}
        titulo="Nombra el territorio"
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-tinta-60">
            {trazo.length} vértices (máximo {VERTICES_MAX}). El nombre es con el
            que vas a reconocerlo al barrer.
          </p>
          <Field label="Nombre">
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Madrid centro"
              maxLength={120}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && nombre.trim().length > 0) guardar();
              }}
            />
          </Field>
          {seCruza && (
            <Banner variante="error">
              El contorno se cruza consigo mismo: dos lados se atraviesan. En un
              área así, lo que el trazo cubre dos veces cuenta como «fuera».
              Esas teselas se le compran a Google igual, pero sus resultados se
              descartan al guardarlos, y el barrido termina diciendo 100 % sobre
              una zona que nunca censó. Sal del diálogo, deshaz hasta antes del
              cruce y vuelve a cerrar el área.
            </Banner>
          )}
          {error && <Banner variante="error">{error}</Banner>}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setNombrando(false)} disabled={guardando}>
              Seguir dibujando
            </Button>
            <Button
              variante="primaria"
              disabled={guardando || nombre.trim().length === 0}
              onClick={guardar}
            >
              {guardando
                ? "Guardando…"
                : seCruza
                  ? "Guardar así de todos modos"
                  : "Guardar territorio"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
