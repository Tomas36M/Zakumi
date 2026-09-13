// Las dos caras de "Encontrar clientes". Un SOLO parámetro en la URL (?tab=):
// dos parámetros pueden contradecirse entre sí, uno no. Mismo patrón que
// zak-caras.ts.

import { plural, type CaraDef } from "./caras";

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
 * Las tarjetas de la cabecera con sus contadores vivos. `barriendo` marca la
 * cara de Territorio con un punto que late: desde Leads tiene que verse que
 * al otro lado se está gastando plata.
 */
export function carasProspeccion(d: {
  territorios: number;
  leads: number;
  sinWeb: number;
  barriendo: boolean;
}): CaraDef<CaraProspeccion>[] {
  return [
    {
      id: "territorio",
      label: "Territorio",
      detalle: `${plural(d.territorios, "territorio", "territorios")} · ${plural(d.leads, "lead", "leads")}`,
      punto: d.barriendo ? { titulo: "Hay un barrido en curso", pulsa: true } : null,
    },
    {
      id: "leads",
      label: "Leads",
      detalle: `${plural(d.leads, "lead", "leads")} · ${d.sinWeb} sin web`,
      punto: null,
    },
  ];
}
