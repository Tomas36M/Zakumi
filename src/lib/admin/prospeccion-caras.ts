// Las dos caras de "Encontrar clientes". Un SOLO parámetro en la URL (?tab=):
// dos parámetros pueden contradecirse entre sí, uno no. Mismo patrón que
// zak-caras.ts.

export type CaraProspeccion = "territorio" | "leads";

/** La cara a la que pertenece una pestaña. Desconocido cae a territorio: un
 * enlace viejo abre el mapa, nunca una pantalla en blanco. */
export function caraDe(tab: string | null | undefined): CaraProspeccion {
  return tab?.startsWith("leads") ? "leads" : "territorio";
}

export function pestanaInicial(cara: CaraProspeccion): string {
  return cara === "leads" ? "leads" : "territorio";
}
