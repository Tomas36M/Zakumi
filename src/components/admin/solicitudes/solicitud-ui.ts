import type { EstadoSolicitud, OrigenSolicitud, Solicitud } from "@/lib/portal/solicitudes";
import type { TonoBadge } from "@/components/admin/ui/Badge";

export type PerfilResumen = {
  email: string | null;
  nombre: string | null;
  clienteId: string | null;
};

// El funnel de venta reusa la paleta del pipeline del CRM.
export const TONO_SOLICITUD: Record<EstadoSolicitud, TonoBadge> = {
  nueva: "nuevo",
  cotizada: "contactado",
  link_enviado: "respondido",
  pagada: "interesado",
  activa: "cliente",
  rechazada: "descartado",
};

// Solo las solicitudes que NO vienen del portal necesitan decir por dónde
// entraron — las del portal ya se identifican por tener perfil.
export const CANAL_SOLICITUD: Record<
  Exclude<OrigenSolicitud, "portal">,
  { label: string; tono: TonoBadge }
> = {
  voz: { label: "Llamada", tono: "contactado" },
  whatsapp: { label: "WhatsApp", tono: "respondido" },
};

/** Quién pide: solo las del portal tienen perfil que buscar; el resto trae
 * su propio contacto (quien llamó o escribió, no quien tiene cuenta). */
export function quienPide(s: Solicitud, perfil: PerfilResumen | undefined): string {
  if (s.origen === "portal") return perfil?.nombre || perfil?.email || "sin perfil";
  return [s.contacto_nombre, s.contacto_telefono].filter(Boolean).join(" · ") || "sin contacto";
}
