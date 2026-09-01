"use client";

import { useMemo, useState, useTransition } from "react";
import { crearTerritorio } from "@/lib/admin/territorios-actions";
import { poligonoSeCruza, type Punto } from "@/lib/admin/barrido";
import { VERTICES_MAX } from "@/lib/admin/territorios";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import { Field, Input } from "@/components/admin/ui/Field";
import { Modal } from "@/components/admin/ui/Modal";
import type { ModoDibujo } from "./TrazoEnCurso";

type Props = {
  modo: ModoDibujo;
  /** Cambiar de forma. Pasar a rectángulo DESCARTA el trazo (una caja no puede
   * describir un contorno a mano); este componente lo confirma antes. */
  onModo: (modo: ModoDibujo) => void;
  /** Los vértices que lleva puestos el usuario. */
  trazo: Punto[];
  /** El diálogo del nombre está abierto. Vive en el padre porque se abre desde
   * dos sitios: el botón de aquí y el clic en el primer vértice sobre el mapa. */
  nombrando: boolean;
  onNombrando: (abierto: boolean) => void;
  onDeshacer: () => void;
  /** Borrar la forma y volver a empezar SIN salir del modo dibujo. */
  onLimpiar: () => void;
  onDescartar: () => void;
  /** El trazo se guardó: el padre limpia el modo dibujo y refresca. */
  onGuardado: () => void;
};

const CHIP = "h-8 px-3 text-xs";

/**
 * La barra del modo dibujo y el diálogo que le pone nombre al área. Vive FUERA
 * del mapa (el trazo lo pinta `TrazoEnCurso`, que sí necesita su contexto).
 */
export function DibujarTerritorio({
  modo,
  onModo,
  trazo,
  nombrando,
  onNombrando,
  onDeshacer,
  onLimpiar,
  onDescartar,
  onGuardado,
}: Props) {
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, startGuardar] = useTransition();
  const { confirmar, dialogo } = useConfirmar();

  const cerrable = trazo.length >= 3 && trazo.length <= VERTICES_MAX;

  // Cruzar dos lados sin querer es fácil y no se ve: el relleno tapa el moño.
  // Y el resultado es el peor de esta pantalla — un barrido que llega al 100 %
  // sobre media área que nunca miró. Se AVISA y se deja guardar igual: la
  // decisión es de quien dibuja. (Con el contorno editable ya se puede
  // arreglar arrastrando el vértice culpable, sin deshacer hacia atrás.)
  const seCruza = useMemo(() => poligonoSeCruza(trazo), [trazo]);

  async function cambiarModo(nuevo: ModoDibujo) {
    if (nuevo === modo) return;
    // Ir a rectángulo tira el trazo: son veinte clics, no se pierden callados.
    if (nuevo === "rectangulo" && trazo.length > 0) {
      const ok = await confirmar({
        titulo: "¿Cambiar a rectángulo?",
        mensaje: `Se descartan los ${trazo.length} ${
          trazo.length === 1 ? "vértice puesto" : "vértices puestos"
        }: una caja no puede describir un contorno a mano.`,
        accion: "Cambiar y empezar de cero",
      });
      if (!ok) return;
    }
    onModo(nuevo);
  }

  function guardar() {
    startGuardar(async () => {
      const res = await crearTerritorio(nombre, trazo);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onNombrando(false);
      setNombre("");
      setError(null);
      onGuardado();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-fila border border-acento/40 bg-acento-10 px-4 py-2.5">
      {dialogo}

      <div className="flex items-center gap-1" role="group" aria-label="Forma del área">
        <Button
          className={CHIP}
          variante={modo === "rectangulo" ? "primaria" : "fantasma"}
          aria-pressed={modo === "rectangulo"}
          onClick={() => cambiarModo("rectangulo")}
        >
          Rectángulo
        </Button>
        <Button
          className={CHIP}
          variante={modo === "poligono" ? "primaria" : "fantasma"}
          aria-pressed={modo === "poligono"}
          onClick={() => cambiarModo("poligono")}
        >
          Contorno libre
        </Button>
      </div>

      <span className="text-sm text-tinta-85">
        {modo === "rectangulo" ? (
          trazo.length === 0 ? (
            "Arrastra sobre el mapa para encerrar el área."
          ) : (
            "Área lista. Arrastra las esquinas o los lados para ajustarla, o muévela entera."
          )
        ) : (
          <>
            Toca el mapa para poner vértices.{" "}
            <strong className="text-tinta">{trazo.length}</strong>{" "}
            {trazo.length === 1 ? "puesto" : "puestos"}
            {trazo.length > 0 && trazo.length < 3
              ? " — faltan para cerrar un área"
              : trazo.length >= 3
                ? " — arrastra uno para moverlo, o el punto de en medio de un lado para añadir otro. Toca el primero para cerrar."
                : ""}
          </>
        )}
      </span>
      {seCruza && (
        <span className="text-sm text-peligro">
          El contorno se cruza consigo mismo.
        </span>
      )}
      <span className="flex-1" />
      {modo === "rectangulo" ? (
        <Button disabled={trazo.length === 0} onClick={onLimpiar}>
          Redibujar
        </Button>
      ) : (
        <Button disabled={trazo.length === 0} onClick={onDeshacer}>
          Deshacer
        </Button>
      )}
      <Button onClick={onDescartar}>Salir del dibujo</Button>
      <Button variante="primaria" disabled={!cerrable} onClick={() => onNombrando(true)}>
        {modo === "rectangulo" ? "Nombrar y guardar" : "Cerrar área"}
      </Button>

      <Modal
        abierto={nombrando}
        onCerrar={(abierto) => {
          if (!abierto) {
            onNombrando(false);
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
              una zona que nunca censó. Sal del diálogo y arrastra el vértice
              que cruza hasta deshacer el moño.
            </Banner>
          )}
          {error && <Banner variante="error">{error}</Banner>}
          <div className="flex justify-end gap-2">
            <Button onClick={() => onNombrando(false)} disabled={guardando}>
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
