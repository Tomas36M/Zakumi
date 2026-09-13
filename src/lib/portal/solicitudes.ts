// Solicitudes de la tienda del portal. Espejo del enum de supabase/portal.sql.
// La máquina de estados vive aquí (TS puro, testeada); la base solo garantiza
// con RLS que el cliente crea en 'nueva' y no muta nada después.

import type { Ciclo } from "@/lib/admin/cartera";
import { normalizarTelefonoCO } from "@/lib/admin/telefono";
import { servicioDelSlug, SLUG_POR_DEFINIR } from "@/lib/catalogo";

export type EstadoSolicitud =
  | "nueva"
  | "cotizada"
  | "link_enviado"
  | "pagada"
  | "activa"
  | "rechazada";

/** De dónde salió la solicitud. 'portal' = la tienda; el resto, Zak. */
export type OrigenSolicitud = "portal" | "voz" | "whatsapp";

export type Solicitud = {
  id: string;
  /** null cuando la solicitud NO viene del portal (llamada o WhatsApp). */
  user_id: string | null;
  servicio_slug: string;
  mensaje: string | null;
  estado: EstadoSolicitud;
  cotizacion_monto: number | null;
  cotizacion_moneda: string;
  cotizacion_ciclo: Ciclo | null;
  cotizacion_nota: string | null;
  link_pago: string | null;
  producto_id: string | null;
  created_at: string;
  updated_at: string;

  // ---- Solicitudes entrantes (voz / WhatsApp) ----
  origen: OrigenSolicitud;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  contacto_email: string | null;
  llamada_id: string | null;
  conversacion: string | null;
  clave_origen: string | null;
  cita_inicio: string | null;
  cita_fin: string | null;
  cita_meet_url: string | null;
  cita_evento_id: string | null;
  cita_link_google: string | null;
  cita_texto_crudo: string | null;
};

/** Orden del ciclo de vida; labels pensados para el CLIENTE. */
export const ESTADOS_SOLICITUD: readonly {
  valor: EstadoSolicitud;
  label: string;
  descripcion: string;
}[] = [
  { valor: "nueva", label: "Recibida", descripcion: "Estamos revisando tu solicitud." },
  { valor: "cotizada", label: "Cotizada", descripcion: "Ya tiene precio — pronto te llega el link de pago." },
  { valor: "link_enviado", label: "Lista para pagar", descripcion: "Paga con el link y te activamos el servicio." },
  { valor: "pagada", label: "Pago confirmado", descripcion: "Recibimos tu pago; estamos activando." },
  { valor: "activa", label: "Activa", descripcion: "El servicio está funcionando." },
  { valor: "rechazada", label: "No procede", descripcion: "Esta solicitud no siguió adelante." },
] as const;

/**
 * nueva → cotizada → link_enviado → pagada → activa.
 * link_enviado → activa existe para el paso único del admin "confirmar pago
 * y activar" (la pasarela integrada usará 'pagada' como intermedio, v2).
 * rechazada alcanzable desde cualquier estado no terminal.
 */
const TRANSICIONES: Record<EstadoSolicitud, readonly EstadoSolicitud[]> = {
  nueva: ["cotizada", "rechazada"],
  cotizada: ["link_enviado", "rechazada"],
  link_enviado: ["pagada", "activa", "rechazada"],
  pagada: ["activa", "rechazada"],
  activa: [],
  rechazada: [],
};

export function puedeTransicionar(de: EstadoSolicitud, a: EstadoSolicitud): boolean {
  return TRANSICIONES[de]?.includes(a) ?? false;
}

export function esTerminal(estado: EstadoSolicitud): boolean {
  return TRANSICIONES[estado].length === 0;
}

/** Estados "en curso": bloquean una segunda solicitud del mismo servicio. */
export const ESTADOS_EN_CURSO: readonly EstadoSolicitud[] = [
  "nueva",
  "cotizada",
  "link_enviado",
  "pagada",
];

export function labelEstado(estado: EstadoSolicitud): string {
  return ESTADOS_SOLICITUD.find((e) => e.valor === estado)?.label ?? estado;
}

/** Lo que el panel puede editar de una solicitud a mano. */
export type CambiosSolicitud = {
  contacto_nombre?: string | null;
  contacto_telefono?: string | null;
  contacto_email?: string | null;
  servicio_slug?: string;
  mensaje?: string | null;
};

const TOPE_NOMBRE = 200;
const TOPE_EMAIL = 200;
const TOPE_MENSAJE = 2000;

function texto(v: string | null | undefined, tope: number): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t.slice(0, tope);
}

/**
 * Whitelist y validación de `actualizarSolicitud`, pura para probarla:
 * - el teléfono se normaliza (la columna no tiene CHECK de formato) y NO
 *   puede quedar vacío en una solicitud sin cuenta del portal
 *   (`solicitudes_identifica_chk`: cuenta o teléfono, uno de los dos);
 * - el servicio tiene que existir en el catálogo (o ser «por definir») y
 *   no se cambia cuando ya hay un producto contratado con él.
 */
export function validarCambiosSolicitud(
  cambios: CambiosSolicitud,
  sol: Pick<Solicitud, "user_id" | "producto_id">,
): { fila: Record<string, unknown> } | { error: string } {
  const fila: Record<string, unknown> = {};

  if ("contacto_nombre" in cambios) fila.contacto_nombre = texto(cambios.contacto_nombre, TOPE_NOMBRE);

  if ("contacto_telefono" in cambios) {
    const bruto = texto(cambios.contacto_telefono, 40);
    if (bruto === null) {
      if (sol.user_id === null) {
        return { error: "Una solicitud de llamada o WhatsApp necesita teléfono de contacto." };
      }
      fila.contacto_telefono = null;
    } else {
      const { telefono } = normalizarTelefonoCO(bruto);
      if (telefono === null) return { error: "Ese teléfono no se entiende. Usa 10 dígitos o +57…" };
      fila.contacto_telefono = telefono;
    }
  }

  if ("contacto_email" in cambios) {
    const email = texto(cambios.contacto_email, TOPE_EMAIL);
    if (email !== null && !email.includes("@")) return { error: "Ese correo no se entiende." };
    fila.contacto_email = email;
  }

  if ("servicio_slug" in cambios) {
    const slug = (cambios.servicio_slug ?? "").trim();
    if (slug !== SLUG_POR_DEFINIR && !servicioDelSlug(slug)) {
      return { error: "Ese servicio no está en el catálogo." };
    }
    if (sol.producto_id) {
      return { error: "Ya tiene un producto contratado: el servicio no se cambia." };
    }
    fila.servicio_slug = slug;
  }

  if ("mensaje" in cambios) fila.mensaje = texto(cambios.mensaje, TOPE_MENSAJE);

  return { fila };
}
