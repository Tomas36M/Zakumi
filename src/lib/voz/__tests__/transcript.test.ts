import { describe, expect, it } from "vitest";
import { parseTurnos } from "../transcript";

// La transcripción llega por DOS puertas con el mismo shape: el webhook
// post-call y el GET de la conversación en vivo. Un solo parser para las dos.
describe("parseTurnos", () => {
  it("mapea los turnos al par que se guarda y se pinta", () => {
    expect(
      parseTurnos([
        { role: "agent", message: "¡Hola! Soy Zak.", time_in_call_secs: 0 },
        { role: "user", message: "Hola, cuéntame.", time_in_call_secs: 4 },
      ]),
    ).toEqual([
      { role: "agent", message: "¡Hola! Soy Zak." },
      { role: "user", message: "Hola, cuéntame." },
    ]);
  });

  // null y [] NO son lo mismo: sin array es "no vino la transcripción";
  // el array vacío es "la llamada existe y todavía nadie ha dicho nada".
  it("sin array devuelve null, no un array vacío", () => {
    expect(parseTurnos(undefined)).toBeNull();
    expect(parseTurnos(null)).toBeNull();
    expect(parseTurnos("texto")).toBeNull();
    expect(parseTurnos({ 0: { role: "agent" } })).toBeNull();
  });

  it("una llamada recién empezada trae el array vacío", () => {
    expect(parseTurnos([])).toEqual([]);
  });

  it("descarta los turnos que no son objetos y no lanza", () => {
    expect(parseTurnos([null, 42, "x", ["y"], { role: "agent", message: "queda" }])).toEqual([
      { role: "agent", message: "queda" },
    ]);
  });

  it("un role ausente o vacío cae a 'desconocido' y un message no-string a null", () => {
    expect(parseTurnos([{ message: "sin role" }, { role: "   " }, { role: "user", message: 7 }])).toEqual([
      { role: "desconocido", message: "sin role" },
      { role: "desconocido", message: null },
      { role: "user", message: null },
    ]);
  });

  // Un turno del agente mientras habla puede venir con message null (todavía
  // sin transcribir): se conserva la fila para no descuadrar el conteo, y es
  // quien pinta el que decide no mostrarla.
  it("conserva los turnos sin texto todavía", () => {
    expect(parseTurnos([{ role: "agent", message: null }])).toEqual([
      { role: "agent", message: null },
    ]);
  });
});
