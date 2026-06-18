// src/components/zakumi/__tests__/services.test.ts
import { describe, expect, it } from "vitest";
import { SERVICIOS, SERVICE_SLUGS } from "../services";

const all = Object.values(SERVICIOS);
const copy = JSON.stringify(all);

describe("services", () => {
  it("hay 3 servicios con los slugs correctos", () => {
    expect(SERVICE_SLUGS).toEqual(["agentes-ia", "software", "marca"]);
    expect(Object.keys(SERVICIOS).sort()).toEqual([...SERVICE_SLUGS].sort());
  });
  it("cada servicio tiene secciones no vacías", () => {
    for (const s of all) {
      expect(s.incluye.length).toBeGreaterThanOrEqual(4);
      expect(s.ejemplos.length).toBeGreaterThanOrEqual(2);
      expect(s.testimonios.length).toBeGreaterThanOrEqual(2);
      expect(s.planes.length).toBeGreaterThanOrEqual(3);
      expect(s.seo.title.length).toBeGreaterThan(0);
      expect(s.seo.description.length).toBeGreaterThan(0);
    }
  });
  it("los testimonios están marcados como placeholder", () => {
    for (const s of all) for (const t of s.testimonios) expect(t.placeholder).toBe(true);
  });
  it("solo agentes usa CTA de whatsapp y trae waMsg", () => {
    expect(SERVICIOS["agentes-ia"].ctaTipo).toBe("whatsapp");
    expect(SERVICIOS["agentes-ia"].waMsg).toBeTruthy();
    expect(SERVICIOS["software"].ctaTipo).toBe("contacto");
    expect(SERVICIOS["marca"].ctaTipo).toBe("contacto");
  });
  it("REGLA: ningún copy contiene la palabra 'stack'", () => {
    expect(copy.toLowerCase()).not.toMatch(/\bstack\b/);
  });
});
