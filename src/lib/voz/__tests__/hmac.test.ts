import { describe, expect, it } from "vitest";
import { firmar, verificarFirma, TOLERANCIA_ATRAS_S, TOLERANCIA_FUTURO_S } from "../hmac";

const SECRET = "wsec_prueba_no_real";
const AHORA = 1_782_000_000;
const CUERPO = JSON.stringify({ type: "post_call_transcription", data: { conversation_id: "conv_1" } });

describe("verificarFirma", () => {
  it("acepta una firma recién generada", () => {
    const header = firmar(CUERPO, SECRET, AHORA);
    expect(verificarFirma(CUERPO, header, SECRET, AHORA)).toEqual({ ok: true });
  });

  it("acepta dentro de la tolerancia y rechaza fuera", () => {
    const alBorde = firmar(CUERPO, SECRET, AHORA - TOLERANCIA_ATRAS_S + 1);
    expect(verificarFirma(CUERPO, alBorde, SECRET, AHORA).ok).toBe(true);

    const vieja = firmar(CUERPO, SECRET, AHORA - TOLERANCIA_ATRAS_S - 1);
    expect(verificarFirma(CUERPO, vieja, SECRET, AHORA)).toEqual({ ok: false, motivo: "expirada" });

    const futura = firmar(CUERPO, SECRET, AHORA + TOLERANCIA_FUTURO_S + 1);
    expect(verificarFirma(CUERPO, futura, SECRET, AHORA)).toEqual({ ok: false, motivo: "expirada" });
  });

  it("rechaza si el cuerpo cambió un solo byte", () => {
    const header = firmar(CUERPO, SECRET, AHORA);
    expect(verificarFirma(CUERPO + " ", header, SECRET, AHORA)).toEqual({
      ok: false,
      motivo: "no_coincide",
    });
  });

  it("rechaza secret distinto", () => {
    const header = firmar(CUERPO, "wsec_otro", AHORA);
    expect(verificarFirma(CUERPO, header, SECRET, AHORA)).toEqual({
      ok: false,
      motivo: "no_coincide",
    });
  });

  it("rechaza header ausente o malformado sin lanzar", () => {
    expect(verificarFirma(CUERPO, null, SECRET, AHORA)).toEqual({ ok: false, motivo: "sin_header" });
    expect(verificarFirma(CUERPO, "", SECRET, AHORA)).toEqual({ ok: false, motivo: "sin_header" });
    expect(verificarFirma(CUERPO, "basura", SECRET, AHORA)).toEqual({ ok: false, motivo: "malformada" });
    expect(verificarFirma(CUERPO, "t=abc,v0=zzz", SECRET, AHORA)).toEqual({ ok: false, motivo: "malformada" });
    expect(verificarFirma(CUERPO, `t=${AHORA},v0=abc`, SECRET, AHORA)).toEqual({ ok: false, motivo: "malformada" });
    // v0 hex pero de largo equivocado: no debe reventar timingSafeEqual
    expect(verificarFirma(CUERPO, `t=${AHORA},v0=${"ab".repeat(32)}`, SECRET, AHORA).ok).toBe(false);
  });
});
