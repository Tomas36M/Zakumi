import { redirect } from "next/navigation";
import { getSesion, type Sesion } from "@/lib/auth/sesion";

// La sesión vive en src/lib/auth/sesion.ts (compartida con el portal /app).
// Se re-exporta para no tocar los imports históricos del panel.
export { getSesion };
export type { Sesion };

/**
 * Primera línea de CADA page del panel y de CADA server action — en Next 16
 * los layouts no se re-renderizan al navegar, así que un check en el layout
 * no protege nada. Exige rol admin: con el signup público abierto, "tener
 * sesión" ya no significa "ser de la casa" — un cliente que teclee /admin
 * rebota a su portal.
 */
export async function verifySession(): Promise<Sesion> {
  const sesion = await getSesion();
  if (!sesion) redirect("/admin/login");
  if (sesion.rol !== "admin") redirect("/app");
  return sesion;
}

/**
 * Para los route handlers de /admin/api: null si no hay sesión O si no es
 * admin (el handler responde 401). Nunca usar getSesion() a secas en un
 * handler del panel: dejaría pasar a cualquier registrado del portal.
 */
export async function getSesionAdmin(): Promise<Sesion | null> {
  const sesion = await getSesion();
  return sesion && sesion.rol === "admin" ? sesion : null;
}
