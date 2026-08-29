// Tipos y constantes del CRM de prospección. Espejo de los enums de
// supabase/schema.sql — si cambia uno, cambia el otro.

export type Ciudad = "madrid" | "ubate" | "bogota" | "otra";

export type EstadoNegocio =
  | "nuevo"
  | "contactado"
  | "respondido"
  | "interesado"
  | "cliente"
  | "descartado";

export type TipoTelefono = "movil" | "fijo" | "desconocido";

export type FuenteNegocio = "places" | "manual";

export type Negocio = {
  id: string;
  nombre: string;
  direccion: string | null;
  ciudad: Ciudad;
  lat: number;
  lng: number;
  categoria: string | null;
  rating: number | null;
  sitio_web: string | null;
  telefono: string | null;
  tipo_telefono: TipoTelefono;
  google_place_id: string | null;
  fuente: FuenteNegocio;
  estado: EstadoNegocio;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
};

export type Nota = {
  id: string;
  negocio_id: string;
  texto: string;
  automatica: boolean;
  autor: string | null;
  created_at: string;
};

export const ESTADOS: readonly { valor: EstadoNegocio; label: string }[] = [
  { valor: "nuevo", label: "Nuevo" },
  { valor: "contactado", label: "Contactado" },
  { valor: "respondido", label: "Respondió" },
  { valor: "interesado", label: "Interesado" },
  { valor: "cliente", label: "Cliente" },
  { valor: "descartado", label: "Descartado" },
] as const;

/** El label humano de un estado del pipeline (única fuente: ESTADOS). */
export function labelEstado(estado: EstadoNegocio): string {
  return ESTADOS.find((e) => e.valor === estado)?.label ?? estado;
}

// Centros y radios de sesgo para la búsqueda de Places y los chips del mapa.
export const CIUDADES: readonly {
  valor: Exclude<Ciudad, "otra">;
  label: string;
  centro: { lat: number; lng: number };
  radio: number;
}[] = [
  { valor: "madrid", label: "Madrid", centro: { lat: 4.7326, lng: -74.2642 }, radio: 8000 },
  { valor: "ubate", label: "Ubaté", centro: { lat: 5.3097, lng: -73.8156 }, radio: 8000 },
  { valor: "bogota", label: "Bogotá", centro: { lat: 4.711, lng: -74.0721 }, radio: 20000 },
] as const;
