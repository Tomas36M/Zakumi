import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  avisarAdmin,
  componentesPlantilla,
  destinatarios,
  variablePlantilla,
} from "../avisos";
import { enviarManual, enviarPlantillaDirecta } from "@/lib/bots/api";

// El bot de Railway no se toca en tests: se simula el resultado de las dos
// rutas que usa avisarAdmin (plantilla primero, texto libre de respaldo).
vi.mock("@/lib/bots/api", () => ({
  enviarManual: vi.fn(async () => ({ ok: true, data: true })),
  enviarPlantillaDirecta: vi.fn(async () => ({ ok: true, data: { wamid: "wamid.1" } })),
}));

describe("destinatarios", () => {
  it("parte por comas y limpia espacios", () => {
    expect(destinatarios(" 573007970810 , 573007909522 ")).toEqual([
      "573007970810",
      "573007909522",
    ]);
  });

  it("acepta el formato viejo de un solo número", () => {
    expect(destinatarios("573007970810")).toEqual(["573007970810"]);
  });

  it("descarta vacíos y duplicados", () => {
    expect(destinatarios("573007970810,,573007970810, ")).toEqual(["573007970810"]);
  });

  it("sin valor devuelve lista vacía", () => {
    expect(destinatarios(undefined)).toEqual([]);
    expect(destinatarios("")).toEqual([]);
  });
});

describe("variablePlantilla", () => {
  it("quita saltos de línea y espacios de más: Meta rechaza el parámetro si los trae", () => {
    expect(variablePlantilla("hola\n\tmundo     x")).toBe("hola mundo x");
  });

  it("nunca manda un parámetro vacío", () => {
    expect(variablePlantilla("")).toBe("sin dato");
    expect(variablePlantilla(null)).toBe("sin dato");
    expect(variablePlantilla("   ")).toBe("sin dato");
  });

  it("acota la longitud", () => {
    expect(variablePlantilla("x".repeat(1000)).length).toBeLessThanOrEqual(300);
  });
});

describe("componentesPlantilla", () => {
  it("arma el body de Cloud API en el orden de las variables", () => {
    expect(componentesPlantilla(["llamada de voz", "María · +57300"])).toEqual([
      {
        type: "body",
        parameters: [
          { type: "text", text: "llamada de voz" },
          { type: "text", text: "María · +57300" },
        ],
      },
    ]);
  });
});

describe("avisarAdmin con plantilla", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AVISOS_BOT_INSTANCIA_ID", "1");
    vi.stubEnv("AVISOS_WHATSAPP_TO", "573007970810,573007909522");
  });

  it("manda la plantilla a cada número y NO el texto libre cuando sale bien", async () => {
    await avisarAdmin("texto de respaldo", {
      nombre: "aviso_solicitud",
      variables: ["llamada de voz", "María · +57300", "Bot de WhatsApp", "sin más detalle"],
    });
    expect(enviarPlantillaDirecta).toHaveBeenCalledTimes(2);
    expect(vi.mocked(enviarPlantillaDirecta).mock.calls[0][1]).toMatchObject({
      telefono: "573007970810",
      plantilla: "aviso_solicitud",
      lang: "es",
      texto: "texto de respaldo",
    });
    expect(enviarManual).not.toHaveBeenCalled();
  });

  it("si Meta rechaza la plantilla (aún no aprobada), cae al texto libre para ese número", async () => {
    vi.mocked(enviarPlantillaDirecta)
      .mockResolvedValueOnce({ ok: false, error: "bot_error" })
      .mockResolvedValueOnce({ ok: true, data: { wamid: "wamid.2" } });
    await avisarAdmin("texto de respaldo", { nombre: "aviso_solicitud", variables: ["a", "b", "c", "d"] });
    expect(enviarManual).toHaveBeenCalledTimes(1);
    expect(vi.mocked(enviarManual).mock.calls[0]).toEqual([1, "573007970810", "texto de respaldo"]);
  });

  it("sin plantilla se comporta como siempre: solo texto libre", async () => {
    await avisarAdmin("solo texto");
    expect(enviarPlantillaDirecta).not.toHaveBeenCalled();
    expect(enviarManual).toHaveBeenCalledTimes(2);
  });
});
