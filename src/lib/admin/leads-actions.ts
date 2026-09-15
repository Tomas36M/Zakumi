"use server";

// Las tres formas de tocar un lead sin tocar el Flask: todo escribe en
// leads_overrides (Supabase). El merge con los datos crudos del bot lo
// hace mezclarLeads() del lado de lectura (src/lib/admin/leads-overrides.ts),
// no acá.

import { verifySession } from "./dal";

function claveValida(
  instanciaId: unknown,
  telefono: unknown,
): instanciaId is number {
  return (
    Number.isInteger(instanciaId) &&
    (instanciaId as number) > 0 &&
    typeof telefono === "string" &&
    telefono.length > 0 &&
    telefono.length < 40
  );
}

export async function editarLead(
  instanciaId: number,
  telefono: string,
  datos: Record<string, unknown>,
): Promise<{ error: string | null }> {
  const { supabase } = await verifySession();
  if (!claveValida(instanciaId, telefono)) return { error: "Lead no válido." };

  const { error } = await supabase
    .from("leads_overrides")
    .upsert(
      { instancia_id: instanciaId, telefono, datos_editados: datos },
      { onConflict: "instancia_id,telefono" },
    );
  if (error) {
    console.error("[editarLead]", error.message);
    return { error: "No se pudo guardar la edición." };
  }
  return { error: null };
}

export async function borrarLead(
  instanciaId: number,
  telefono: string,
): Promise<{ error: string | null }> {
  const { supabase } = await verifySession();
  if (!claveValida(instanciaId, telefono)) return { error: "Lead no válido." };

  const { error } = await supabase
    .from("leads_overrides")
    .upsert(
      { instancia_id: instanciaId, telefono, borrado: true },
      { onConflict: "instancia_id,telefono" },
    );
  if (error) {
    console.error("[borrarLead]", error.message);
    return { error: "No se pudo borrar el lead." };
  }
  return { error: null };
}

export async function vincularLead(
  instanciaId: number,
  telefono: string,
  negocioId: string | null,
): Promise<{ error: string | null }> {
  const { supabase } = await verifySession();
  if (!claveValida(instanciaId, telefono)) return { error: "Lead no válido." };

  const { error } = await supabase
    .from("leads_overrides")
    .upsert(
      { instancia_id: instanciaId, telefono, negocio_id: negocioId },
      { onConflict: "instancia_id,telefono" },
    );
  if (error) {
    console.error("[vincularLead]", error.message);
    return { error: "No se pudo vincular el negocio." };
  }
  return { error: null };
}
