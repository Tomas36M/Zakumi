/** El naranja del panel (`--color-acento`, token `@theme` de admin-theme.css).
 *
 * Los overlays de Google Maps son objetos JS, no nodos del DOM: no leen
 * variables CSS y hay que darles el literal. Vive aquí y no duplicado en cada
 * overlay porque un token de marca con dos copias es un token que un día tiene
 * dos valores. Si cambia `--color-acento`, cambia también aquí. */
export const ACENTO = "#DB5227";
