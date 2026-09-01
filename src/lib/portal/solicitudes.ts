// Solicitudes de la tienda del portal. Espejo del enum de supabase/portal.sql.
// La máquina de estados vive aquí (TS puro, testeada); la base solo garantiza
// con RLS que el cliente crea en 'nueva' y no muta nada después.

import type { Ciclo } from "@/lib/admin/cartera";

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
