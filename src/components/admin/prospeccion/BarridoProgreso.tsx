"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { PRECIO_POR_LLAMADA_USD } from "@/lib/admin/barrido";
import { formatoUsd } from "@/lib/admin/formato";
import type { Territorio } from "@/lib/admin/territorios";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { IconButton } from "@/components/admin/ui/IconButton";
import { useBarrido } from "./useBarrido";

type Props = {
  territorio: Territorio;
  /** Las verticales que se confirmaron en el diálogo de estimación. */
  verticales: string[];
  onCerrar: () => void;
};

/**
 * La barra de un barrido en curso y su resumen al final. Es el único
 * componente que llama a `useBarrido`, y el padre lo monta con
 * `key={territorio.id}`: el hook recuerda en un ref las teselas que ya barrió
 * por clave GEOMÉTRICA (sin identidad de territorio), así que dejarlo
 * sobrevivir a un cambio de territorio dejaría sin barrer celdas legítimas del
 * segundo cuando las dos rejillas coinciden.
 */
export function BarridoProgreso({ territorio, verticales, onCerrar }: Props) {
  const { estado, arrancar, pausar } = useBarrido(territorio);
  // El ref evita el doble arranque; el estado es lo que la vista puede leer en
  // render (un ref no re-renderiza, y con la cola vacía `arrancar` no toca el
  // estado del hook — sin esto la vista se quedaría en "Barriendo 0 de 0").
  const yaArranco = useRef(false);
  const [arranco, setArranco] = useState(false);

  // Arranca UNA vez al montarse. `arrancar` cambia de identidad en cada
  // router.refresh() (depende del prop `territorio`); sin la guarda, cada
  // refresh dispararía otro barrido.
  useEffect(() => {
    if (yaArranco.current) return;
    yaArranco.current = true;
    arrancar(verticales);
    setArranco(true);
  }, [arrancar, verticales]);

  const { total, hechos, corriendo, resumen, error } = estado;
  const porcentaje = total > 0 ? Math.min(100, Math.round((hechos / total) * 100)) : 0;
  const termino = arranco && !corriendo && hechos >= total;
  const barridasEnTotal = territorio.teselas_hechas?.length ?? 0;

  const yaEstaban = Math.max(
    0,
    resumen.encontrados - resumen.fueraDelArea - resumen.sinTelefono - resumen.insertados,
  );

  return (
    <section
      aria-label={`Barrido de ${territorio.nombre}`}
      className="flex flex-col gap-3 rounded-isla border border-hairline bg-isla/95 p-4 backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-tinta">
            {termino ? "Barrido terminado" : "Barriendo"} · {territorio.nombre}
          </p>
          <p className="text-xs text-tinta-40">
            {/* La barra cuenta ESTA tanda, no el territorio: al reanudar,
                `hechos` vuelve a 0 y `total` es lo que queda en la cola. */}
            {hechos} de {total} en esta tanda · el territorio lleva {barridasEnTotal}{" "}
            teselas barridas · {territorio.llamadas ?? 0} llamadas ≈{" "}
            {formatoUsd((territorio.llamadas ?? 0) * PRECIO_POR_LLAMADA_USD)}
          </p>
        </div>
        {!corriendo && (
          <IconButton etiqueta="Cerrar el barrido" onClick={onCerrar}>
            <X className="h-4 w-4" />
          </IconButton>
        )}
      </div>

      <div
        role="progressbar"
        aria-valuenow={porcentaje}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Avance de esta tanda"
        className="h-1.5 w-full overflow-hidden rounded-full bg-isla-alta"
      >
        <div
          className="h-full rounded-full bg-acento transition-[width] duration-300"
          style={{ width: `${porcentaje}%` }}
        />
      </div>

      {error && <Banner variante="error">{error}</Banner>}

      {termino && (
        <p className="text-sm text-tinta-60">
          <strong className="text-tinta">{resumen.encontrados}</strong> encontrados ·{" "}
          <strong className="text-tinta">{resumen.fueraDelArea}</strong> fuera del área ·{" "}
          <strong className="text-tinta">{resumen.sinTelefono}</strong> sin teléfono ·{" "}
          <strong className="text-tinta">{resumen.insertados}</strong> nuevos ·{" "}
          <strong className="text-tinta">{yaEstaban}</strong> ya estaban
        </p>
      )}

      {/* Un cobro que el contador no registró es plata que el usuario cree no
          haber gastado: se dice, no se esconde. */}
      {resumen.sinContabilizar > 0 && (
        <Banner variante="error">
          {resumen.sinContabilizar}{" "}
          {resumen.sinContabilizar === 1 ? "tesela se cobró" : "teselas se cobraron"} pero
          no quedaron contabilizadas en el territorio. El gasto real es mayor que el que
          muestra el contador, y volver a barrer las va a pagar de nuevo.
        </Banner>
      )}

      {/* Un censo incompleto que se declara incompleto sirve; uno que se
          declara completo miente. */}
      {resumen.saturadasAlFondo > 0 && (
        <Banner>
          {resumen.saturadasAlFondo}{" "}
          {resumen.saturadasAlFondo === 1 ? "zona quedó muy densa" : "zonas quedaron muy densas"}{" "}
          para el detalle máximo: puede faltar gente ahí.
        </Banner>
      )}

      <div className="flex flex-wrap gap-2">
        {corriendo ? (
          <Button onClick={pausar}>Pausar</Button>
        ) : (
          !termino && (
            <Button variante="primaria" onClick={() => arrancar(verticales)}>
              Reanudar
            </Button>
          )
        )}
        {termino && (
          <Button onClick={onCerrar}>Cerrar</Button>
        )}
      </div>
    </section>
  );
}
