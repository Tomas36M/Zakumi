// Una "cara" es el nivel de navegación POR ENCIMA de las pestañas: las dos
// caras de Zak (chat / voz), las de Encontrar clientes (territorio / leads).
// Este es el modelo puro que pinta `ui/Caras.tsx`; cada pantalla arma las
// suyas con una función (`carasZak`, `carasProspeccion`) que se prueba sola.

export type PuntoCara = {
  /** Lo que lee la tecnología asistiva y el tooltip. */
  titulo: string;
  /** Late (barrido en curso) o fijo (algo sin configurar). */
  pulsa?: boolean;
};

export type CaraDef<T extends string> = {
  id: T;
  label: string;
  /** Subtítulo vivo: el dato manda sobre la etiqueta. */
  detalle?: string;
  punto?: PuntoCara | null;
};

/** «1 lead», «2 leads»: los contadores de las caras no dicen «1 leads». */
export function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}
