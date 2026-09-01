"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { PRECIO_POR_LLAMADA_USD } from "@/lib/admin/barrido";
import { formatoUsd } from "@/lib/admin/formato";
import type { ResumenBarrido } from "@/lib/admin/plan-barrido";
import type { Territorio } from "@/lib/admin/territorios";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import { IconButton } from "@/components/admin/ui/IconButton";
import { useBarrido } from "./useBarrido";

type Props = {
  territorio: Territorio;
  /** Las verticales que se confirmaron en el diálogo de estimación. */
  verticales: string[];
  /** Las llamadas que el usuario aceptó gastar al confirmar. */
  llamadasAprobadas: number;
  /** La consulta de territorios falló: el contador de gasto que trae el prop
   * `territorio` es viejo y no se puede presentar como si estuviera al día. */
  fallaTerritorios: boolean;
  onCerrar: () => void;
};

const CERO: ResumenBarrido = {
  encontrados: 0,
  fueraDelArea: 0,
  sinTelefono: 0,
  insertados: 0,
  saturadasAlFondo: 0,
  sinContabilizar: 0,
  fallidas: 0,
};

function sumar(a: ResumenBarrido, b: ResumenBarrido): ResumenBarrido {
  return {
    encontrados: a.encontrados + b.encontrados,
    fueraDelArea: a.fueraDelArea + b.fueraDelArea,
    sinTelefono: a.sinTelefono + b.sinTelefono,
    insertados: a.insertados + b.insertados,
    saturadasAlFondo: a.saturadasAlFondo + b.saturadasAlFondo,
    sinContabilizar: a.sinContabilizar + b.sinContabilizar,
    fallidas: a.fallidas + b.fallidas,
  };
}

function esCero(r: ResumenBarrido): boolean {
  return (
    r.encontrados === 0 &&
    r.fueraDelArea === 0 &&
    r.sinTelefono === 0 &&
    r.insertados === 0 &&
    r.saturadasAlFondo === 0 &&
    r.sinContabilizar === 0 &&
    r.fallidas === 0
  );
}

/** Cuánto se puede pasar el barrido de lo aprobado antes de frenarse solo y
 * volver a preguntar. La estimación es un estimado, no un techo: una zona
 * densa se subdivide y multiplica sus llamadas. */
const FACTOR_TOPE = 2;

/**
 * La barra de un barrido en curso y su resumen al final. Es el único
 * componente que llama a `useBarrido`, y el padre lo monta con
 * `key={territorio.id}`: el hook recuerda en un ref las teselas que ya barrió
 * por clave GEOMÉTRICA (sin identidad de territorio), así que dejarlo
 * sobrevivir a un cambio de territorio dejaría sin barrer celdas legítimas del
 * segundo cuando las dos rejillas coinciden.
 */
