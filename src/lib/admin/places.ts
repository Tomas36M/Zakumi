import type { TipoTelefono } from "./negocios";
import { normalizarTelefonoCO } from "./telefono";

export type ComponenteDireccion = {
  longText?: string;
  types?: string[];
};

// Shape del place de la Places API (New) — solo los campos del FieldMask
// que pide el route handler.
export type PlaceApi = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  websiteUri?: string;
  types?: string[];
  businessStatus?: string;
  addressComponents?: ComponenteDireccion[];
};

// Lo que ve el panel por cada resultado de búsqueda.
export type ResultadoPlace = {
  placeId: string;
  nombre: string;
  direccion: string | null;
  lat: number;
  lng: number;
  categoria: string | null;
  rating: number | null;
  sitioWeb: string | null;
  telefono: string | null;
  tipoTelefono: TipoTelefono;
  ciudad: string | null;
  operativo: boolean;
  yaImportado: boolean;
};

// Types de Google que no dicen nada del negocio.
const TYPES_GENERICOS = new Set(["point_of_interest", "establishment"]);

export function placeANegocio(place: PlaceApi): ResultadoPlace {
  const { telefono, tipo } = normalizarTelefonoCO(
    place.internationalPhoneNumber ?? place.nationalPhoneNumber,
  );
  const categoria = place.types?.find((t) => !TYPES_GENERICOS.has(t)) ?? null;

  return {
    placeId: place.id,
    nombre: place.displayName?.text ?? "(sin nombre)",
    direccion: place.formattedAddress ?? null,
    lat: place.location?.latitude ?? 0,
    lng: place.location?.longitude ?? 0,
    categoria,
    rating: place.rating ?? null,
    sitioWeb: place.websiteUri ?? null,
    telefono,
    tipoTelefono: tipo,
    ciudad: localidadDe(place.addressComponents),
    operativo: (place.businessStatus ?? "OPERATIONAL") === "OPERATIONAL",
    yaImportado: false,
  };
}

/** El municipio tal como lo manda Google. En Colombia `locality` es el
 * municipio; algunos rurales solo traen `administrative_area_level_2`.
 * Sin adivinanzas por substring: si Google no lo dice, es null. */
export function localidadDe(
  componentes: ComponenteDireccion[] | undefined,
): string | null {
  if (!componentes || componentes.length === 0) return null;
  const porTipo = (t: string) =>
    componentes.find((c) => c.types?.includes(t))?.longText ?? null;
  return porTipo("locality") ?? porTipo("administrative_area_level_2") ?? null;
}

/** Solo URLs navegables: nada de javascript: ni esquemas raros en los href.
 *
 * Vive acá y no en actions.ts porque los DOS escritores de `negocios.sitio_web`
 * lo necesitan —la importación manual y el barrido de territorios, que hoy
 * mete muchísimas más filas— y una copia por escritor es exactamente cómo se
 * pierde el invariante: el valor se pinta tal cual en un `<a href>` de
 * NegociosView y FichaNegocio. Una sola definición, un solo invariante.
 * (Además actions.ts es "use server": no puede exportar funciones síncronas.) */
export function urlHttpONull(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  return /^https?:\/\/\S+$/i.test(limpio) ? limpio : null;
}

/** Sin teléfono no hay venta: el mapa solo muestra negocios contactables. */
export function soloConTelefono(resultados: ResultadoPlace[]): ResultadoPlace[] {
  return resultados.filter((r) => r.telefono !== null);
}

/** Ciudad libre: cualquier texto no vacío, o null. Con territorios ya no hay
 * un enum de municipios que validar — el dato honesto es el que trae Google (o
 * el que escribe el humano), recortado a un largo razonable.
 *
 * Vive acá por lo mismo que `urlHttpONull`: la usan los dos escritores de
 * `negocios.ciudad` y actions.ts es "use server" (no puede exportar funciones
 * síncronas). Una copia por escritor es cómo dos grafías de una ciudad acaban
 * siendo dos entradas del filtro de leads. */
export function ciudadLimpia(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  return limpio ? limpio.slice(0, 120) : null;
}

/** Una fila de `negocios` lista para el upsert, tal como la escriben los DOS
 * escritores de la tabla. */
export type FilaNegocio = {
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  lat: number;
  lng: number;
  categoria: string | null;
  rating: number | null;
  sitio_web: string | null;
  telefono: string | null;
  tipo_telefono: TipoTelefono;
  google_place_id: string;
  fuente: "places";
  territorio_id: string | null;
};

/**
 * Un `ResultadoPlace` convertido en fila de `negocios`. UNA definición para los
 * dos escritores: la importación manual (25 filas por tanda) y el barrido de
 * territorios (miles).
 *
 * Estaba duplicada, y ya había divergido: la importación pasaba la ciudad por
 * `ciudadLimpia` y el barrido —el escritor PRINCIPAL— la metía cruda, así que
 * " Madrid " y "Madrid" acababan siendo dos entradas distintas del filtro de
 * ciudades de la lista de leads.
 *
 * Lo que garantiza, por escrito, porque cada punto es una fila perdida o una
 * pantalla rota:
 *   · `nombre` cabe en el check `length between 1 and 300` de la base. UN
 *     nombre largo de Google tumbaba el upsert ENTERO: tesela cobrada y los
 *     otros 19 negocios perdidos.
 *   · `sitio_web` se pinta tal cual en un `<a href>` de NegociosView y
 *     FichaNegocio: pasa por `urlHttpONull` o no pasa.
 *   · el teléfono se re-normaliza SIEMPRE. Del barrido llega ya normalizado y
 *     la función es idempotente; de la importación llega lo que mandó el
 *     cliente, y del cliente no nos fiamos.
 */
export function filaDeNegocio(
  r: ResultadoPlace,
  territorioId: string | null,
): FilaNegocio {
  const { telefono, tipo } = normalizarTelefonoCO(r.telefono);
  return {
    nombre: r.nombre.trim().slice(0, 300) || "(sin nombre)",
    direccion: typeof r.direccion === "string" ? r.direccion : null,
    ciudad: ciudadLimpia(r.ciudad),
    lat: r.lat,
    lng: r.lng,
    categoria: typeof r.categoria === "string" ? r.categoria : null,
    rating: typeof r.rating === "number" ? r.rating : null,
    sitio_web: urlHttpONull(r.sitioWeb),
    telefono,
    tipo_telefono: tipo,
    google_place_id: r.placeId,
    fuente: "places",
    territorio_id: territorioId,
  };
}

/** Marca los resultados cuyo placeId ya está en la base (dedupe visual). */
export function marcarImportados(
  resultados: ResultadoPlace[],
  existentes: ReadonlySet<string>,
): ResultadoPlace[] {
  return resultados.map((r) =>
    existentes.has(r.placeId) ? { ...r, yaImportado: true } : r,
  );
}
