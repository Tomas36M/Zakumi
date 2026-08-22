"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "./dal";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PerfilBuscado = {
  userId: string;
  email: string | null;
  nombre: string | null;
  clienteId: string | null;
};

/** Busca cuentas del portal por correo (para vincularlas a un cliente). */
export async function buscarPerfiles(
  q: string,
): Promise<{ perfiles: PerfilBuscado[] } | { error: string }> {
  const { supabase } = await verifySession();

  const limpio = typeof q === "string" ? q.trim() : "";
  if (limpio.length < 3) return { error: "Escribe al menos 3 caracteres." };

  const { data, error } = await supabase
    .from("perfiles")
    .select("user_id, email, nombre, cliente_id")
    .ilike("email", `%${limpio}%`)
    .eq("rol", "cliente")
    .limit(10);
  if (error) {
    console.error("[buscarPerfiles]", error.message);
    return { error: "No se pudo buscar." };
  }
  return {
    perfiles: (data ?? []).map((p) => ({
      userId: p.user_id as string,
      email: (p.email as string | null) ?? null,
      nombre: (p.nombre as string | null) ?? null,
      clienteId: (p.cliente_id as string | null) ?? null,
    })),
  };
}

/**
 * Promueve o degrada una cuenta (gestión de equipo en /admin/equipo).
 * Un admin ve TODO el CRM, así que promover es una decisión seria; el
 * trigger perfiles_proteger de la base garantiza que solo un admin puede
 * ejecutar este cambio, y aquí se bloquea la auto-degradación para no
 * dejar el panel sin admins por accidente.
 */
export async function cambiarRolPerfil(
  userId: string,
  rol: "admin" | "cliente",
): Promise<{ error: string | null }> {
  const sesion = await verifySession();

  if (typeof userId !== "string" || !UUID.test(userId)) {
    return { error: "Cuenta no válida." };
  }
  if (rol !== "admin" && rol !== "cliente") {
    return { error: "Rol no válido." };
  }
  if (rol === "cliente" && userId === sesion.userId) {
    return { error: "No puedes quitarte el rol a ti mismo — pídeselo a otro admin." };
  }

  const { error } = await sesion.supabase
    .from("perfiles")
    .update({ rol })
    .eq("user_id", userId);
  if (error) {
    console.error("[cambiarRolPerfil]", error.message);
    return { error: "No se pudo cambiar el rol." };
  }

  revalidatePath("/admin/equipo");
  return { error: null };
}

/**
 * Vincula (o desvincula, con clienteId null) una cuenta del portal a un
 * cliente de la cartera. Con el vínculo, esa cuenta ve SUS productos, pagos
 * y bot en /app — por eso es una decisión del admin, nunca automática.
 */
export async function vincularPerfilACliente(
  userId: string,
  clienteId: string | null,
): Promise<{ error: string | null }> {
  const { supabase } = await verifySession();

  if (typeof userId !== "string" || !UUID.test(userId)) {
    return { error: "Cuenta no válida." };
  }
  if (clienteId !== null && (typeof clienteId !== "string" || !UUID.test(clienteId))) {
    return { error: "Cliente no válido." };
  }

  const { error } = await supabase
    .from("perfiles")
    .update({ cliente_id: clienteId })
    .eq("user_id", userId);
  if (error) {
    console.error("[vincularPerfilACliente]", error.message);
    return { error: "No se pudo guardar el vínculo." };
  }

  revalidatePath("/admin/clientes");
  if (clienteId) revalidatePath(`/admin/clientes/${clienteId}`);
  return { error: null };
}
