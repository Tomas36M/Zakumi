"use client";

import { useMemo, useState } from "react";
import {
  poligonoSeCruza,
  PRECIO_POR_LLAMADA_USD,
  CUOTA_GRATIS_MENSUAL,
  FACTOR_TOPE_APROBADO,
  FACTOR_TOPE_GRATIS,
  estimarBarrido,
  estadoDeCuota,
  teselar,
} from "@/lib/admin/barrido";
import { planDeBarrido, recortarACuota } from "@/lib/admin/plan-barrido";
import { formatoUsd } from "@/lib/admin/formato";
import type { Territorio } from "@/lib/admin/territorios";
import { VERTICALES_PROSPECCION } from "@/lib/admin/zak";
import { tiposDeVertical } from "@/lib/admin/verticales-places";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input } from "@/components/admin/ui/Field";
import { Modal } from "@/components/admin/ui/Modal";
import { cn } from "@/lib/cn";

// Solo las verticales que tienen tipos de Places: una sin tipos es un 400 del
// handler, y contarla en la estimación sería mentir sobre lo que se compra.
const VERTICALES = VERTICALES_PROSPECCION.filter(
  (v) => tiposDeVertical(v.slug).length > 0,
);

type Props = {
  territorio: Territorio;
  /** Consultas a Google Places que este panel lleva registradas en el mes
   * calendario en curso. `null` = no se pudo leer, y NO es lo mismo que cero:
   * no se puede afirmar cuota gratis sobre un dato que no se tiene. */
  consultasMes: number | null;
  onCerrar: () => void;
  /** `llamadasAprobadas` es la cifra que el usuario está aceptando gastar.
   * `factorTope` decide cuánto margen tiene el barrido antes de frenarse solo
   * y volver a preguntar: `FACTOR_TOPE_APROBADO` (2×) para la confirmación
   * normal, `FACTOR_TOPE_GRATIS` (1×, sin margen) para el botón de solo lo
   * gratis — ese botón promete un tope exacto, no un estimado. */
  onConfirmar: (verticales: string[], llamadasAprobadas: number, factorTope: number) => void;
};

const METRICAS_GOOGLE_URL = "https://console.cloud.google.com/google/maps-apis/metrics";

/**
 * La última pantalla antes de gastar. Todo lo que se ve aquí es dinero: las
 * teselas que se van a comprar, lo que cuestan, hasta dónde puede subir si hay
 * zonas densas, y lo que este territorio lleva gastado.
 */
