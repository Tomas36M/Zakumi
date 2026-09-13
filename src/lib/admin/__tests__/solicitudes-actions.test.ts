import { beforeEach, describe, expect, it, vi } from "vitest";

// Sin sesión real no hay Supabase en vitest: se captura lo que llega al
// `update`/`delete` (patrón de actions.test.ts).
const { updateMock, deleteMock, verifySessionMock, filaMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
  verifySessionMock: vi.fn(),
  filaMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../dal", () => ({ verifySession: verifySessionMock }));
vi.mock("../cartera-actions", () => ({ crearProducto: vi.fn(), registrarPago: vi.fn() }));

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
