import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Gate de /admin y /app (Next 16: proxy.ts reemplaza a middleware.ts).
 *
 * Hace dos cosas que nadie más puede hacer:
 * 1. Check optimista de sesión antes de renderizar nada protegido.
 * 2. Persistir los tokens refrescados de Supabase — los Server Components
 *    no pueden escribir cookies, así que sin esto la sesión muere cuando
 *    expira el access token.
 *
 * AUTENTICA, NO AUTORIZA: el rol (admin vs cliente) no está en el JWT a
 * propósito (vive en la tabla perfiles para aplicar al instante), así que
 * aquí solo se decide "¿hay sesión?". Un cliente que teclee /admin pasa el
 * proxy y lo expulsa verifySession() en la page. No es la única barrera:
 * cada page, server action y route handler vuelve a verificar (los layouts
 * no se re-renderizan al navegar), y RLS protege los datos aunque todo lo
 * demás falle.
 */

// Rutas de /app que se sirven SIN sesión (login, registro y el callback de
// OAuth/confirmación de correo — este último trae el code que crea la sesión).
const APP_PUBLICAS = new Set(["/app/login", "/app/registro", "/app/auth/callback"]);

// ⚠️ Portal de clientes APAGADO (decisión 2026-08-29): aún no es presentable.
// true = /app vuelve a servirse. El link «Mi Zakumi» de la landing vive en
// SiteShell.tsx — re-encender es este flag + descomentar ese item del nav.
const PORTAL_ABIERTO = false;

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims verifica la firma del JWT (local con JWT Signing Keys) y
  // dispara el refresh si el token expiró — por eso va ANTES de decidir.
  const { data } = await supabase.auth.getClaims();
  const haySesion = Boolean(data?.claims);
  const path = request.nextUrl.pathname;

  if (path.startsWith("/app")) {
    if (!PORTAL_ABIERTO) {
      return redirigirConCookies(request, response, "/");
    }
    const esPublica = APP_PUBLICAS.has(path);
    if (!haySesion && !esPublica) {
      return redirigirConCookies(request, response, "/app/login");
    }
    if (haySesion && (path === "/app/login" || path === "/app/registro")) {
      return redirigirConCookies(request, response, "/app");
    }
    return response;
  }

  const esLogin = path === "/admin/login";
  if (!haySesion && !esLogin) {
    return redirigirConCookies(request, response, "/admin/login");
  }
  if (haySesion && esLogin) {
    return redirigirConCookies(request, response, "/admin/prospeccion?tab=territorio");
  }
  return response;
}

/**
 * Redirect que conserva las cookies ya escritas en la respuesta: si el
 * refresh de tokens coincide con un redirect, los tokens nuevos no se
 * pueden perder.
 */
function redirigirConCookies(
  request: NextRequest,
  response: NextResponse,
  destino: string,
) {
  const url = request.nextUrl.clone();
  // `destino` puede traer query (`/admin/prospeccion?tab=territorio`) y
  // `url.pathname` la escaparía a `%3Ftab%3D…`: se separan a mano. Los
  // destinos sin query limpian la búsqueda heredada, que era de otra ruta.
  const [ruta, busqueda = ""] = destino.split("?");
  url.pathname = ruta;
  url.search = busqueda;
  const redirect = NextResponse.redirect(url);
  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export const config = {
  matcher: ["/admin/:path*", "/app/:path*"],
};
