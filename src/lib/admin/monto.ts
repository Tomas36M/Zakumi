import { formatoUsd } from "./formato";

/**
 * El monto que la persona tecleó en el campo del peaje, como número. `null` si
 * no hay ninguno.
 *
 * El botón pinta el monto en es-CO ("US$ 24,50") y antes se exigía teclearlo
 * byte a byte: "24.50" no coincidía, y el teclado numérico de muchos celulares
 * no trae coma. La regla se compara en centavos, no en bytes.
 *
 * Separadores:
 * - Con los dos presentes, el ÚLTIMO es el decimal ("1.234,50" y "1,234.50").
 * - Con uno solo, una vez y seguido de exactamente tres cifras, es de miles
 *   ("1.000" → 1000). Cualquier otra cosa es el decimal ("24,50", "24.5").
 *   El botón siempre trae dos decimales, así que un monto real nunca cae en
 *   la ambigüedad; "24,500" se leería como 24.500 y no coincidiría — lo cual
 *   es lo correcto: no se adivina en la dirección que gasta.
 */
export function montoEscrito(texto: string): number | null {
  const limpio = texto.replace(/[^\d.,]/g, "");
  if (!/\d/.test(limpio)) return null;

  const tienePunto = limpio.includes(".");
  const tieneComa = limpio.includes(",");
  let normal: string;

  if (tienePunto && tieneComa) {
    const decimal = limpio.lastIndexOf(".") > limpio.lastIndexOf(",") ? "." : ",";
    const miles = decimal === "." ? "," : ".";
    normal = limpio.split(miles).join("").replace(decimal, ".");
  } else if (tienePunto || tieneComa) {
    const partes = limpio.split(tienePunto ? "." : ",");
    if (partes.length === 2 && partes[1].length === 3) normal = partes.join("");
    else if (partes.length === 2) normal = partes.join(".");
    else normal = partes.join("");
  } else {
    normal = limpio;
  }

  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

/** ¿Lo tecleado es el monto que rotula el botón? Se compara contra el monto
 * FORMATEADO y vuelto a leer — no contra el número crudo — para que lo que se
 * exige sea exactamente lo que la pantalla muestra, con su redondeo a centavos
 * incluido. Vacío nunca coincide, ni con cero. */
export function coincideMonto(escrito: string, monto: number): boolean {
  const tecleado = montoEscrito(escrito);
  if (tecleado === null) return false;
  return tecleado === montoEscrito(formatoUsd(monto));
}
