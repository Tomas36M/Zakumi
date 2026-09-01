"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "./dal";
import {
  CICLOS,
  TIPOS_PRODUCTO,
  siguienteFecha,
  type Ciclo,
  type TipoProducto,
} from "./cartera";
import { normalizarTelefonoCO } from "./telefono";
import { listarInstancias } from "@/lib/bots/api";

const TIPOS_VALIDOS = new Set(TIPOS_PRODUCTO.map((t) => t.valor));
const CICLOS_VALIDOS = new Set(CICLOS.map((c) => c.valor));
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function esTipo(v: unknown): v is TipoProducto {
  return typeof v === "string" && TIPOS_VALIDOS.has(v as TipoProducto);
}
function esCiclo(v: unknown): v is Ciclo {
  return typeof v === "string" && CICLOS_VALIDOS.has(v as Ciclo);
}
function esFecha(v: unknown): v is string {
  return typeof v === "string" && FECHA_ISO.test(v);
}

function telefonoONull(bruto: unknown): { telefono: string | null } | { error: string } {
  const limpio = typeof bruto === "string" ? bruto.trim() : "";
  if (!limpio) return { telefono: null };
  const { telefono } = normalizarTelefonoCO(limpio);
  if (telefono === null) {
    return { error: "Ese teléfono no se entiende. Usa 10 dígitos o +57…" };
  }
  return { telefono };
}

function revalidarCartera() {
  revalidatePath("/admin/clientes");
}

