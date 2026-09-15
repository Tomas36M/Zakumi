"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "./dal";
import { hoyBogota, CICLOS, type Ciclo } from "./cartera";
import { crearProducto, registrarPago } from "./cartera-actions";
import { normalizarTelefonoCO } from "./telefono";
import { servicioDelSlug } from "@/lib/catalogo";
import { avanzarEstadoNegocio } from "./estado-negocio";
import {
  esTerminal,
  puedeTransicionar,
  validarCambiosSolicitud,
  type CambiosSolicitud,
  type Solicitud,
} from "@/lib/portal/solicitudes";

const CICLOS_VALIDOS = new Set(CICLOS.map((c) => c.valor));

function esCiclo(v: unknown): v is Ciclo {
  return typeof v === "string" && CICLOS_VALIDOS.has(v as Ciclo);
}

function revalidarBandeja() {
  revalidatePath("/admin/solicitudes");
  // La cita y el contacto de una solicitud también se ven en la agenda.
  revalidatePath("/admin/agenda");
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

/** Editar a mano el contacto, el servicio o el mensaje (la validación es
 * pura: `validarCambiosSolicitud`). No toca el estado ni la cotización. */
export async function actualizarSolicitud(
  id: string,
  cambios: CambiosSolicitud,
): Promise<{ error: string | null }> {
  const { supabase } = await verifySession();

  const sol = await obtenerSolicitud(supabase, id);
  if (!sol) return { error: "La solicitud no existe." };

  const v = validarCambiosSolicitud(cambios ?? {}, sol);
  if ("error" in v) return { error: v.error };
  if (Object.keys(v.fila).length === 0) return { error: null };

  const { error } = await supabase.from("solicitudes").update(v.fila).eq("id", id);
  if (error) {
    console.error("[actualizarSolicitud]", error.message);
    return { error: "No se pudo guardar el cambio." };
  }
  revalidarBandeja();
  return { error: null };
}

/** Borrar la solicitud. Si estaba activa, el producto del cliente NO se
 * borra (`producto_id` es `on delete set null` hacia productos, no al
 * revés): solo desaparece de la bandeja. La UI confirma antes. */
export async function eliminarSolicitud(id: string): Promise<{ error: string | null }> {
  const { supabase } = await verifySession();

  const sol = await obtenerSolicitud(supabase, id);
  if (!sol) return { error: "La solicitud no existe." };

  const { error } = await supabase.from("solicitudes").delete().eq("id", id);
  if (error) {
    console.error("[eliminarSolicitud]", error.message);
    return { error: "No se pudo eliminar la solicitud." };
  }
  revalidarBandeja();
  return { error: null };
}

/**
 * La transacción gorda: confirma el pago y deja el servicio andando.
 * 1. Resuelve el cliente de la cartera — con cuenta de portal (desde el
 *    perfil), sin cuenta en un reintento (desde el producto ya
 *    referenciado), o sin cuenta la primera vez (directo desde el contacto
 *    de la solicitud, ver el paso 1 más abajo para los cuatro caminos).
 * 2. Crea el producto contratado con la cotización.
 * 3. Registra el primer pago (avanza la próxima fecha de cobro).
 * 4. Marca la solicitud como activa.
 *
 * No es atómica (cuatro escrituras); por eso el producto_id se guarda en la
 * solicitud APENAS existe: re-ejecutar tras un fallo parcial nunca duplica
 * el producto (ya referenciado), y tampoco el cliente cuando hay cuenta de
 * portal (perfil ya vinculado) o negocio vinculado (negocio_id es UNIQUE en
 * clientes) — sin ninguno de los dos, un fallo justo después de crear el
 * cliente pero antes de guardar producto_id sí puede duplicarlo (caso raro,
 * documentado en el paso 1).
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

  // 1. Cliente de la cartera — cuatro caminos:
  //    (a) con cuenta de portal: desde el perfil, como siempre;
  //    (b) sin cuenta, reintento: el cliente ya existe, se recupera del
  //        producto ya referenciado (misma idempotencia que protege el
  //        paso 2 más abajo);
  //    (c) sin cuenta, primera vez, CON negocio vinculado: upsert atómico
  //        sobre el UNIQUE de clientes.negocio_id — nunca duplica, sea cual
  //        sea el camino por el que ese negocio ya se volvió cliente antes;
  //    (d) sin cuenta, primera vez, SIN negocio vinculado: insert directo.
  //        Sin negocio_id no hay con qué cruzar de forma confiable (el
  //        teléfono no es una clave única) — un fallo justo después de este
  //        insert pero antes de guardar producto_id puede duplicar el
  //        cliente en un reintento; caso raro, aceptado.
  //    Ninguno de los cuatro da acceso al portal — eso sigue siendo un paso
  //    aparte que esta función no hace.
  let clienteId: string;
  if (sol.user_id) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("user_id, cliente_id, email, nombre")
      .eq("user_id", sol.user_id)
      .maybeSingle();
    if (!perfil) return { error: "El usuario de la solicitud no tiene perfil." };

    let cid = perfil.cliente_id as string | null;
    if (!cid) {
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
      cid = cliente.id as string;

      const { error: errorVinculo } = await supabase
        .from("perfiles")
        .update({ cliente_id: cid })
        .eq("user_id", sol.user_id);
      if (errorVinculo) {
        console.error("[activarSolicitud] vínculo", errorVinculo.message);
        return { error: "Se creó el cliente pero no se pudo vincular el perfil." };
      }
    }
    clienteId = cid;
  } else if (sol.producto_id) {
    const { data: producto } = await supabase
      .from("productos_contratados")
      .select("cliente_id")
      .eq("id", sol.producto_id)
      .maybeSingle();
    if (!producto) return { error: "No se encontró el producto ya creado." };
    clienteId = producto.cliente_id as string;
  } else {
    // Sin cuenta de portal, primera vez: mismo patrón que
    // convertirNegocioEnCliente (cartera-actions.ts) — un upsert sobre el
    // UNIQUE de clientes.negocio_id es atómico de verdad (a diferencia de
    // un select-then-insert, no tiene ventana de carrera entre dos intentos
    // simultáneos). Sin negocio_id no hay con qué cruzar de forma confiable
    // (el teléfono de la solicitud no viene normalizado igual que
    // clientes.telefono, y cruzar por teléfono ya se descartó como poco
    // confiable en el diseño original de este vínculo, Decisión 5 del spec)
    // — ese caso puede duplicar en un fallo-parcial raro, igual que antes de
    // este cambio.
    // El teléfono/email de la solicitud son texto libre (documentado así
    // en portal/solicitudes.ts y en la Decisión 5 del spec); clientes.
    // telefono/email tienen CHECK de formato (E.164 / "contiene @"). Un
    // valor que no se puede normalizar se guarda en null en vez de romper
    // la escritura — bloquear la creación del cliente después de que el
    // admin ya confirmó un pago real sería el fallo peor de los dos.
    const telefonoNormalizado = normalizarTelefonoCO(sol.contacto_telefono).telefono;
    const emailValido = sol.contacto_email?.includes("@") ? sol.contacto_email : null;
    const datosCliente = {
      nombre:
        sol.contacto_nombre?.trim() || sol.contacto_telefono || "Cliente sin cuenta de portal",
      telefono: telefonoNormalizado,
      email: emailValido,
      negocio_id: sol.negocio_id,
    };

    if (sol.negocio_id) {
      const { data: insertado, error: errorCliente } = await supabase
        .from("clientes")
        .upsert(datosCliente, { onConflict: "negocio_id", ignoreDuplicates: true })
        .select("id");
      if (errorCliente) {
        console.error("[activarSolicitud] cliente", errorCliente.message);
        return { error: "No se pudo crear el cliente." };
      }
      let cid = insertado?.[0]?.id as string | undefined;
      if (!cid) {
        // Ya existía (conflicto ignorado): recuperarlo.
        const { data: existente } = await supabase
          .from("clientes")
          .select("id")
          .eq("negocio_id", sol.negocio_id)
          .maybeSingle();
        cid = existente?.id as string | undefined;
      }
      if (!cid) return { error: "No se pudo crear el cliente." };
      clienteId = cid;
    } else {
      const { data: cliente, error: errorCliente } = await supabase
        .from("clientes")
        .insert(datosCliente)
        .select("id")
        .single();
      if (errorCliente || !cliente) {
        console.error("[activarSolicitud] cliente", errorCliente?.message);
        return { error: "No se pudo crear el cliente." };
      }
      clienteId = cliente.id as string;
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

  if (sol.negocio_id) {
    await avanzarEstadoNegocio(supabase, sol.negocio_id, "cliente");
  }

  revalidarBandeja();
  revalidatePath("/admin/clientes");
  return { error: null };
}
