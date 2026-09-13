"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "./dal";
import {
  agendarCitaCore,
  cancelarCitaCore,
  reprogramarCitaCore,
  type Cita,
  type ResultadoCita,
} from "@/lib/agenda/citas";
import { telefonoDelClientePorUsuario } from "@/lib/agenda/consultas";

export type { ResultadoCita } from "@/lib/agenda/citas";

// La cita se ve en la agenda y en la bandeja de solicitudes.
function revalidarAgenda() {
  revalidatePath("/admin/agenda");
  revalidatePath("/admin/solicitudes");
}

function citaValida(c: unknown): c is Cita {
  const x = c as Partial<Cita> | null;
  return typeof x?.inicio === "string" && typeof x?.fin === "string";
}

function idValido(id: unknown): id is string {
  return typeof id === "string" && id.length > 0;
}

/** Las tres acciones son envoltorios: sesión → validar la forma → el core
 * (probado sin red) → revalidar. El resultado se devuelve tal cual para que
 * la pantalla diga qué pasó con Google y con el aviso. */
export async function agendarCita(
  solicitudId: string,
  cita: Cita,
  avisar: boolean,
): Promise<ResultadoCita> {
  const { supabase } = await verifySession();
  if (!idValido(solicitudId) || !citaValida(cita)) return { error: "Datos no válidos." };
  const r = await agendarCitaCore(supabase, solicitudId, cita, Boolean(avisar), {
    telefonoDelCliente: (uid) => telefonoDelClientePorUsuario(supabase, uid),
  });
  if ("ok" in r) revalidarAgenda();
  return r;
}

export async function reprogramarCita(
  solicitudId: string,
  cita: Cita,
  avisar: boolean,
): Promise<ResultadoCita> {
  const { supabase } = await verifySession();
  if (!idValido(solicitudId) || !citaValida(cita)) return { error: "Datos no válidos." };
  const r = await reprogramarCitaCore(supabase, solicitudId, cita, Boolean(avisar), {
    telefonoDelCliente: (uid) => telefonoDelClientePorUsuario(supabase, uid),
  });
  if ("ok" in r) revalidarAgenda();
  return r;
}

export async function cancelarCita(solicitudId: string, avisar: boolean): Promise<ResultadoCita> {
  const { supabase } = await verifySession();
  if (!idValido(solicitudId)) return { error: "Datos no válidos." };
  const r = await cancelarCitaCore(supabase, solicitudId, Boolean(avisar), {
    telefonoDelCliente: (uid) => telefonoDelClientePorUsuario(supabase, uid),
  });
  if ("ok" in r) revalidarAgenda();
  return r;
}
