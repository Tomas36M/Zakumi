import { describe, expect, it } from "vitest";
import {
  COOKIE_SIDEBAR,
  colapsadoDeCookie,
  cookieSidebar,
  valorDeCookie,
} from "../sidebar-cookie";

describe("valorDeCookie", () => {
  it("encuentra la cookie entre otras, con o sin espacios", () => {
    expect(valorDeCookie("a=1; zk-sidebar=1; b=2", COOKIE_SIDEBAR)).toBe("1");
    expect(valorDeCookie("zk-sidebar=0;a=1", COOKIE_SIDEBAR)).toBe("0");
  });

  it("no confunde un nombre que solo empieza igual", () => {
    expect(valorDeCookie("zk-sidebar-otra=1", COOKIE_SIDEBAR)).toBeUndefined();
    expect(valorDeCookie("xzk-sidebar=1", COOKIE_SIDEBAR)).toBeUndefined();
  });

  it("devuelve undefined si no está o el jar está vacío", () => {
    expect(valorDeCookie("", COOKIE_SIDEBAR)).toBeUndefined();
    expect(valorDeCookie("a=1; b=2", COOKIE_SIDEBAR)).toBeUndefined();
    expect(valorDeCookie("sin-igual", COOKIE_SIDEBAR)).toBeUndefined();
  });

  it("decodifica el valor y sobrevive a un porcentaje roto", () => {
    expect(valorDeCookie("zk-sidebar=%31", COOKIE_SIDEBAR)).toBe("1");
    expect(valorDeCookie("zk-sidebar=%E0%A4%A", COOKIE_SIDEBAR)).toBeUndefined();
  });
});

describe("colapsadoDeCookie", () => {
  it("solo el 1 colapsa", () => {
    expect(colapsadoDeCookie("1")).toBe(true);
    expect(colapsadoDeCookie("0")).toBe(false);
    expect(colapsadoDeCookie("true")).toBe(false);
    expect(colapsadoDeCookie(undefined)).toBe(false);
  });
});

describe("cookieSidebar", () => {
  it("escribe la cookie que el servidor sabe leer", () => {
    const c = cookieSidebar(true);
    expect(valorDeCookie(c, COOKIE_SIDEBAR)).toBe("1");
    expect(c).toContain("path=/");
    expect(c).toContain("SameSite=Lax");
    expect(valorDeCookie(cookieSidebar(false), COOKIE_SIDEBAR)).toBe("0");
  });
});