export function BarridoProgreso({
  territorio,
  verticales,
  llamadasAprobadas,
  fallaTerritorios,
  onCerrar,
}: Props) {
  const { estado, arrancar, pausar } = useBarrido(territorio);
  const { confirmar, dialogo } = useConfirmar();
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

  // `useBarrido` no limpia nada al desmontarse: sus cuatro workers siguen
  // comprando teselas contra Google aunque React ya haya botado el componente
  // (y con él, el único sitio donde se veían sinContabilizar y saturadasAlFondo).
  // El cambio de cara NO desmonta —la cara se esconde con `hidden`—, así que
  // esto solo corre cuando el barrido de verdad se va. Vía ref y no
  // `[pausar]`: si `pausar` cambiara de identidad, el efecto se re-crearía y
  // su limpieza abortaría un barrido vivo.
  const pausarRef = useRef(pausar);
  useEffect(() => {
    pausarRef.current = pausar;
  }, [pausar]);
  useEffect(
    () => () => {
      pausarRef.current();
      // Y se re-arma el arranque. En dev, Strict Mode monta con
      // setup → cleanup → setup y los refs sobreviven al remontaje simulado:
      // sin esta línea la limpieza abortaría el barrido que el setup acababa
      // de arrancar y el segundo setup saldría por la guarda, dejando la banda
      // clavada en "0 de N" con un botón de Reanudar. En un desmontaje de
      // verdad no cambia nada: el componente ya no existe.
      yaArranco.current = false;
    },
    [],
  );

  const { total, hechos, emitidas, corriendo, resumen, error } = estado;

  // Cerrar la pestaña a mitad de barrido tira la cola en memoria. Las teselas
  // ya barridas están a salvo (teselas_hechas) y ahora las celdas saturadas
  // también (teselas_saturadas, así que sus hijas se regeneran solas), pero las
  // llamadas EN VUELO se pierden sin anotarse. Un aviso del navegador es lo
  // único que se puede hacer contra un cierre; un clic en el sidebar no lo
  // dispara, y para eso está la confirmación de la X.
  useEffect(() => {
    if (!corriendo) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [corriendo]);

  // ---- Contabilidad que sobrevive a Reanudar -------------------------------
  // `arrancar` resetea el resumen y los hechos a cero en cada tanda, así que
  // un sinContabilizar de la tanda 1 desaparecería en cuanto el usuario
  // reanuda — justo el número que no puede perderse. Se archiva la tanda
  // anterior EN RENDER (el patrón de React para estado derivado) usando ese
  // cero como señal: un efecto también archivaría en un `arrancar` que no
  // arrancó nada, y contaría dos veces lo mismo.
  const [cerrado, setCerrado] = useState({ resumen: CERO, emitidas: 0, tandas: 0 });
  const [ultimo, setUltimo] = useState({ resumen: CERO, hechos: 0, emitidas: 0 });

  if (
    resumen !== ultimo.resumen ||
    hechos !== ultimo.hechos ||
    emitidas !== ultimo.emitidas
  ) {
    // Señal de tanda nueva: `arrancar` deja hechos y resumen en cero. `emitidas`
    // NO sirve de señal — los cuatro workers arrancan sincrónicamente y ya
    // pusieron su primer fetch en el mismo lote de renderizado.
    if (hechos === 0 && esCero(resumen) && ultimo.emitidas > 0) {
      setCerrado({
        resumen: sumar(cerrado.resumen, ultimo.resumen),
        emitidas: cerrado.emitidas + ultimo.emitidas,
        tandas: cerrado.tandas + 1,
      });
    }
    setUltimo({ resumen, hechos, emitidas });
  }

  const resumenTotal = sumar(cerrado.resumen, resumen);
  // El tope se mide en llamadas EMITIDAS, que es lo que Google factura. Contar
  // teselas completadas se quedaba corto (un fallo de red posterior al cobro
  // se reintenta: dos llamadas facturadas, un solo `hechos`) y frenaba de más
  // en el caso opuesto (un `!res.ok` suma sin costar).
  const gastadas = cerrado.emitidas + emitidas;
  const tandas = cerrado.tandas + 1;

  // ---- El tope de gasto ----------------------------------------------------
  const [ampliaciones, setAmpliaciones] = useState(1);
  /** Lo que concede cada permiso (el inicial y cada "Continuar"). */
  const otorga = llamadasAprobadas * FACTOR_TOPE;
  const tope = otorga * ampliaciones;

  useEffect(() => {
    // Frenar es exactamente lo que hace una cuota de Google: los workers paran,
    // la cola se conserva y lo comprado ya está guardado. Reanudar desde acá es
    // un permiso nuevo, no el mismo de antes estirado.
    if (corriendo && tope > 0 && gastadas >= tope) pausar();
  }, [corriendo, gastadas, tope, pausar]);

  // ---- Estados de la banda -------------------------------------------------
  const porcentaje = total > 0 ? Math.min(100, Math.round((hechos / total) * 100)) : 0;
  const termino = arranco && !corriendo && hechos >= total;
  const faltan = Math.max(0, total - hechos);
  const capado = arranco && !corriendo && !termino && tope > 0 && gastadas >= tope;

  // Reanudar puede ser un no-op silencioso: si los trabajos que faltaban se
  // habían sacado de la cola justo antes del abort, `arrancar` vuelve sin
  // encolar nada y sin tocar el estado. Se detecta comparando contra la foto
  // tomada al hacer clic — una tanda que sí arrancó pone `hechos` en 0 y
  // `total` en el largo de la cola nueva.
  const [intento, setIntento] = useState<{ hechos: number; total: number } | null>(null);
  const reanudarVacio =
    intento !== null &&
    !corriendo &&
    intento.hechos === hechos &&
    intento.total === total;

  const barridasEnTotal = territorio.teselas_hechas?.length ?? 0;
  const yaEstaban = Math.max(
    0,
    resumenTotal.encontrados -
      resumenTotal.fueraDelArea -
      resumenTotal.sinTelefono -
      resumenTotal.insertados,
  );

  function reanudar(ampliarTope: boolean) {
    if (ampliarTope) setAmpliaciones((a) => a + 1);
    setIntento({ hechos, total });
    arrancar(verticales);
  }

  async function cerrar() {
    // Cerrar con cola pendiente NO es gratis: las hijas de una celda saturada
    // no se pueden regenerar (su tesela madre ya está en teselas_hechas, así
    // que el plan siguiente la salta) y esa zona queda sin censar para siempre,
    // sin que `saturadasAlFondo` lo cuente.
    if (faltan > 0) {
      const ok = await confirmar({
        titulo: "¿Cerrar el barrido a medias?",
        mensaje:
          `Quedan ${faltan} teselas en la cola. Las que salieron de partir una zona ` +
          "densa NO se pueden recuperar: su celda madre ya cuenta como barrida, así " +
          "que un barrido nuevo la salta y esa zona queda sin censar.\n\n" +
          "Reanudar no cuesta nada extra: lo ya barrido no se vuelve a pagar.",
        accion: "Cerrar y perderlas",
        peligro: true,
      });
      if (!ok) return;
    }
    onCerrar();
  }

  return (
    <section
      aria-label={`Barrido de ${territorio.nombre}`}
      className="flex flex-col gap-3 rounded-isla border border-hairline bg-isla/95 p-4 backdrop-blur-sm"
    >
      {dialogo}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-tinta">
            {/* "Terminado" a secas sobre teselas que fallaron es la mentira que
                convierte un error de red en "esta zona está vacía". */}
            {termino
              ? resumenTotal.fallidas > 0
                ? "Barrido terminado a medias"
                : "Barrido terminado"
              : capado
                ? "Barrido en pausa"
                : "Barriendo"}{" "}
            · {territorio.nombre}
          </p>
          <p className="text-xs text-tinta-40">
            {/* La barra cuenta ESTA tanda, no el territorio: al reanudar,
                `hechos` vuelve a 0 y `total` es lo que queda en la cola. */}
            {hechos} de {total} en esta tanda ·{" "}
            {fallaTerritorios ? (
              // El acumulado del territorio viene de una lectura que falló y el
              // barrido sigue gastando encima. Un número que el usuario no
              // puede saber que está viejo es peor que ninguno: se dice, y se
              // deja lo único que sí sabemos de primera mano — lo emitido en
              // esta sesión.
              <span className="text-peligro">
                el contador del territorio no se pudo refrescar; en esta sesión
                van {gastadas} llamadas ≈{" "}
                {formatoUsd(gastadas * PRECIO_POR_LLAMADA_USD)}
              </span>
            ) : (
              <>
                el territorio lleva {barridasEnTotal} teselas barridas ·{" "}
                {territorio.llamadas ?? 0} llamadas ≈{" "}
                {formatoUsd((territorio.llamadas ?? 0) * PRECIO_POR_LLAMADA_USD)}
              </>
            )}
          </p>
        </div>
        {!corriendo && (
          <IconButton etiqueta="Cerrar el barrido" onClick={() => void cerrar()}>
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

      {/* El usuario aprobó una cifra. Pasarse muchas veces de ahí sin volver a
          preguntar es gastar plata que no autorizó. */}
      {capado && (
        <Banner variante="error">
          Aprobaste {llamadasAprobadas} llamadas ≈{" "}
          {formatoUsd(llamadasAprobadas * PRECIO_POR_LLAMADA_USD)} y ya van{" "}
          <strong>{gastadas}</strong> ≈{" "}
          <strong>{formatoUsd(gastadas * PRECIO_POR_LLAMADA_USD)}</strong>: hubo más
          zonas densas de las que cabía suponer y cada una se partió en cuatro. El
          barrido se frenó solo con {faltan} teselas en la cola — nada se perdió.
        </Banner>
      )}

      {reanudarVacio && !capado && (
        <Banner>
          No quedó nada en la cola que reanudar, aunque el contador diga que
          faltan {faltan}: esos trabajos ya habían salido de la cola cuando se
          pausó. Cierra el barrido y vuelve a estimarlo — lo ya barrido no se
          vuelve a pagar.
        </Banner>
      )}

      {termino && (
        <p className="text-sm text-tinta-60">
          En este barrido ({tandas} {tandas === 1 ? "tanda" : "tandas"}):{" "}
          <strong className="text-tinta">{resumenTotal.encontrados}</strong> encontrados ·{" "}
          <strong className="text-tinta">{resumenTotal.fueraDelArea}</strong> fuera del área ·{" "}
          <strong className="text-tinta">{resumenTotal.sinTelefono}</strong> sin teléfono ·{" "}
          <strong className="text-tinta">{resumenTotal.insertados}</strong> nuevos ·{" "}
          <strong className="text-tinta">{yaEstaban}</strong> ya estaban
        </p>
      )}

      {/* Un cobro que el contador no registró es plata que el usuario cree no
          haber gastado: se dice, no se esconde. Y se dice del barrido ENTERO —
          `arrancar` pone el resumen del hook en cero en cada tanda. */}
      {resumenTotal.sinContabilizar > 0 && (
        <Banner variante="error">
          {resumenTotal.sinContabilizar}{" "}
          {resumenTotal.sinContabilizar === 1 ? "tesela se cobró" : "teselas se cobraron"}{" "}
          pero no quedaron contabilizadas en el territorio. El gasto real es mayor que
          el que muestra el contador, y volver a barrer las va a pagar de nuevo.
        </Banner>
      )}

      {/* Una tesela que falló NO es una tesela vacía. Sin este aviso la barra
          llegaba al 100% con "Barrido terminado" sobre un resumen en ceros y
          el usuario leía "aquí no hay negocios" cuando lo que pasó fue que se
          venció la sesión o se cayó la red. */}
      {resumenTotal.fallidas > 0 && (
        <Banner variante="error">
          {resumenTotal.fallidas}{" "}
          {resumenTotal.fallidas === 1
            ? "tesela no se pudo barrer"
            : "teselas no se pudieron barrer"}
          : lo que hubiera ahí NO está en el resumen. No quedaron anotadas como
          barridas, así que volver a barrer este territorio las reintenta y no
          cuesta nada extra por lo que sí quedó guardado. Si son muchas, revisa
          la sesión y la conexión antes de reintentar.
        </Banner>
      )}

      {/* Un censo incompleto que se declara incompleto sirve; uno que se
          declara completo miente. */}
      {resumenTotal.saturadasAlFondo > 0 && (
        <Banner>
          {resumenTotal.saturadasAlFondo}{" "}
          {resumenTotal.saturadasAlFondo === 1
            ? "zona quedó muy densa"
            : "zonas quedaron muy densas"}{" "}
          para el detalle máximo: puede faltar gente ahí.
        </Banner>
      )}

      <div className="flex flex-wrap gap-2">
        {corriendo && (
          <Button
            onClick={() => {
              // La foto del intento anterior deja de valer: sin esto, pausar
              // dos veces en el mismo punto haría creer que Reanudar no hizo
              // nada cuando sí arrancó.
              setIntento(null);
              pausar();
            }}
          >
            Pausar
          </Button>
        )}

        {/* Con el tope alcanzado, "Continuar" REEMPLAZA a Reanudar: si dejara
            los dos, el botón de siempre saltaría el permiso recién pedido. */}
        {!corriendo && !termino && capado && (
          <Button variante="primaria" onClick={() => reanudar(true)}>
            Continuar por otras {otorga} llamadas ≈{" "}
            {formatoUsd(otorga * PRECIO_POR_LLAMADA_USD)}
          </Button>
        )}

        {!corriendo && !termino && !capado && (
          <Button variante="primaria" onClick={() => reanudar(false)}>
            Reanudar: {faltan} teselas ≈ {formatoUsd(faltan * PRECIO_POR_LLAMADA_USD)}
          </Button>
        )}

        {termino && <Button onClick={() => void cerrar()}>Cerrar</Button>}
      </div>
    </section>
  );
}
