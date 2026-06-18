import { describe, expect, it } from "vitest";
import {
  WHATSAPP_URL,
  TELEGRAM_ENABLED,
  TELEGRAM_URL,
  INSTAGRAM_URL,
} from "../contact";

describe("contact", () => {
  it("WHATSAPP_URL apunta a wa.me con el número y mensaje codificado", () => {
    expect(WHATSAPP_URL).toContain("https://wa.me/573134276879");
    expect(WHATSAPP_URL).toContain("text=");
    expect(WHATSAPP_URL).not.toContain(" "); // mensaje URL-encoded
  });
  it("Telegram arranca apagado pero con URL lista", () => {
    expect(TELEGRAM_ENABLED).toBe(false);
    expect(TELEGRAM_URL).toMatch(/^https:\/\/t\.me\//);
  });
  it("Instagram apunta al handle correcto", () => {
    expect(INSTAGRAM_URL).toBe("https://www.instagram.com/zakumiestudio/");
  });
});
