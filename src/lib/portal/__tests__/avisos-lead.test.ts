import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { avisarLead } from "../avisos";
import { enviarManual, enviarPlantillaDirecta } from "@/lib/bots/api";

vi.mock("@/lib/bots/api", () => ({
  enviarManual: vi.fn(async () => ({ ok: true, data: true })),
  enviarPlantillaDirecta: vi.fn(async () => ({ ok: true, data: { wamid: "wamid.1" } })),
}));

const plantilla = vi.mocked(enviarPlantillaDirecta);
const manual = vi.mocked(enviarManual);

describe("avisarLead", () => {
  const envOriginal = process.env.AVISOS_BOT_INSTANCIA_ID;
  beforeEach(() => {
    process.env.AVISOS_BOT_INSTANCIA_ID = "1";
    plantilla.mockClear();
    manual.mockClear();
    plantilla.mockResolvedValue({ ok: true, data: { wamid: "wamid.1" } });
    manual.mockResolvedValue({ ok: true, data: true });
  });
  afterEach(() => {
    process.env.AVISOS_BOT_INSTANCIA_ID = envOriginal;
  });

  it("con plantilla, la manda primero, sin el «+», y no cae al texto libre", async () => {
    const r = await avisarLead("+573001112233", "hola", { nombre: "aviso_reunion", variables: ["a", "b"] });
    expect(r).toBe("enviado");
    expect(plantilla).toHaveBeenCalledTimes(1);
    expect(plantilla.mock.calls[0][1]).toMatchObject({ telefono: "573001112233", plantilla: "aviso_reunion" });
    expect(manual).not.toHaveBeenCalled();
  });

  it("si la plantilla falla, intenta el texto libre y reporta según le vaya", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    plantilla.mockResolvedValue({ ok: false, error: "peticion_invalida" });
    expect(await avisarLead("+573001112233", "hola", { nombre: "x", variables: [] })).toBe("enviado");
    expect(manual).toHaveBeenCalledWith(1, "573001112233", "hola");

    manual.mockResolvedValue({ ok: false, error: "bot_error" });
    expect(await avisarLead("+573001112233", "hola", { nombre: "x", variables: [] })).toBe("fallo");
    error.mockRestore();
  });

  it("sin instancia configurada no manda nada y lo dice", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.AVISOS_BOT_INSTANCIA_ID = "";
    expect(await avisarLead("+573001112233", "hola")).toBe("fallo");
    expect(plantilla).not.toHaveBeenCalled();
    expect(manual).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
