import { describe, expect, it } from "vitest";
import { cn } from "../cn";

describe("cn", () => {
  it("combina clases condicionales y descarta falsy", () => {
    expect(cn("bg-isla", false && "oculto", undefined, "text-tinta")).toBe(
      "bg-isla text-tinta",
    );
  });

  it("resuelve conflictos de Tailwind a favor de la última clase", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", "text-xs")).toBe("text-xs");
  });
});
