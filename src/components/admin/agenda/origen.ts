import type { OrigenSolicitud } from "@/lib/portal/solicitudes";
import type { TonoBadge } from "@/components/admin/ui/Badge";

// Mismo criterio de color que el resto del panel: voz/whatsapp comparten la
// paleta del pipeline de negocios (TONO_DIRECCION en LlamadasVoz.tsx).
export const TONO_ORIGEN: Record<OrigenSolicitud, TonoBadge> = {
  voz: "contactado",
  whatsapp: "respondido",
  portal: "neutro",
};

export const LABEL_ORIGEN: Record<OrigenSolicitud, string> = {
  voz: "Voz",
  whatsapp: "WhatsApp",
  portal: "Portal",
};
