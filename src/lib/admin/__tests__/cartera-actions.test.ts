import { beforeEach, describe, expect, it, vi } from "vitest";

// Sin sesión real no hay cookies ni Supabase en vitest: se captura la fila que
// llega al `update` en vez de pegarle a la base (patrón de actions.test.ts).
const { updateMock, verifySessionMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  verifySessionMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../dal", () => ({ verifySession: verifySessionMock }));
vi.mock("@/lib/bots/api", () => ({ listarInstancias: vi.fn() }));

function supabaseFalso() {
  return {
    from: () => ({
      update: (fila: unknown) => {
        updateMock(fila);
        return { eq: () => Promise.resolve({ error: null }) };
      },
    }),
  };
}

describe("actualizarCliente", () => {
  beforeEach(() => {
    updateMock.mockClear();
    verifySessionMock.mockResolvedValue({ supabase: supabaseFalso() });
  });

  it("solo escribe los campos que vienen, normalizados", async () => {
    const { actualizarCliente } = await import("../cartera-actions");
    const res = await actualizarCliente("c1", {
      nombre: "  Omar Gómez ",
      telefono: "310 123 4567",
      email: " omar@medispro.com.co ",
    });
    expect(res).toEqual({ error: null });
    expect(updateMock).toHaveBeenCalledWith({
      nombre: "Omar Gómez",
      telefono: "+573101234567",
      email: "omar@medispro.com.co",
    });
  });

  it("teléfono vacío lo borra; teléfono ilegible lo rechaza sin escribir", async () => {
    const { actualizarCliente } = await import("../cartera-actions");
    expect(await actualizarCliente("c1", { telefono: "" })).toEqual({ error: null });
    expect(updateMock).toHaveBeenCalledWith({ telefono: null });

    updateMock.mockClear();
    const res = await actualizarCliente("c1", { telefono: "abc" });
    expect(res.error).toMatch(/teléfono/);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("nombre vacío y correo sin arroba se rechazan", async () => {
    const { actualizarCliente } = await import("../cartera-actions");
    expect((await actualizarCliente("c1", { nombre: "  " })).error).toMatch(/nombre/);
    expect((await actualizarCliente("c1", { email: "sin-arroba" })).error).toMatch(/correo/);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("activo se guarda como booleano y sin cambios no toca la base", async () => {
    const { actualizarCliente } = await import("../cartera-actions");
    await actualizarCliente("c1", { activo: false });
    expect(updateMock).toHaveBeenCalledWith({ activo: false });

    updateMock.mockClear();
    expect(await actualizarCliente("c1", {})).toEqual({ error: null });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("sin id no hace nada", async () => {
    const { actualizarCliente } = await import("../cartera-actions");
    expect((await actualizarCliente("", { nombre: "x" })).error).toMatch(/no válido/);
  });
});
