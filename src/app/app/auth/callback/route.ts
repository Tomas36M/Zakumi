import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth/sesion";

/**
 * Aterrizaje del OAuth de Google Y del link de confirmación de correo.
 * Es un route handler a propósito: exchangeCodeForSession necesita escribir
 * cookies, cosa que un Server Component no puede (ver lib/supabase/server).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/app";
  // Solo paths internos: nada de open-redirect vía ?next=https://…
  const destinoPedido = next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Cada rol a su casa (el rol vive en perfiles, no en el JWT).
      const sesion = await getSesion();
      const destino =
        sesion?.rol === "admin" ? "/admin/prospeccion?tab=territorio" : destinoPedido;
      return NextResponse.redirect(new URL(destino, url.origin));
    }
    console.error("[auth/callback]", error.message);
  }

  return NextResponse.redirect(new URL("/app/login?error=callback", url.origin));
}
