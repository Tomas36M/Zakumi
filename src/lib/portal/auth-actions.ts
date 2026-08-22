"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth/sesion";
import { verifySesionPortal } from "./dal";

export type EstadoAuth = { error: string | null; aviso: string | null };

/** Origen real del request (dev y prod) con fallback al dominio canónico. */
async function origen(): Promise<string> {
  const h = await headers();
  return (
    h.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://zakumistudio.com"
  );
}

export async function loginPortal(
  _prev: EstadoAuth,
  formData: FormData,
): Promise<EstadoAuth> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Escribe correo y contraseña.", aviso: null };
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Mensaje genérico a propósito: no revelar si el correo existe.
    return { error: "Credenciales inválidas.", aviso: null };
  }

  // Cada rol a su casa: el admin que entre por /app/login va al panel.
  const sesion = await getSesion();
  redirect(sesion?.rol === "admin" ? "/admin/mapa" : "/app");
}

export async function registroPortal(
  _prev: EstadoAuth,
  formData: FormData,
): Promise<EstadoAuth> {
  const nombre = String(formData.get("nombre") ?? "").trim().slice(0, 200);
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Escribe correo y contraseña.", aviso: null };
  }
  if (password.length < 8) {
    return { error: "La contraseña necesita al menos 8 caracteres.", aviso: null };
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await origen()}/app/auth/callback?next=/app`,
      // El trigger crear_perfil() lee full_name (mismo campo que trae Google).
      data: nombre ? { full_name: nombre } : undefined,
    },
  });

  if (error) {
    console.error("[registroPortal]", error.message);
    return { error: "No se pudo crear la cuenta. Intenta de nuevo.", aviso: null };
  }

  // Con "Confirm email" activo no hay sesión todavía: se confirma por correo.
  if (!data.session) {
    return {
      error: null,
      aviso: "Te enviamos un correo para confirmar la cuenta. Revisa tu bandeja (y el spam).",
    };
  }
  redirect("/app");
}

export async function logoutPortal(): Promise<void> {
  // Como toda server action, es un endpoint público: sesión primero.
  const { supabase } = await verifySesionPortal();
  await supabase.auth.signOut();
  redirect("/app/login");
}
