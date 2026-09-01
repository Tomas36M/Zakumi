// Tipos y constantes del CRM de prospección. Espejo de los enums de
// supabase/schema.sql — si cambia uno, cambia el otro.

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
  ciudad: string | null;
  lat: number;
  lng: number;
  categoria: string | null;
  rating: number | null;
  sitio_web: string | null;
  telefono: string | null;
  tipo_telefono: TipoTelefono;
  google_place_id: string | null;
  territorio_id: string | null;
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

/** Las ciudades que existen en la base, para armar el filtro de la lista de
 * leads. Antes era una constante de tres municipios; con territorios libres la
 * única fuente honesta son los datos. */
export function ciudadesDe(negocios: readonly Negocio[]): string[] {
  const vistas = new Set<string>();
  for (const n of negocios) {
    if (n.ciudad) vistas.add(n.ciudad);
  }
  return [...vistas].sort((a, b) => a.localeCompare(b, "es"));
}
