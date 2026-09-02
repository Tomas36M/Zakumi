// Cliente service-role de Supabase — la excepción a "la app solo usa
// anon + RLS", reservada a los endpoints server-to-server que no tienen
// sesión de usuario:
//   1. /api/voz/webhook — solo invoca la RPC registrar_llamada_voz.
//   2. /api/zak/llamar — despacha con el agente es_zak (despacharLlamadaZak:
//      lee agentes_voz/llamadas_voz y avanza negocios nuevo→contactado).
//   3. /api/zak/solicitud — registra la solicitud del bot de WhatsApp
//      (registrarSolicitudEntrante: inserta, agenda y avisa).
//
// SOLO SERVIDOR y solo desde esas rutas. No importar desde ningún otro
// sitio: cualquier otra escritura va por la sesión del usuario.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseService(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[voz] faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    return null;
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
