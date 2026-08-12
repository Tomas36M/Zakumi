import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

export type Sesion = {
  userId: string;
  email: string | undefined;
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>;
};

/**
 * Sesión del request actual, deduplicada con React.cache(): por más pages,
 * actions y componentes que la pidan, getClaims corre una sola vez por
 * request. Devuelve null si no hay sesión válida.
 */
export const getSesion = cache(async (): Promise<Sesion | null> => {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  return {
    userId: data.claims.sub as string,
    email: data.claims.email as string | undefined,
    supabase,
  };
});

/**
 * Primera línea de CADA page del panel y de CADA server action — en Next 16
 * los layouts no se re-renderizan al navegar, así que un check en el layout
 * no protege nada. El route handler usa getSesion() y responde 401.
 */
export async function verifySession(): Promise<Sesion> {
  const sesion = await getSesion();
  if (!sesion) redirect("/admin/login");
  return sesion;
}
