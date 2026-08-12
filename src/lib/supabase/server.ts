import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route
 * Handlers. Siempre con la anon key + el token del usuario en cookies:
 * la service-role key NO se usa en la app — RLS es la barrera final.
 */
export async function createSupabaseServer() {
  const cookieStore = await cookies(); // Next 16: cookies() es async

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Un Server Component no puede escribir cookies durante el
            // render; el refresh de tokens lo persiste src/proxy.ts.
          }
        },
      },
    },
  );
}
