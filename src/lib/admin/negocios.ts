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

/**
 * Cuántos negocios baja la pantalla de prospección como máximo.
 *
 * Sin tope, `select("*")` sobre `negocios` trae la tabla entera, la serializa
 * al cliente, pinta una fila por negocio en la lista y un marcador por negocio
 * en el mapa. Antes de los territorios la tabla crecía de a 25 filas importadas
 * a mano; un barrido de un territorio mete miles de una sola tanda.
 *
 * **900 y no 1.000 ni 5.000, y el número importa.** El proyecto de Supabase
 * tiene *Max rows* (Settings → API) en su valor por defecto de **1.000**:
 * PostgREST recorta ahí CUALQUIER consulta, y lo hace en silencio —devuelve
 * 1.000 filas con `error === null`—. Un `.limit()` por encima de ese techo no
 * hace nada: quien recortaría sería el servidor, sin decirlo. Con 900, el que
 * manda es este número, que es el que está escrito acá. Subirlo sin subir
 * antes *Max rows* en la consola de Supabase no cambia nada.
 *
 * Y el tope se DICE (ver `estadoCenso`). La cuenta real viene por separado
 * (`count: "exact"` con `head: true`, que no trae filas y NO le afecta el
 * techo del proyecto) y la vista compara contra las filas que de verdad
 * llegaron, NO contra esta constante — así el aviso sale igual si algún día
 * quien recorta es PostgREST.
 */
export const TOPE_LEADS = 900;

/** Qué tan completa está la lista de negocios que llegó a la pantalla:
 * `completo` cuando no hay indicio de recorte, `recortado` cuando la cuenta
 * exacta del servidor confirma que faltan filas (y dice cuántas hay en total),
 * y `recortado_sin_conteo` cuando esa cuenta exacta FALLÓ pero la lista llegó
 * justo al `TOPE_LEADS` — la única señal que queda de que probablemente hay
 * más, sin poder decir cuántas.
 *
 * El caso `recortado_sin_conteo` es el que un fallo aislado de la consulta de
 * `count` dejaba pasar en silencio: `negociosTotal` salía `null`, la
 * comparación `total > length` se volvía `false` (nunca `null > n`), y la
 * cabecera anunciaba el tope como si fuera el censo completo — exactamente el
 * fallo que el tope y su aviso existen para hacer imposible. */
export type EstadoCenso =
  | { tipo: "completo" }
  | { tipo: "recortado"; total: number }
  | { tipo: "recortado_sin_conteo" };

export function estadoCenso(cargados: number, total: number | null): EstadoCenso {
  if (total !== null) {
    return total > cargados ? { tipo: "recortado", total } : { tipo: "completo" };
  }
  // Sin cuenta exacta, la única pista es si la lista tocó el tope: si trajo
  // menos, no hay tope que la haya podido morder y no hay nada que avisar.
  return cargados >= TOPE_LEADS ? { tipo: "recortado_sin_conteo" } : { tipo: "completo" };
}