export function DialogoBarrer({ territorio, consultasMes, onCerrar, onConfirmar }: Props) {
  const [marcadas, setMarcadas] = useState<ReadonlySet<string>>(
    () => new Set(VERTICALES.map((v) => v.slug)),
  );
  // El monto que la persona teclea para confirmar que va a pagar. Solo se
  // exige (y solo se pinta el campo) cuando la tanda se pasa de lo gratis —
  // ver `requiereMonto` más abajo.
  const [escrito, setEscrito] = useState("");

  // La rejilla NO depende de las verticales: se calcula una vez y el resto son
  // multiplicaciones. `teselar` recorre la caja entera celda por celda.
  const teselas = useMemo(() => teselar(territorio.poligono), [territorio.poligono]);

  // Este diálogo es la última pantalla antes de gastar: si el territorio se
  // guardó con el override de `DibujarTerritorio`, es acá donde el aviso
  // tiene que reaparecer, no solo en la lista de la que se vino.
  const cruza = useMemo(() => poligonoSeCruza(territorio.poligono), [territorio.poligono]);

  const slugs = useMemo(
    () => VERTICALES.filter((v) => marcadas.has(v.slug)).map((v) => v.slug),
    [marcadas],
  );

  // Lo que esta tanda va a COMPRAR, contado con el MISMO plan que va a correr:
  // lo ya barrido no se vuelve a pagar, y las hijas de las celdas que saturaron
  // en un barrido anterior sí entran. Contarlas aparte era el bug: con todas
  // las teselas de nivel 0 hechas, el diálogo decía "no hay nada que comprar" y
  // apagaba el botón, dejando esas zonas densas sin censar para siempre.
  const plan = useMemo(
    () => planDeBarrido(territorio, slugs, teselas),
    [territorio, slugs, teselas],
  );
  const pendientes = plan.length;
  const hijasPendientes = plan.filter((t) => t.profundidad > 0).length;

  const bruto = estimarBarrido(teselas.length, slugs.length);
  // Mismo cálculo sobre lo pendiente: llamadas = teselas × verticales, así que
  // "pendientes × 1" es exactamente la cuenta de esta tanda.
  const tanda = estimarBarrido(pendientes, 1);
  const gastado = territorio.llamadas ?? 0;

  // null = "no pudimos leerlo", que NO es lo mismo que cero. Si se colapsan,
  // un fallo de lectura se presenta como cuota intacta y el usuario gasta
  // creyendo que no cuesta.
  const cuota = consultasMes === null ? null : estadoDeCuota(consultasMes);

  const planGratis = cuota ? recortarACuota(plan, cuota.restantes) : [];
  // Se ofrece solo si hay dato, queda algo gratis, Y la tanda se pasa. Si el
  // plan entero cabe, este botón haría lo mismo que el principal.
  const ofrecerGratis = cuota !== null && planGratis.length > 0 && planGratis.length < plan.length;

  // Sin dato de cuota no se puede afirmar que la tanda cabe entera gratis:
  // se trata igual que si de verdad se pasara, y se pide el monto escrito.
  const cabeEntero = cuota !== null && tanda.llamadas <= cuota.restantes;
  const requiereMonto = pendientes > 0 && !cabeEntero;

  /** Lo que hay que teclear: el monto sin moneda ni espacios. Se compara así
   * —y no contra una palabra fija— porque un monto hay que ir a buscarlo al
   * botón: para copiarlo, hay que mirarlo. Una palabra se teclea de memoria. */
  const esperado = formatoUsd(tanda.costoUsd).replace(/[^\d.,]/g, "");
  const coincide = escrito.replace(/[^\d.,]/g, "") === esperado;
  const primarioDeshabilitado = pendientes === 0 || (requiereMonto && !coincide);

  function alternar(slug: string) {
    setMarcadas((prev) => {
      const copia = new Set(prev);
      if (copia.has(slug)) copia.delete(slug);
      else copia.add(slug);
      return copia;
    });
  }

  return (
    <Modal
      abierto
      onCerrar={(abierto) => {
        if (!abierto) onCerrar();
      }}
      titulo={`Barrer ${territorio.nombre}`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5">
          {VERTICALES.map((v) => {
            const activa = marcadas.has(v.slug);
            return (
              <button
                key={v.slug}
                type="button"
                role="checkbox"
                aria-checked={activa}
                onClick={() => alternar(v.slug)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  activa
                    ? "border-acento bg-acento-10 text-tinta"
                    : "border-hairline text-tinta-40 hover:border-acento/40",
                )}
              >
                {v.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Button
            className="h-8 px-3 text-xs"
            onClick={() => setMarcadas(new Set(VERTICALES.map((v) => v.slug)))}
          >
            Todas
          </Button>
          <Button className="h-8 px-3 text-xs" onClick={() => setMarcadas(new Set())}>
            Ninguna
          </Button>
        </div>

        <div className="rounded-fila bg-isla-alta p-4 text-sm leading-relaxed text-tinta-60">
          <p>
            <strong className="text-tinta">{teselas.length}</strong> teselas ×{" "}
            <strong className="text-tinta">{slugs.length}</strong>{" "}
            {slugs.length === 1 ? "vertical" : "verticales"} ={" "}
            <strong className="text-tinta">{bruto.llamadas}</strong> consultas a Google.
          </p>
          <p className="mt-1">
            Esta tanda compra{" "}
            <strong className="text-acento">{tanda.llamadas} consultas</strong> ≈{" "}
            <strong className="text-acento">{formatoUsd(tanda.costoUsd)}</strong>
            {pendientes < bruto.llamadas && (
              <> — las otras {bruto.llamadas - pendientes} ya están barridas y no se pagan.</>
            )}
          </p>
          {/* La cifra de arriba es SIEMPRE precio de lista: lo que este panel
              sabe del consumo del mes (cuando lo sabe) es una anotación aparte,
              no un descuento sobre esa cifra — no hay forma de calcular un neto
              exacto (otro consumidor de la key lo movería sin avisar). */}
          {cuota === null ? (
            <p className="mt-1 text-tinta-40">
              No se pudo leer cuánto llevas gastado este mes. La cifra de
              abajo es el precio de lista.
            </p>
          ) : (
            <p className="mt-1 text-tinta-40">
              Este mes llevas <strong className="text-tinta-60">{cuota.consumidas}</strong>{" "}
              de {CUOTA_GRATIS_MENSUAL} consultas gratis, según lo que este
              panel lleva registrado.
              {cuota.agotada && (
                <>
                  {" "}
                  Ya se agotaron: de aquí en adelante todo se paga. Puedes
                  verificarlo en{" "}
                  <a
                    href={METRICAS_GOOGLE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-tinta-60"
                  >
                    las métricas de Google Cloud
                  </a>
                  .
                </>
              )}
            </p>
          )}
          {hijasPendientes > 0 && (
            <p className="mt-1">
              Incluye <strong className="text-tinta">{hijasPendientes}</strong>{" "}
              {hijasPendientes === 1 ? "sub-tesela" : "sub-teselas"} de zonas densas
              que quedaron a medias en un barrido anterior. Son teselas que nadie le
              ha comprado a Google todavía: es gasto nuevo, no gasto repetido.
            </p>
          )}
          <p className="mt-1">
            {/* NO es un techo: FACTOR_DENSIDAD es un margen. Con
                PROFUNDIDAD_MAX = 2 una sola celda saturada llega a costar
                1 + 4 + 16 = 21 llamadas por vertical, y "saturada" solo
                significa que Google devolvió sus 20 resultados — lo normal en
                un centro denso, que es justo donde vale la pena barrer.
                Prometer un máximo acá sería prometer una factura que nadie
                puede garantizar. */}
            Es un <strong className="text-tinta">estimado, no un techo</strong>:
            donde Google devuelva su tope de 20 resultados la celda se parte en
            cuatro y se vuelve a consultar (hasta dos veces), así que cada zona
            densa multiplica sus llamadas. En densidad típica esto termina cerca
            de {formatoUsd(tanda.costoMaxUsd)}; en un centro muy denso, bastante
            más. El barrido se frena solo al doblar lo aprobado y te vuelve a
            preguntar.
          </p>
          <p className="mt-2 border-t border-hairline pt-2 text-tinta-40">
            Barrer solo le pregunta a Google qué negocios hay y los guarda acá.
            No contacta a nadie: escribirles o llamarlos es aparte, desde Zak.
          </p>
          <p className="mt-1">
            Este territorio lleva <strong className="text-tinta">{gastado}</strong>{" "}
            {gastado === 1 ? "consulta gastada" : "consultas gastadas"} ≈{" "}
            {formatoUsd(gastado * PRECIO_POR_LLAMADA_USD)}.
          </p>
        </div>

        {cruza && (
          <Banner variante="error">
            Este territorio se dibujó con el contorno cruzado: la zona que el
            trazo cubre dos veces cuenta como «fuera», así que esas teselas se
            le compran a Google igual pero sus resultados se descartan al
            guardarlos. El barrido puede terminar diciendo 100 % sobre un área
            que no censó entera.
          </Banner>
        )}
        {slugs.length === 0 && (
          <Banner>Marca al menos una vertical: sin verticales no hay nada que barrer.</Banner>
        )}
        {slugs.length > 0 && pendientes === 0 && (
          <Banner>
            Ya barriste todas estas verticales en este territorio. Reanudar no
            compraría nada nuevo.
          </Banner>
        )}

        {requiereMonto && (
          <div className="flex flex-col gap-1.5">
            <p id="monto-confirmar-ayuda" className="text-xs text-tinta-40">
              Esta tanda se pasa de lo gratis: escribe el monto exacto del
              botón de abajo para confirmar que lo viste antes de barrer.
            </p>
            <Field
              label="Monto a confirmar"
              error={
                escrito.length > 0 && !coincide
                  ? "No coincide con el monto de «Barrer y gastar» de abajo."
                  : undefined
              }
            >
              <Input
                value={escrito}
                onChange={(e) => setEscrito(e.target.value)}
                placeholder="US$ 0,00"
                inputMode="decimal"
              />
            </Field>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {ofrecerGratis && (
            <p className="text-xs text-tinta-40">
              El territorio queda a medias: lo que falte se puede barrer el
              mes que viene sin volver a pagar lo que ya se barrió acá.
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={onCerrar}>Cancelar</Button>
            {ofrecerGratis && (
              <Button
                onClick={() => onConfirmar(slugs, planGratis.length, FACTOR_TOPE_GRATIS)}
              >
                Barrer las {planGratis.length} gratis
              </Button>
            )}
            <Button
              variante="primaria"
              disabled={primarioDeshabilitado}
              aria-describedby={requiereMonto ? "monto-confirmar-ayuda" : undefined}
              onClick={() => onConfirmar(slugs, tanda.llamadas, FACTOR_TOPE_APROBADO)}
            >
              Barrer y gastar {formatoUsd(tanda.costoUsd)}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
