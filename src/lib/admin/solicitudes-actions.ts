"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "./dal";
import { hoyBogota, CICLOS, type Ciclo } from "./cartera";
import { crearProducto, registrarPago } from "./cartera-actions";
import { servicioDelSlug } from "@/lib/catalogo";
import {
  esTerminal,
  puedeTransicionar,
  type Solicitud,
} from "@/lib/portal/solicitudes";

const CICLOS_VALIDOS = new Set(CICLOS.map((c) => c.valor));

function esCiclo(v: unknown): v is Ciclo {
  return typeof v === "string" && CICLOS_VALIDOS.has(v as Ciclo);
}

function revalidarBandeja() {
  revalidatePath("/admin/solicitudes");
}

type SupabaseSesion = Awaited<ReturnType<typeof verifySession>>["supabase"];

async function obtenerSolicitud(
  supabase: SupabaseSesion,
  id: string,
): Promise<Solicitud | null> {
  if (typeof id !== "string" || !id) return null;
  const { data } = await supabase
    .from("solicitudes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Solicitud | null) ?? null;
}

/**
 * Pone precio a una solicitud (nueva → cotizada). Re-cotizar una ya cotizada
 * está permitido: mismo estado, números nuevos.
 */
export async function cotizarSolicitud(
  id: string,
  datos: { monto: number; ciclo: Ciclo; nota?: string },
): Promise<{ error: string | null }> {
  const { supabase } = await verifySession();

  if (
    typeof datos?.monto !== "number" ||
    !Number.isFinite(datos.monto) ||
    datos.monto <= 0
  ) {
    return { error: "El monto debe ser mayor que cero." };
  }
  if (!esCiclo(datos.ciclo)) return { error: "Ciclo no válido." };

  const sol = await obtenerSolicitud(supabase, id);
  if (!sol) return { error: "La solicitud no existe." };
  if (sol.estado !== "cotizada" && !puedeTransicionar(sol.estado, "cotizada")) {
    return { error: "Esta solicitud ya no se puede cotizar." };
  }

  const { error } = await supabase
    .from("solicitudes")
    .update({
      estado: "cotizada",
      cotizacion_monto: datos.monto,
      cotizacion_ciclo: datos.ciclo,
      cotizacion_nota: datos.nota?.trim().slice(0, 2000) || null,
    })
    .eq("id", id);
  if (error) {
    console.error("[cotizarSolicitud]", error.message);
    return { error: "No se pudo guardar la cotización." };
  }
  revalidarBandeja();
  return { error: null };
}

/**
 * Guarda el link de pago (Wompi/Bold) y lo publica al cliente
 * (cotizada → link_enviado). Reenviar un link nuevo está permitido.
 */
export async function marcarLinkEnviado(
  id: string,
  link: string,
): Promise<{ error: string | null }> {
  const { supabase } = await verifySession();

  const limpio = typeof link === "string" ? link.trim() : "";
  if (!/^https:\/\/\S+$/i.test(limpio)) {
    return { error: "El link de pago debe ser una URL https." };
  }

  const sol = await obtenerSolicitud(supabase, id);
  if (!sol) return { error: "La solicitud no existe." };
  if (
    sol.estado !== "link_enviado" &&
    !puedeTransicionar(sol.estado, "link_enviado")
  ) {
    return { error: "Esta solicitud todavía no tiene cotización (o ya cerró)." };
  }

  const { error } = await supabase
    .from("solicitudes")
    .update({ estado: "link_enviado", link_pago: limpio })
    .eq("id", id);
  if (error) {
    console.error("[marcarLinkEnviado]", error.message);
    return { error: "No se pudo guardar el link." };
  }
  revalidarBandeja();
  return { error: null };
}

export async function rechazarSolicitud(
  id: string,
  motivo?: string,
): Promise<{ error: string | null }> {
  const { supabase } = await verifySession();

  const sol = await obtenerSolicitud(supabase, id);
  if (!sol) return { error: "La solicitud no existe." };
  if (esTerminal(sol.estado)) {
    return { error: "Esta solicitud ya está cerrada." };
  }

  const { error } = await supabase
    .from("solicitudes")
    .update({
      estado: "rechazada",
      // El motivo viaja en la nota: el cliente lo lee en su portal.
      cotizacion_nota: motivo?.trim().slice(0, 2000) || sol.cotizacion_nota,
    })
    .eq("id", id);
  if (error) {
    console.error("[rechazarSolicitud]", error.message);
    return { error: "No se pudo rechazar." };
  }
  revalidarBandeja();
  return { error: null };
}

/**
 * La transacción gorda: confirma el pago y deja el servicio andando.
 * 1. Crea el cliente de la cartera si el perfil no tiene (y lo vincula).
 * 2. Crea el producto contratado con la cotización.
 * 3. Registra el primer pago (avanza la próxima fecha de cobro).
 * 4. Marca la solicitud como activa.
 *
 * No es atómica (cuatro escrituras); por eso el producto_id se guarda en la
 * solicitud APENAS existe: re-ejecutar tras un fallo parcial no duplica ni
 * cliente (perfil ya vinculado) ni producto (ya referenciado).
 */
export async function activarSolicitud(
  id: string,
): Promise<{ error: string | null }> {
  const { supabase } = await verifySession();

  const sol = await obtenerSolicitud(supabase, id);
  if (!sol) return { error: "La solicitud no existe." };
  if (sol.estado !== "activa" && !puedeTransicionar(sol.estado, "activa")) {
    return { error: "Esta solicitud no está lista para activar." };
  }
  const monto = sol.cotizacion_monto === null ? null : Number(sol.cotizacion_monto);
  if (monto === null || !sol.cotizacion_ciclo) {
    return { error: "La solicitud no tiene cotización completa." };
  }

  // 1. Cliente de la cartera (desde el perfil del usuario del portal).
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("user_id, cliente_id, email, nombre")
    .eq("user_id", sol.user_id)
    .maybeSingle();
  if (!perfil) return { error: "El usuario de la solicitud no tiene perfil." };

  let clienteId = perfil.cliente_id as string | null;
  if (!clienteId) {
    const { data: cliente, error: errorCliente } = await supabase
      .from("clientes")
      .insert({
        nombre:
          (perfil.nombre as string | null)?.trim() ||
          (perfil.email as string | null) ||
          "Cliente del portal",
        email: (perfil.email as string | null) ?? null,
      })
      .select("id")
      .single();
    if (errorCliente || !cliente) {
      console.error("[activarSolicitud] cliente", errorCliente?.message);
      return { error: "No se pudo crear el cliente." };
    }
    clienteId = cliente.id as string;

    const { error: errorVinculo } = await supabase
      .from("perfiles")
      .update({ cliente_id: clienteId })
      .eq("user_id", sol.user_id);
    if (errorVinculo) {
      console.error("[activarSolicitud] vínculo", errorVinculo.message);
      return { error: "Se creó el cliente pero no se pudo vincular el perfil." };
    }
  }

  // 2. Producto contratado (idempotente vía solicitudes.producto_id).
  let productoId = sol.producto_id;
  if (!productoId) {
    const servicio = servicioDelSlug(sol.servicio_slug);
    const creado = await crearProducto({
      cliente_id: clienteId,
      tipo: servicio?.tipo ?? "otro",
      nombre: servicio?.nombre ?? sol.servicio_slug,
      tarifa: monto,
      ciclo: sol.cotizacion_ciclo,
      // El primer cobro es HOY: registrar el pago la avanza al siguiente ciclo.
      proxima_fecha: hoyBogota(),
    });
    if ("error" in creado) return { error: creado.error };
    productoId = creado.id;

    const { error: errorRef } = await supabase
      .from("solicitudes")
      .update({ producto_id: productoId })
      .eq("id", id);
    if (errorRef) {
      console.error("[activarSolicitud] referencia", errorRef.message);
      return { error: "Se creó el producto pero no quedó referenciado. Reintenta." };
    }
  }

  // 3. Primer pago (solo si la solicitud aún no está activa: reintentos no
  // cobran dos veces).
  if (sol.estado !== "activa") {
    const pago = await registrarPago(productoId, {
      monto,
      fecha: hoyBogota(),
      nota: "Primer pago — solicitud del portal",
    });
    if (pago.error) return { error: pago.error };
  }

  // 4. Cerrar el ciclo.
  const { error } = await supabase
    .from("solicitudes")
    .update({ estado: "activa" })
    .eq("id", id);
  if (error) {
    console.error("[activarSolicitud] estado", error.message);
    return { error: "El servicio quedó creado pero la solicitud no cerró. Reintenta." };
  }

  revalidarBandeja();
  revalidatePath("/admin/clientes");
  return { error: null };
}
