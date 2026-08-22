// Cliente service-role de Supabase — LA EXCEPCIÓN ÚNICA a "la app solo usa
// anon + RLS". Existe porque el webhook post-call de ElevenLabs no tiene
// sesión de usuario, y lo ÚNICO que se hace con él es invocar la RPC
// registrar_llamada_voz (SECURITY DEFINER, grant solo a service_role).
//
// SOLO SERVIDOR y solo desde src/app/api/voz/webhook. No importar desde
// ningún otro sitio: cualquier otra escritura va por la sesión del usuario.

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
