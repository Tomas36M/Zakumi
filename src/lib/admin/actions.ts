"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { verifySession } from "./dal";

export type EstadoLogin = { error: string | null };

/**
 * Inicia sesión con email + contraseña. No hay registro: las cuentas se
 * crean a mano en el dashboard de Supabase (signup público desactivado).
 */
export async function login(
  _prev: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Escribe correo y contraseña." };
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Mensaje genérico a propósito: no revelar si el correo existe.
    return { error: "Credenciales inválidas." };
  }

  redirect("/admin/mapa");
}

export async function logout(): Promise<void> {
  // Como toda server action, es un endpoint público: sesión primero.
  const { supabase } = await verifySession();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
