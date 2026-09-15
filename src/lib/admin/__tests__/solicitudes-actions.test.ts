import { beforeEach, describe, expect, it, vi } from "vitest";

// Sin sesión real no hay Supabase en vitest: se captura lo que llega al
// `update`/`delete` (patrón de actions.test.ts).
const {
  updateMock,
  deleteMock,
  verifySessionMock,
  filaMock,
  insertClienteMock,
  upsertClienteMock,
  updatePerfilMock,
  crearProductoMock,
  registrarPagoMock,
} = vi.hoisted(() => ({
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
  verifySessionMock: vi.fn(),
  filaMock: vi.fn(),
  insertClienteMock: vi.fn(),
  upsertClienteMock: vi.fn(),
  updatePerfilMock: vi.fn(),
  crearProductoMock: vi.fn(),
  registrarPagoMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../dal", () => ({ verifySession: verifySessionMock }));
vi.mock("../cartera-actions", () => ({
  crearProducto: crearProductoMock,
  registrarPago: registrarPagoMock,
}));

function supabaseFalso() {
  return {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: filaMock(), error: null }) }) }),
      update: (fila: unknown) => {
        updateMock(fila);
        return { eq: async () => ({ error: null }) };
      },
      delete: () => {
        deleteMock();
        return { eq: async () => ({ error: null }) };
      },
    }),
  };
}

const SOLICITUD = {
  id: "sol-1",
  user_id: null,
  producto_id: null,
  estado: "nueva",
  origen: "voz",
  contacto_telefono: "+573001112233",
};

describe("actualizarSolicitud / eliminarSolicitud", () => {
  beforeEach(() => {
    updateMock.mockClear();
    deleteMock.mockClear();
    filaMock.mockReturnValue(SOLICITUD);
    verifySessionMock.mockResolvedValue({ supabase: supabaseFalso() });
  });

  it("escribe solo lo validado", async () => {
    const { actualizarSolicitud } = await import("../solicitudes-actions");
    const r = await actualizarSolicitud("sol-1", { contacto_nombre: " María ", contacto_telefono: "3001112233" });
    expect(r).toEqual({ error: null });
    expect(updateMock).toHaveBeenCalledWith({ contacto_nombre: "María", contacto_telefono: "+573001112233" });
  });

  it("un cambio inválido no toca la base", async () => {
    const { actualizarSolicitud } = await import("../solicitudes-actions");
    const r = await actualizarSolicitud("sol-1", { contacto_telefono: "" });
    expect(r.error).toMatch(/teléfono/);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("sin solicitud no hace nada", async () => {
    filaMock.mockReturnValue(null);
    const { actualizarSolicitud, eliminarSolicitud } = await import("../solicitudes-actions");
    expect((await actualizarSolicitud("x", { mensaje: "a" })).error).toMatch(/no existe/);
    expect((await eliminarSolicitud("x")).error).toMatch(/no existe/);
    expect(updateMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("eliminar borra la fila", async () => {
    const { eliminarSolicitud } = await import("../solicitudes-actions");
    expect(await eliminarSolicitud("sol-1")).toEqual({ error: null });
    expect(deleteMock).toHaveBeenCalledTimes(1);
  });
});

// Doble de Supabase específico para activarSolicitud: a diferencia de
// supabaseFalso() (arriba), acá cada tabla responde distinto porque la
// función hace select/insert/update sobre perfiles, productos, clientes Y
// solicitudes en la misma corrida.
function supabaseActivar(cfg: {
  solicitud: Record<string, unknown>;
  perfil?: { cliente_id: string | null; email: string | null; nombre: string | null } | null;
  productoExistente?: { cliente_id: string } | null;
  clienteCreadoId?: string;
  clienteExistentePorNegocio?: { id: string } | null;
}) {
  return {
    from: (tabla: string) => {
      if (tabla === "solicitudes") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: cfg.solicitud, error: null }) }),
          }),
          update: (fila: unknown) => {
            updateMock(fila);
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      if (tabla === "perfiles") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: cfg.perfil ?? null, error: null }) }),
          }),
          update: (fila: unknown) => {
            updatePerfilMock(fila);
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      if (tabla === "productos_contratados") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: cfg.productoExistente ?? null, error: null }),
            }),
          }),
        };
      }
      if (tabla === "clientes") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: cfg.clienteExistentePorNegocio ?? null, error: null }),
            }),
          }),
          insert: (fila: unknown) => {
            insertClienteMock(fila);
            return {
              select: () => ({
                single: async () => ({ data: { id: cfg.clienteCreadoId ?? "cli-nuevo" }, error: null }),
              }),
            };
          },
          // Camino con negocio_id: upsert sobre el UNIQUE de negocio_id.
          // `clienteExistentePorNegocio` hace doble uso como señal: si está
          // seteado, simula que ignoreDuplicates saltó el insert (fila []),
          // y el fallback select().eq().maybeSingle() de arriba entrega ese
          // cliente. Si no, simula una inserción nueva de verdad.
          upsert: (fila: unknown, opciones: unknown) => {
            upsertClienteMock(fila, opciones);
            return {
              select: () =>
                Promise.resolve({
                  data: cfg.clienteExistentePorNegocio
                    ? []
                    : [{ id: cfg.clienteCreadoId ?? "cli-nuevo" }],
                  error: null,
                }),
            };
          },
        };
      }
      if (tabla === "negocios") {
        // avanzarEstadoNegocio: solo importa que no lance (la lógica del
        // candado/forward-only ya se cubre en estado-negocio.test.ts).
        return {
          update: () => ({
            in: () => ({ eq: () => ({ lt: async () => ({ error: null }) }) }),
          }),
        };
      }
      throw new Error(`tabla no mockeada en este test: ${tabla}`);
    },
  };
}

