// Las dos caras de "Encontrar clientes". Un SOLO parámetro en la URL (?tab=):
// dos parámetros pueden contradecirse entre sí, uno no. Mismo patrón que
// zak-caras.ts.

import { plural, type CaraDef } from "./caras";
import { estadoCenso, TOPE_LEADS } from "./negocios";

export type CaraProspeccion = "territorio" | "leads";

/** La cara a la que pertenece una pestaña. Desconocido cae a territorio: un
 * enlace viejo abre el mapa, nunca una pantalla en blanco. */
export function caraDe(tab: string | null | undefined): CaraProspeccion {
  return tab?.startsWith("leads") ? "leads" : "territorio";
}

export function pestanaInicial(cara: CaraProspeccion): string {
  return cara === "leads" ? "leads" : "territorio";
}

/**
 * Una cifra de la cabecera. `mas` = es un piso («900+»), no el total; `null` =
 * no se sabe (fallaron la lista y la cuenta) y se pinta «—», nunca un cero.
 */
export type Cifra = { n: number; mas: boolean } | null;

export function textoCifra(c: Cifra): string {
  return c === null ? "—" : `${c.n}${c.mas ? "+" : ""}`;
}

/** «1 lead», «900+ leads», «— leads». */
function conUnidad(c: Cifra, singular: string, pluralForm: string): string {
  return c !== null && c.n === 1 && !c.mas ? `1 ${singular}` : `${textoCifra(c)} ${pluralForm}`;
}

/**
 * Las cifras de la cabecera y de las caras: las cuentas exactas de la base
 * cuando llegaron. Si una falló, sale de los negocios cargados para el mapa, y
 * se marca como piso si esa lista pudo quedar recortada.
 */
export function cifrasCabecera(d: {
  cargados: number;
  sinWebCargados: number;
  total: number | null;
  sinWebTotal: number | null;
  /** Falló la consulta de los negocios cargados: lo cargado no dice nada. */
  fallaCargados: boolean;
}): { leads: Cifra; sinWeb: Cifra } {
  const completa = estadoCenso(d.cargados, d.total).tipo === "completo";
  const leads: Cifra =
    d.total !== null
      ? { n: d.total, mas: false }
      : d.fallaCargados
        ? null
        : { n: d.cargados, mas: d.cargados >= TOPE_LEADS };
  const sinWeb: Cifra =
    d.sinWebTotal !== null
      ? { n: d.sinWebTotal, mas: false }
      : d.fallaCargados
        ? null
        : { n: d.sinWebCargados, mas: !completa };
  return { leads, sinWeb };
}

/**
 * Las tarjetas de la cabecera con sus contadores vivos. `barriendo` marca la
 * cara de Territorio con un punto que late: desde Leads tiene que verse que
 * al otro lado se está gastando plata.
 */
export function carasProspeccion(d: {
  territorios: number;
  leads: Cifra;
  sinWeb: Cifra;
  barriendo: boolean;
}): CaraDef<CaraProspeccion>[] {
  return [
    {
      id: "territorio",
      label: "Territorio",
      detalle: `${plural(d.territorios, "territorio", "territorios")} · ${conUnidad(d.leads, "lead", "leads")}`,
      punto: d.barriendo ? { titulo: "Hay un barrido en curso", pulsa: true } : null,
    },
    {
      id: "leads",
      label: "Leads",
      detalle: `${conUnidad(d.leads, "lead", "leads")} · ${textoCifra(d.sinWeb)} sin web`,
      punto: null,
    },
  ];
}
