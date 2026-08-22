import { redirect } from "next/navigation";
import { getSesion, type Sesion } from "@/lib/auth/sesion";

/**
 * Primera línea de CADA page del portal y de CADA server action — en Next 16
 * los layouts no se re-renderizan al navegar, así que un check en el layout
 * no protege nada. Admite ambos roles: un admin también puede mirar /app.
 */
export async function verifySesionPortal(): Promise<Sesion> {
  const sesion = await getSesion();
  if (!sesion) redirect("/app/login");
  return sesion;
}

export type ProductoBot = {
  id: string;
  nombre: string;
  instancia_id: string;
};

/**
 * Bots contratados y activos del cliente, con instancia vinculada válida.
 * La query ya viene filtrada por RLS; el filtro explícito por cliente_id es
 * defensa en profundidad (y hace la intención legible).
 */
export async function botsDelCliente(sesion: Sesion): Promise<ProductoBot[]> {
  if (!sesion.clienteId) return [];
  const { data } = await sesion.supabase
    .from("productos_contratados")
    .select("id, nombre, instancia_id")
    .eq("cliente_id", sesion.clienteId)
    .eq("tipo", "bot")
    .eq("activo", true)
    .not("instancia_id", "is", null);

  // instancia_id es referencia blanda (texto): solo pasan las numéricas.
  return ((data ?? []) as ProductoBot[]).filter((p) =>
    /^\d+$/.test(p.instancia_id),
  );
}

/** El bot principal del cliente (v1: un bot por cliente). */
export async function botDelCliente(sesion: Sesion): Promise<ProductoBot | null> {
  return (await botsDelCliente(sesion))[0] ?? null;
}

/**
 * Puerta de los route handlers /app/api/bot/[id]/*: la instancia pedida
 * tiene que ser de un bot del cliente. Devuelve el id numérico o null
 * (el handler responde 404 — no se revela si la instancia existe).
 */
export async function instanciaDelCliente(
  sesion: Sesion,
  instanciaId: string,
): Promise<number | null> {
  if (!/^\d+$/.test(instanciaId)) return null;
  const bots = await botsDelCliente(sesion);
  return bots.some((b) => b.instancia_id === instanciaId)
    ? Number(instanciaId)
    : null;
}
