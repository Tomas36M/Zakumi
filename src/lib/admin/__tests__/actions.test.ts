import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResultadoPlace } from "../places";

// El upsert real vive en Supabase: se captura la fila que le llega en vez de
// pegarle a la base. verifySession también se mockea — sin sesión real no
// hay cookies ni Supabase que levantar en vitest (entorno "node").
const { upsertMock, verifySessionMock } = vi.hoisted(() => ({
  upsertMock: vi.fn(),
  verifySessionMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../dal", () => ({ verifySession: verifySessionMock }));

/** Supabase falso: el upsert responde con un id por fila (todo "importado",
 * cero duplicados) y guarda lo que le mandaron para poder inspeccionarlo. */
function supabaseFalso(filas: unknown[]) {
  return {
    from: () => ({
      upsert: (...args: unknown[]) => {
        upsertMock(...args);
        return {
          select: () =>
            Promise.resolve({
              data: filas.map((_, i) => ({ id: `id-${i}` })),
              error: null,
            }),
        };
      },
    }),
  };
}

function resultadoPlace(extra: Partial<ResultadoPlace>): ResultadoPlace {
  return {
    placeId: "ChIJ123",
    nombre: "Panadería La Espiga",
    direccion: null,
    lat: 5.3097,
    lng: -73.8156,
    categoria: "bakery",
    rating: null,
    sitioWeb: null,
    telefono: "+573101234567",
    tipoTelefono: "movil",
    ciudad: null,
    operativo: true,
    yaImportado: false,
    ...extra,
  };
}

describe("importarNegocios", () => {
  beforeEach(() => {
    upsertMock.mockClear();
    verifySessionMock.mockClear();
  });

  it("guarda la localidad real de Google (con tilde y mayúscula) en vez de degradarla a 'otra' — la Task 4 cambió el shape y esto es el bug que reparó la Task 6", async () => {
    verifySessionMock.mockResolvedValue({ supabase: supabaseFalso([{}]) });
    const { importarNegocios } = await import("../actions");

    const res = await importarNegocios([resultadoPlace({ ciudad: "Ubaté" })]);

    expect("error" in res).toBe(false);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const filasEnviadas = upsertMock.mock.calls[0]![0] as { ciudad: string | null }[];
    expect(filasEnviadas[0]!.ciudad).toBe("Ubaté");
  });

  it("sin ciudad (Google no la trae) la fila queda con ciudad null, no 'otra'", async () => {
    verifySessionMock.mockResolvedValue({ supabase: supabaseFalso([{}]) });
    const { importarNegocios } = await import("../actions");

    await importarNegocios([resultadoPlace({ ciudad: null })]);

    const filasEnviadas = upsertMock.mock.calls[0]![0] as { ciudad: string | null }[];
    expect(filasEnviadas[0]!.ciudad).toBeNull();
  });
});
