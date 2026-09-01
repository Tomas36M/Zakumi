"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { claveTrabajo, subdividir, PROFUNDIDAD_MAX } from "@/lib/admin/barrido";
import { planDeBarrido, type Trabajo } from "@/lib/admin/plan-barrido";
import type { ResumenTesela } from "@/lib/admin/barrido-servidor";
import type { Territorio } from "@/lib/admin/territorios";

/** Cuatro peticiones en vuelo: suficiente para que 310 teselas tarden ~20s sin
 * que Google nos vea como un abuso. */
const CONCURRENCIA = 4;

export type ResumenBarrido = {
  encontrados: number;
  fueraDelArea: number;
  sinTelefono: number;
  insertados: number;
  saturadasAlFondo: number;
  /** Teselas que se cobraron y guardaron pero cuya anotación en el territorio
   * falló. Callar un cobro no contabilizado es mentir sobre el gasto. */
  sinContabilizar: number;
};

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
  // celda saturada mete 4 más) y no queremos re-renderizar por eso.
  const cola = useRef<Trabajo[]>([]);
  const aborto = useRef<AbortController | null>(null);
  // Pausar y el drenaje final del pool compiten por refrescar: pausar lo hace
  // ya mismo (feedback inmediato) y el último worker en morir lo vuelve a
  // hacer al notar la señal abortada. Sin esta guarda, un barrido pausado
  // dispara `router.refresh()` dos veces por la misma pausa.
  const refrescado = useRef(false);

  const refrescarUnaVez = useCallback(() => {
    if (refrescado.current) return;
    refrescado.current = true;
    router.refresh();
  }, [router]);

  const pausar = useCallback(() => {
    aborto.current?.abort();
    aborto.current = null;
    cola.current = [];
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

      const plan = planDeBarrido(territorio, verticales);
      if (plan.length === 0) return;

      cola.current = [...plan];
      const control = new AbortController();
      aborto.current = control;
      refrescado.current = false;
      setEstado({
        total: plan.length,
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

        if (r.saturada && t.profundidad < PROFUNDIDAD_MAX) {
          // Volvieron 20 (el techo de Nearby Search): hay negocios que no
          // vimos. Se parte la celda y se reconsulta SOLO esta vertical.
          const hijas = subdividir(t.tesela).map((tesela) => ({
            tesela,
            vertical: t.vertical,
            profundidad: t.profundidad + 1,
            clave: claveTrabajo(tesela, t.vertical),
          }));
          cola.current.push(...hijas);
          setEstado((e) => ({ ...e, total: e.total + hijas.length }));
        }

        setEstado((e) => ({
          ...e,
          hechos: e.hechos + 1,
          resumen: {
            encontrados: e.resumen.encontrados + r.encontrados,
            fueraDelArea: e.resumen.fueraDelArea + r.fueraDelArea,
            sinTelefono: e.resumen.sinTelefono + r.sinTelefono,
            insertados: e.resumen.insertados + r.insertados,
            saturadasAlFondo:
              e.resumen.saturadasAlFondo +
              (r.saturada && t.profundidad >= PROFUNDIDAD_MAX ? 1 : 0),
            sinContabilizar: e.resumen.sinContabilizar + (r.contabilizada ? 0 : 1),
          },
        }));
      }

      async function trabajar(): Promise<void> {
        while (!control.signal.aborted) {
          const t = cola.current.shift();
          if (!t) break;
          await procesar(t);
        }
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

      for (let i = 0; i < CONCURRENCIA; i++) void trabajar();
    },
    [territorio, refrescarUnaVez],
  );

  return { estado, arrancar, pausar };
}
