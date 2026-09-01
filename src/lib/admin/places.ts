import type { TipoTelefono } from "./negocios";
import { normalizarTelefonoCO } from "./telefono";

export type ComponenteDireccion = {
  longText?: string;
  shortText?: string;
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

/** Sin teléfono no hay venta: el mapa solo muestra negocios contactables. */
export function soloConTelefono(resultados: ResultadoPlace[]): ResultadoPlace[] {
  return resultados.filter((r) => r.telefono !== null);
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
