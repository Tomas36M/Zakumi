// Constante de datos pura, sin secretos: vive fuera de lib/voz/api.ts (que
// ahora es "server-only") porque BibliotecaVoces.tsx la importa como VALOR
// desde un componente "use client" — moverla aquí evita tirar el guard de
// server-only encima de un import que sí necesita llegar al browser.

/** Acentos que ofrece la biblioteca ("" = todo español). Única fuente:
 * los chips de la UI y la whitelist del server action salen de aquí. */
export const LOCALES_BIBLIOTECA: readonly { valor: string; label: string }[] = [
  { valor: "es-CO", label: "Colombia" },
  { valor: "es-MX", label: "México" },
  { valor: "es-AR", label: "Argentina" },
  { valor: "es-ES", label: "España" },
  { valor: "", label: "Todo español" },
] as const;