export async function crearCliente(datos: {
  nombre: string;
  telefono?: string;
  email?: string;
  notas?: string;
}): Promise<{ id: string } | { error: string }> {
  const { supabase } = await verifySession();

  const nombre = typeof datos?.nombre === "string" ? datos.nombre.trim() : "";
  if (!nombre) return { error: "El cliente necesita un nombre." };

  const tel = telefonoONull(datos.telefono);
  if ("error" in tel) return tel;

  const { data, error } = await supabase
    .from("clientes")
    .insert({
      nombre: nombre.slice(0, 300),
      telefono: tel.telefono,
      email: datos.email?.trim() || null,
      notas: datos.notas?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[crearCliente]", error?.message);
    return { error: "No se pudo guardar el cliente." };
  }
  revalidarCartera();
  return { id: data.id as string };
}

/**
 * Un negocio del CRM se vuelve cliente de la cartera. Idempotente: el UNIQUE
 * de clientes.negocio_id garantiza que pulsar dos veces no duplica.
 */
export async function convertirNegocioEnCliente(
  negocioId: string,
): Promise<{ clienteId: string } | { error: string }> {
  const { supabase } = await verifySession();

  if (typeof negocioId !== "string" || !negocioId) {
    return { error: "Negocio no válido." };
  }

  const { data: negocio, error: errorNegocio } = await supabase
    .from("negocios")
    .select("id, nombre, telefono, estado")
    .eq("id", negocioId)
    .single();

  if (errorNegocio || !negocio) return { error: "El negocio no existe." };

  const { data: insertado, error: errorInsert } = await supabase
    .from("clientes")
    .upsert(
      { negocio_id: negocio.id, nombre: negocio.nombre, telefono: negocio.telefono },
      { onConflict: "negocio_id", ignoreDuplicates: true },
    )
    .select("id");

  if (errorInsert) {
    console.error("[convertirNegocioEnCliente]", errorInsert.message);
    return { error: "No se pudo crear el cliente." };
  }

  let clienteId = insertado?.[0]?.id as string | undefined;
  if (!clienteId) {
    // Ya existía (conversión previa): recuperarlo.
    const { data: existente } = await supabase
      .from("clientes")
      .select("id")
      .eq("negocio_id", negocio.id)
      .single();
    clienteId = existente?.id as string | undefined;
  }
  if (!clienteId) return { error: "No se pudo crear el cliente." };

  // El pipeline se alinea solo; el trigger de la base deja la nota automática.
  if (negocio.estado !== "cliente") {
    await supabase.from("negocios").update({ estado: "cliente" }).eq("id", negocio.id);
    revalidatePath("/admin/prospeccion");
  }

  revalidarCartera();
  return { clienteId };
}

export async function crearProducto(datos: {
  cliente_id: string;
  tipo: TipoProducto;
  nombre: string;
  tarifa: number;
  ciclo: Ciclo;
  proxima_fecha?: string;
  dominio?: string;
  instancia_id?: string;
}): Promise<{ id: string } | { error: string }> {
  const { supabase } = await verifySession();

  if (typeof datos?.cliente_id !== "string" || !datos.cliente_id) {
    return { error: "Cliente no válido." };
  }
  if (!esTipo(datos.tipo)) return { error: "Tipo de producto no válido." };
  if (!esCiclo(datos.ciclo)) return { error: "Ciclo no válido." };
  const nombre = typeof datos.nombre === "string" ? datos.nombre.trim() : "";
  if (!nombre) return { error: "El producto necesita un nombre." };
  if (typeof datos.tarifa !== "number" || !Number.isFinite(datos.tarifa) || datos.tarifa < 0) {
    return { error: "La tarifa no es válida." };
  }
  if (datos.proxima_fecha !== undefined && !esFecha(datos.proxima_fecha)) {
    return { error: "La fecha de cobro no es válida." };
  }

  const { data, error } = await supabase
    .from("productos_contratados")
    .insert({
      cliente_id: datos.cliente_id,
      tipo: datos.tipo,
      nombre: nombre.slice(0, 200),
      tarifa: datos.tarifa,
      ciclo: datos.ciclo,
      proxima_fecha: datos.proxima_fecha ?? null,
      dominio: datos.dominio?.trim() || null,
      instancia_id: datos.instancia_id?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[crearProducto]", error?.message);
    return { error: "No se pudo guardar el producto." };
  }
  revalidarCartera();
  return { id: data.id as string };
}

export async function actualizarProducto(
  id: string,
  cambios: {
    nombre?: string;
    tarifa?: number;
    ciclo?: Ciclo;
    proxima_fecha?: string | null;
    dominio?: string;
    instancia_id?: string;
    activo?: boolean;
  },
): Promise<{ error: string | null }> {
  const { supabase } = await verifySession();

  if (typeof id !== "string" || !id) return { error: "Producto no válido." };

  const fila: Record<string, unknown> = {};
  if ("nombre" in cambios) {
    const nombre = cambios.nombre?.trim() ?? "";
    if (!nombre) return { error: "El nombre no puede quedar vacío." };
    fila.nombre = nombre.slice(0, 200);
  }
  if ("tarifa" in cambios) {
    if (typeof cambios.tarifa !== "number" || !Number.isFinite(cambios.tarifa) || cambios.tarifa < 0) {
      return { error: "La tarifa no es válida." };
    }
    fila.tarifa = cambios.tarifa;
  }
  if ("ciclo" in cambios) {
    if (!esCiclo(cambios.ciclo)) return { error: "Ciclo no válido." };
    fila.ciclo = cambios.ciclo;
  }
  if ("proxima_fecha" in cambios) {
    if (cambios.proxima_fecha !== null && !esFecha(cambios.proxima_fecha)) {
      return { error: "La fecha no es válida." };
    }
    fila.proxima_fecha = cambios.proxima_fecha;
  }
  if ("dominio" in cambios) fila.dominio = cambios.dominio?.trim() || null;
  if ("instancia_id" in cambios) fila.instancia_id = cambios.instancia_id?.trim() || null;
  if ("activo" in cambios) fila.activo = Boolean(cambios.activo);

  if (Object.keys(fila).length === 0) return { error: null };

  const { error } = await supabase.from("productos_contratados").update(fila).eq("id", id);
  if (error) {
    console.error("[actualizarProducto]", error.message);
    return { error: "No se pudo guardar el cambio." };
  }
  revalidarCartera();
  return { error: null };
}

/**
 * Vincula un producto a una instancia REAL del bot: se valida contra la lista
 * viva del API (whitelist viva) antes de escribir la referencia blanda.
 */
export async function vincularInstancia(
  productoId: string,
  instanciaId: string,
): Promise<{ error: string | null }> {
  const { supabase } = await verifySession();

  if (typeof productoId !== "string" || !productoId) {
    return { error: "Producto no válido." };
  }
  if (typeof instanciaId !== "string" || !/^\d+$/.test(instanciaId)) {
    return { error: "Instancia no válida." };
  }

  const instancias = await listarInstancias();
  if (!instancias.ok) {
    return { error: "No hay conexión con el bot para validar la instancia." };
  }
  if (!instancias.data.some((i) => String(i.id) === instanciaId)) {
    return { error: "Esa instancia no existe en el bot." };
  }

  const { error } = await supabase
    .from("productos_contratados")
    .update({ instancia_id: instanciaId })
    .eq("id", productoId);
  if (error) {
    console.error("[vincularInstancia]", error.message);
    return { error: "No se pudo guardar el vínculo." };
  }
  revalidarCartera();
  return { error: null };
}

/**
 * Registra un pago manual y avanza la próxima fecha de cobro en una sola
 * operación atómica (función registrar_pago de la base). La nueva fecha se
 * calcula desde la fecha PROGRAMADA (no la del pago): pagar tarde no corre
 * el calendario.
 */
export async function registrarPago(
  productoId: string,
  datos: { monto: number; fecha: string; nota?: string },
): Promise<{ error: string | null }> {
  const { supabase } = await verifySession();

  if (typeof productoId !== "string" || !productoId) {
    return { error: "Producto no válido." };
  }
  if (typeof datos?.monto !== "number" || !Number.isFinite(datos.monto) || datos.monto <= 0) {
    return { error: "El monto debe ser mayor que cero." };
  }
  if (!esFecha(datos.fecha)) return { error: "La fecha del pago no es válida." };

  const { data: producto, error: errorProducto } = await supabase
    .from("productos_contratados")
    .select("ciclo, proxima_fecha")
    .eq("id", productoId)
    .single();

  if (errorProducto || !producto) return { error: "El producto no existe." };

  const base = (producto.proxima_fecha as string | null) ?? datos.fecha;
  const nuevaProxima = siguienteFecha(base, producto.ciclo as Ciclo);

  const { error } = await supabase.rpc("registrar_pago", {
    p_producto_id: productoId,
    p_monto: datos.monto,
    p_fecha: datos.fecha,
    p_nota: datos.nota ?? null,
    p_nueva_proxima: nuevaProxima,
  });

  if (error) {
    console.error("[registrarPago]", error.message);
    return { error: "No se pudo registrar el pago." };
  }
  revalidarCartera();
  return { error: null };
}
