import { cache } from "react";
import { createSupabaseServer } from "@/lib/supabase/server";

export type Rol = "admin" | "cliente";

export type Sesion = {
  userId: string;
  email: string | undefined;
  /** Del perfil (tabla perfiles). Sin fila de perfil = cliente sin vínculo. */
  rol: Rol;
  /** Vínculo a la cartera (clientes.id) — lo asigna solo el admin. */
  clienteId: string | null;
  nombre: string | null;
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>;
};

/**
 * Sesión del request actual, deduplicada con React.cache(): por más pages,
 * actions y componentes que la pidan, getClaims + la lectura del perfil
 * corren una sola vez por request. Devuelve null si no hay sesión válida.
 *
 * El rol NO va en el JWT a propósito: leerlo de la tabla hace que vincular
 * o degradar una cuenta aplique al instante, sin esperar el refresh del
 * token (~1 h). La barrera de datos sigue siendo RLS aunque esto fallara.
 */
export const getSesion = cache(async (): Promise<Sesion | null> => {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  const userId = data.claims.sub as string;

  // Si el trigger de signup aún no creó el perfil (carrera de milisegundos),
  // se trata como cliente sin vínculo — nunca como admin.
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol, cliente_id, nombre")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    userId,
    email: data.claims.email as string | undefined,
    rol: perfil?.rol === "admin" ? "admin" : "cliente",
    clienteId: (perfil?.cliente_id as string | null) ?? null,
    nombre: (perfil?.nombre as string | null) ?? null,
    supabase,
  };
});