const BASE_ACTIVABLE = {
  id: "sol-2",
  estado: "pagada",
  cotizacion_monto: "150000",
  cotizacion_ciclo: "unico",
  negocio_id: null,
};

describe("activarSolicitud — resolución del cliente", () => {
  beforeEach(() => {
    updateMock.mockClear();
    insertClienteMock.mockClear();
    upsertClienteMock.mockClear();
    updatePerfilMock.mockClear();
    crearProductoMock.mockReset();
    registrarPagoMock.mockReset();
    registrarPagoMock.mockResolvedValue({ error: null });
  });

  it("sin cuenta de portal: crea el cliente directo desde el contacto de la solicitud", async () => {
    const solicitud = {
      ...BASE_ACTIVABLE,
      user_id: null,
      producto_id: null,
      contacto_nombre: "Panadería Doña Rosa",
      contacto_telefono: "+573001112233",
      contacto_email: null,
    };
    crearProductoMock.mockResolvedValue({ id: "prod-1" });
    verifySessionMock.mockResolvedValue({ supabase: supabaseActivar({ solicitud }) });

    const { activarSolicitud } = await import("../solicitudes-actions");
    const r = await activarSolicitud("sol-2");

    expect(r).toEqual({ error: null });
    expect(insertClienteMock).toHaveBeenCalledWith({
      nombre: "Panadería Doña Rosa",
      telefono: "+573001112233",
      email: null,
      negocio_id: null,
    });
  });

  it("sin cuenta de portal, con negocio vinculado: un reintento antes de guardar producto_id reusa el cliente por negocio_id, no duplica", async () => {
    const solicitud = {
      ...BASE_ACTIVABLE,
      user_id: null,
      producto_id: null,
      negocio_id: "neg-1",
      contacto_nombre: "Panadería Doña Rosa",
      contacto_telefono: "+573001112233",
      contacto_email: null,
    };
    crearProductoMock.mockResolvedValue({ id: "prod-3" });
    verifySessionMock.mockResolvedValue({
      supabase: supabaseActivar({
        solicitud,
        clienteExistentePorNegocio: { id: "cli-existente-negocio" },
      }),
    });

    const { activarSolicitud } = await import("../solicitudes-actions");
    const r = await activarSolicitud("sol-2");

    expect(r).toEqual({ error: null });
    expect(upsertClienteMock).toHaveBeenCalledWith(
      {
        nombre: "Panadería Doña Rosa",
        telefono: "+573001112233",
        email: null,
        negocio_id: "neg-1",
      },
      { onConflict: "negocio_id", ignoreDuplicates: true },
    );
    expect(insertClienteMock).not.toHaveBeenCalled();
    expect(crearProductoMock).toHaveBeenCalledWith(
      expect.objectContaining({ cliente_id: "cli-existente-negocio" }),
    );
  });

  it("sin cuenta de portal, con negocio vinculado, primera vez de verdad: crea el cliente vía upsert", async () => {
    const solicitud = {
      ...BASE_ACTIVABLE,
      user_id: null,
      producto_id: null,
      negocio_id: "neg-2",
      contacto_nombre: "Ferretería El Tornillo",
      contacto_telefono: "+573009998877",
      contacto_email: null,
    };
    crearProductoMock.mockResolvedValue({ id: "prod-4" });
    verifySessionMock.mockResolvedValue({
      supabase: supabaseActivar({ solicitud, clienteCreadoId: "cli-neg-2" }),
    });

    const { activarSolicitud } = await import("../solicitudes-actions");
    const r = await activarSolicitud("sol-2");

    expect(r).toEqual({ error: null });
    expect(upsertClienteMock).toHaveBeenCalledWith(
      {
        nombre: "Ferretería El Tornillo",
        telefono: "+573009998877",
        email: null,
        negocio_id: "neg-2",
      },
      { onConflict: "negocio_id", ignoreDuplicates: true },
    );
    expect(insertClienteMock).not.toHaveBeenCalled();
    expect(crearProductoMock).toHaveBeenCalledWith(
      expect.objectContaining({ cliente_id: "cli-neg-2" }),
    );
  });

  it("sin cuenta de portal: un reintento no duplica el cliente", async () => {
    const solicitud = {
      ...BASE_ACTIVABLE,
      user_id: null,
      producto_id: "prod-1",
      contacto_nombre: "Panadería Doña Rosa",
      contacto_telefono: "+573001112233",
      contacto_email: null,
    };
    verifySessionMock.mockResolvedValue({
      supabase: supabaseActivar({ solicitud, productoExistente: { cliente_id: "cli-existente" } }),
    });

    const { activarSolicitud } = await import("../solicitudes-actions");
    const r = await activarSolicitud("sol-2");

    expect(r).toEqual({ error: null });
    expect(insertClienteMock).not.toHaveBeenCalled();
    expect(crearProductoMock).not.toHaveBeenCalled();
  });

  it("con cuenta de portal: sigue creando el cliente desde el perfil (sin cambios de comportamiento)", async () => {
    const solicitud = { ...BASE_ACTIVABLE, user_id: "user-1", producto_id: null };
    crearProductoMock.mockResolvedValue({ id: "prod-2" });
    verifySessionMock.mockResolvedValue({
      supabase: supabaseActivar({
        solicitud,
        perfil: { cliente_id: null, email: "ana@x.com", nombre: "Ana" },
      }),
    });

    const { activarSolicitud } = await import("../solicitudes-actions");
    const r = await activarSolicitud("sol-2");

    expect(r).toEqual({ error: null });
    expect(insertClienteMock).toHaveBeenCalledWith({ nombre: "Ana", email: "ana@x.com" });
    expect(updatePerfilMock).toHaveBeenCalledWith({ cliente_id: "cli-nuevo" });
  });
});
