"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PROFUNDIDAD_MAX } from "@/lib/admin/barrido";
import {
  acumularResumen,
  hijasDe,
  planDeBarrido,
  type ResumenBarrido,
  type Trabajo,
} from "@/lib/admin/plan-barrido";
import type { ResumenTesela } from "@/lib/admin/barrido-servidor";
import type { Territorio } from "@/lib/admin/territorios";

// Se re-exporta: `ResumenBarrido` vive en plan-barrido.ts (donde acumularResumen
// puede probarse sin DOM/fetch), pero el consumidor del hook lo sigue pidiendo
// desde acá, como en el resto de la API pública de useBarrido.
export type { ResumenBarrido };

/** Cuatro peticiones en vuelo: suficiente para que 310 teselas tarden ~20s sin
 * que Google nos vea como un abuso. */
const CONCURRENCIA = 4;

export type EstadoBarrido = {
  total: number;
  hechos: number;
  corriendo: boolean;
  resumen: ResumenBarrido;
  error: string | null;
};

const RESUMEN_CERO: ResumenBarrido = {
  encontrados: 0,
  fueraDelArea: 0,
  sinTelefono: 0,
  insertados: 0,
  saturadasAlFondo: 0,
  sinContabilizar: 0,
};

export function useBarrido(territorio: Territorio) {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoBarrido>({
    total: 0,
    hechos: 0,
    corriendo: false,
    resumen: RESUMEN_CERO,
    error: null,
  });

  // La cola vive en un ref, no en el estado: crece durante el barrido (cada
  // celda saturada mete 4 más) y no queremos re-renderizar por eso. Pausar NO
  // la vacía (ver más abajo) — sobrevive a la pausa para poder reanudar.
  const cola = useRef<Trabajo[]>([]);
  const aborto = useRef<AbortController | null>(null);
  // Pausar y el drenaje final del pool compiten por refrescar: pausar lo hace
  // ya mismo (feedback inmediato) y el último worker en morir lo vuelve a
  // hacer al notar la señal abortada. Sin esta guarda, un barrido pausado
  // dispara `router.refresh()` dos veces por la misma pausa.
  const refrescado = useRef(false);
  // Lo que ESTE hook ya barrió, por clave de trabajo. El prop `territorio`
  // solo se actualiza cuando aterriza el re-render de router.refresh(), que es
  // asíncrono: si el usuario le da a Reanudar antes de que aterrice,
  // planificar solo desde el prop volvería a comprarle a Google teselas ya
  // pagadas en esta misma sesión. Nunca se limpia: es un superconjunto de la
  // verdad del prop y sigue siendo correcto una vez el prop se pone al día.
  const hechasLocal = useRef<Set<string>>(new Set());

  const refrescarUnaVez = useCallback(() => {
    if (refrescado.current) return;
    refrescado.current = true;
    router.refresh();
  }, [router]);

  const pausar = useCallback(() => {
    aborto.current?.abort();
    aborto.current = null;
    // OJO: no se vacía `cola.current` acá. Un worker cuyo fetch ya había
    // resuelto puede seguir corriendo su chequeo de saturación (síncrono, sin
    // await) después de esta línea y empujar hijas a la cola — vaciarla acá
    // las pierde en silencio, y esa celda nunca se vuelve a intentar porque
    // la tesela MADRE ya quedó anotada como hecha. Los workers ya paran solos
    // al ver la señal abortada, así que nada la drena mientras está pausado.
    setEstado((e) => ({ ...e, corriendo: false }));
    // Refresca para que el próximo plan lea teselas_hechas al día.
    refrescarUnaVez();
  }, [refrescarUnaVez]);

  const arrancar = useCallback(
    (verticales: string[]) => {
      // Reentrada: si ya hay un barrido corriendo, un segundo arranque
      // compartiría `cola.current` con el pool viejo (mismo ref, `.current`
      // reasignado) y duplicaría la concurrencia sin que nadie lo pida.
      if (aborto.current) return;

      // Restar también lo hecho en ESTA sesión (hechasLocal), no solo lo que
      // dice el prop `territorio` — ver comentario junto a la declaración.
      const plan = planDeBarrido(territorio, verticales).filter(
        (t) => !hechasLocal.current.has(t.clave),
      );

      // Lo que quedó pendiente de un barrido pausado — incluidas las hijas de
      // una celda saturada, que ya no se pueden regenerar: su tesela madre
      // quedó anotada como hecha y el plan nuevo la salta. Van primero: son
      // las más profundas y las únicas irrecuperables.
      const pendientes = cola.current.filter((t) => verticales.includes(t.vertical));
      const yaEnCola = new Set(pendientes.map((t) => t.clave));
      cola.current = [...pendientes, ...plan.filter((t) => !yaEnCola.has(t.clave))];

      if (cola.current.length === 0) return;

      const control = new AbortController();
      aborto.current = control;
      refrescado.current = false;
      setEstado({
        total: cola.current.length,
        hechos: 0,
        corriendo: true,
        resumen: RESUMEN_CERO,
        error: null,
      });

      let vivos = CONCURRENCIA;

      async function procesar(t: Trabajo, reintento = false): Promise<void> {
        let res: Response;
        try {
          res = await fetch(`/admin/api/territorio/${territorio.id}/barrer`, {
            method: "POST",
            signal: control.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              centro: t.tesela.centro,
              radio: t.tesela.radio,
              vertical: t.vertical,
            }),
          });
        } catch {
          if (control.signal.aborted) return;
          // Un fallo de red se reintenta UNA vez; al segundo, esta tesela se
          // descarta y el barrido sigue. Una celda perdida no tumba un censo.
          if (!reintento) return procesar(t, true);
          setEstado((e) => ({ ...e, hechos: e.hechos + 1 }));
          return;
        }

        if (res.status === 503) {
          // Cuota de Google: PAUSA, no muerte. Lo barrido ya está en la base y
          // en teselas_hechas, así que reanudar no vuelve a pagarlo.
          setEstado((e) => ({
            ...e,
            error:
              "Google cortó por cuota. Lo barrido quedó guardado: reanuda en un rato.",
          }));
          control.abort();
          return;
        }

        if (!res.ok) {
          setEstado((e) => ({ ...e, hechos: e.hechos + 1 }));
          return;
        }

        const r = (await res.json()) as ResumenTesela;
        // Se cobró y ya se guardó: márcalo YA, no esperes al refresh. Esto es
        // lo que hace seguro reanudar de inmediato (ver hechasLocal arriba).
        hechasLocal.current.add(t.clave);

        if (r.saturada && t.profundidad < PROFUNDIDAD_MAX) {
          // Volvieron 20 (el techo de Nearby Search): hay negocios que no
          // vimos. Se parte la celda y se reconsulta SOLO esta vertical.
          const hijas = hijasDe(t);
          cola.current.push(...hijas);
          setEstado((e) => ({ ...e, total: e.total + hijas.length }));
        }

        setEstado((e) => ({
          ...e,
          hechos: e.hechos + 1,
          resumen: acumularResumen(e.resumen, r, t.profundidad),
        }));
      }

      async function trabajar(): Promise<void> {
        try {
          while (!control.signal.aborted) {
            const t = cola.current.shift();
            if (!t) break;
            try {
              await procesar(t);
            } catch (error) {
              // Un fallo inesperado (JSON malformado, abort a media lectura
              // del body) no puede matar al worker ni dejar `vivos` sin
              // decrementar — eso cuelga el barrido entero con `corriendo`
              // pegado en true y sin más recurso que recargar la página. Se
              // cuenta la tesela como hecha (se da por perdida) y se sigue.
              console.error("[barrido] tesela fallida:", error);
              setEstado((e) => ({ ...e, hechos: e.hechos + 1 }));
            }
          }
        } finally {
          vivos--;
          if (vivos === 0) {
            aborto.current = null;
            setEstado((e) => ({ ...e, corriendo: false }));
            // Los negocios nuevos bajan por props del server, como en el
            // importar de MapaView. Una sola vez, al final (o nunca, si ya
            // refrescó `pausar`).
            refrescarUnaVez();
          }
        }
      }

      for (let i = 0; i < CONCURRENCIA; i++) void trabajar();
    },
    [territorio, refrescarUnaVez],
  );

  return { estado, arrancar, pausar };
}
