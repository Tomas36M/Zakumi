import { describe, expect, it } from "vitest";

import {
  CAMPOS_GUIADOS,
  MAX_POR_CAMPO,
  parseConocimiento,
  serializarConocimiento,
  validarSecciones,
  type SeccionesConocimiento,
} from "../conocimiento";

function secciones(extra: Partial<SeccionesConocimiento> = {}): SeccionesConocimiento {
  return {
    personalidad: "",
    negocio: "",
    horarios: "",
    faq: "",
    noDecir: "",
    resto: "",
    ...extra,
  };
}

describe("serializar + parsear (round-trip)", () => {
  it("recupera cada sección guiada tal cual", () => {
    const s = secciones({
      personalidad: "Cercano y directo.",
      negocio: "Barbería en Madrid, Cundinamarca.\nCorte $25.000.",
      horarios: "Lunes a sábado 9am–7pm.",
      faq: "¿Tarjeta? Sí.",
      noDecir: "No prometer citas sin confirmar.",
    });
    expect(parseConocimiento(serializarConocimiento(s))).toEqual(s);
  });

  it("preserva el resto (escrito a mano) intacto y de primero", () => {
    const s = secciones({
      resto: "Notas internas de Zakumi.\nPolítica: cotizamos por proyecto.",
      negocio: "Vendemos flores.",
    });
    const texto = serializarConocimiento(s);
    expect(texto.startsWith("Notas internas de Zakumi.")).toBe(true);
    expect(parseConocimiento(texto)).toEqual(s);
  });

  it("las secciones vacías no generan títulos huérfanos", () => {
    const texto = serializarConocimiento(secciones({ negocio: "Solo esto." }));
    expect(texto).toBe("## Información del negocio\n\nSolo esto.");
  });
});

describe("parseConocimiento con conocimiento ajeno", () => {
  it("un knowledge sin secciones guiadas cae completo en resto", () => {
    const crudo = "# Zakumi\n\nTodo el conocimiento del sitio, escrito a mano.";
    expect(parseConocimiento(crudo)).toEqual(secciones({ resto: crudo }));
  });

  it("un ## desconocido devuelve el cursor a resto sin perder la línea", () => {
    const crudo = [
      "## Información del negocio",
      "",
      "Vendemos flores.",
      "",
      "## Precios internos",
      "",
      "Rosa $5.000 (no publicar).",
    ].join("\n");
    const s = parseConocimiento(crudo);
    expect(s.negocio).toBe("Vendemos flores.");
    expect(s.resto).toContain("## Precios internos");
    expect(s.resto).toContain("Rosa $5.000 (no publicar).");
    // Y el round-trip no pierde nada:
    const otraVuelta = parseConocimiento(serializarConocimiento(s));
    expect(otraVuelta).toEqual(s);
  });

  it("los títulos guiados se reconocen con espacios alrededor", () => {
    const s = parseConocimiento("  ## Horarios  \nLunes a viernes.");
    expect(s.horarios).toBe("Lunes a viernes.");
  });
});

describe("validarSecciones", () => {
  it("acepta secciones normales", () => {
    expect(validarSecciones(secciones({ negocio: "ok" }))).toBeNull();
  });

  it("rechaza un campo que se pasa del máximo, nombrándolo", () => {
    const error = validarSecciones(
      secciones({ horarios: "x".repeat(MAX_POR_CAMPO + 1) }),
    );
    expect(error).toContain("Horarios");
  });

  it("rechaza el total cuando todos los campos suman de más", () => {
    const casi = "x".repeat(MAX_POR_CAMPO);
    const error = validarSecciones(
      secciones({
        personalidad: casi,
        negocio: casi,
        horarios: casi,
        faq: casi,
        noDecir: casi,
        resto: casi,
      }),
    );
    expect(error).toContain("completo");
  });
});

describe("CAMPOS_GUIADOS", () => {
  it("cada campo guiado tiene título único (los títulos son el formato en disco)", () => {
    const titulos = CAMPOS_GUIADOS.map((c) => c.titulo);
    expect(new Set(titulos).size).toBe(titulos.length);
  });
});
