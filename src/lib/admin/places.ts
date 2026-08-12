import type { Ciudad, TipoTelefono } from "./negocios";
import { normalizarTelefonoCO } from "./telefono";

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
  ciudad: Ciudad;
  operativo: boolean;
  yaImportado: boolean;
};

// Types de Google que no dicen nada del negocio.
const TYPES_GENERICOS = new Set(["point_of_interest", "establishment"]);

export function placeANegocio(
  place: PlaceApi,
  sesgo?: Exclude<Ciudad, "otra">,
): ResultadoPlace {
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
    ciudad: inferirCiudad(place.formattedAddress ?? null, sesgo),
    operativo: (place.businessStatus ?? "OPERATIONAL") === "OPERATIONAL",
    yaImportado: false,
  };
}

/**
 * Ciudad a partir de la dirección; si no aparece ninguna, cae al sesgo de la
 * búsqueda y por último a "otra". regionCode=CO en el handler ya evita el
 * "Madrid, España".
 */
export function inferirCiudad(
  direccion: string | null,
  sesgo?: Exclude<Ciudad, "otra">,
): Ciudad {
  if (direccion) {
    const plana = direccion
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (plana.includes("ubate")) return "ubate";
    if (plana.includes("madrid")) return "madrid";
    if (plana.includes("bogota")) return "bogota";
  }
  return sesgo ?? "otra";
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
