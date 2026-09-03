/**
 * Logotipo ZAKUMI — vector trazado del master `assets/masters/zakumi-logo-1920.png`
 * (potrace, una figura por letra). Las letras toman `currentColor`; el punto
 * naranja sale de `--logo-punto` (fallback: naranja de marca).
 *
 * Cada letra va en un `<g data-letra>` y el punto en `[data-punto]` para que
 * cada superficie pueda animarlos por CSS (p. ej. el sidebar del panel pliega
 * la palabra hasta dejar solo la Z). El componente no trae estilos propios:
 * dale tamaño desde el CSS de la superficie que lo use.
 *
 * Proporción: 1537×235 (≈ 6.54:1). La Z sola ocupa x 0–222.
 * Master SVG suelto: assets/masters/zakumi-logotipo.svg (fuera de git).
 */

export const LOGO_ZAKUMI_VIEWBOX = { ancho: 1537, alto: 235 } as const;
/** Ancho de la Z en unidades del viewBox (para calcular el estado colapsado). */
export const LOGO_ZAKUMI_ANCHO_Z = 223;

const TRAZO = "translate(-178,1124) scale(0.1,-0.1)";

type Props = Omit<React.ComponentProps<"svg">, "viewBox" | "children"> & {
  /** Nombre accesible. Pasa `decorativo` si el enlace o el texto de al lado ya lo nombran. */
  titulo?: string;
  decorativo?: boolean;
};

export function LogoZakumi({ titulo = "Zakumi", decorativo = false, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 1537 235"
      fill="currentColor"
      role={decorativo ? undefined : "img"}
      aria-label={decorativo ? undefined : titulo}
      aria-hidden={decorativo || undefined}
      focusable="false"
      {...props}
    >
      <g data-letra="z">
        <path transform={TRAZO} d="M2546 11232 c-467 -1 -663 -5 -673 -13 -10 -9 -13 -64 -13 -259 0 -329 -63 -292 490 -289 522 3 498 9 412 -110 -27 -36 -120 -167 -206 -291 -160 -230 -436 -621 -651 -925 -127 -180 -169 -330 -109 -396 26 -29 2171 -30 2197 -1 27 29 25 491 -1 515 -17 15 -67 17 -519 17 -569 0 -547 -3 -498 73 33 49 376 530 708 992 332 461 307 416 307 545 0 162 138 149 -1444 142z" />
      </g>
      <g data-letra="a">
        <path transform={TRAZO} d="M5118 11213 c-15 -18 -154 -391 -586 -1578 -67 -181 -149 -406 -183 -499 -82 -224 -118 -200 313 -204 419 -3 375 -19 427 156 56 191 6 172 446 172 437 0 387 19 440 -165 53 -184 2 -166 444 -163 376 3 376 3 379 29 2 16 -66 215 -168 490 -196 531 -236 640 -470 1284 -94 258 -176 475 -182 482 -19 23 -840 18 -860 -4z m499 -893 c137 -470 148 -511 136 -528 -9 -15 -35 -17 -224 -17 -260 0 -245 -31 -149 297 40 134 76 259 82 278 7 29 32 108 54 178 15 50 40 -1 101 -208z" />
      </g>
      <g data-letra="k">
        <path transform={TRAZO} d="M7224 11219 c-25 -27 -21 -2250 4 -2272 30 -27 691 -25 715 1 15 16 17 48 17 238 0 219 0 219 177 391 117 113 185 172 200 173 25 0 4 34 258 -415 261 -462 172 -406 639 -403 433 3 434 3 339 63 -173 110 -253 255 -253 462 0 105 0 105 -220 453 -121 192 -220 357 -220 368 0 11 70 99 158 198 548 621 632 719 630 733 -3 14 -55 16 -447 19 -444 2 -444 2 -485 -41 -35 -37 -695 -834 -730 -883 -43 -58 -46 -31 -46 444 0 415 -1 450 -17 465 -27 24 -697 30 -719 6z" />
      </g>
      <g data-letra="u">
        <path transform={TRAZO} d="M10130 11215 c-16 -18 -24 -934 -11 -1338 1 -29 10 -47 41 -81 119 -129 175 -311 141 -460 -37 -157 314 -376 691 -432 699 -103 1242 153 1373 647 48 184 72 1621 27 1662 -24 22 -679 30 -705 8 -16 -12 -17 -72 -17 -680 -1 -739 -3 -783 -55 -888 -154 -313 -621 -272 -725 64 -19 63 -20 92 -20 773 -1 655 -2 709 -18 723 -30 27 -697 29 -722 2z" />
      </g>
      <g data-letra="m">
        <path transform={TRAZO} d="M14803 11218 c-17 -18 -85 -272 -259 -963 -81 -323 -101 -382 -123 -360 -10 10 -331 1260 -331 1287 0 48 -2 48 -536 48 -376 0 -503 -3 -512 -12 -23 -23 -17 -2251 6 -2271 30 -27 591 -25 615 1 15 17 17 85 19 723 3 811 4 818 71 554 21 -82 88 -334 149 -560 61 -225 128 -475 149 -554 21 -79 46 -152 55 -162 25 -28 532 -29 556 -1 9 9 84 278 168 597 84 319 166 634 184 700 60 229 62 212 57 -577 -4 -663 -3 -699 14 -718 28 -31 652 -31 679 -1 21 23 30 2251 10 2271 -21 21 -952 19 -971 -2z" />
      </g>
      <g data-letra="i">
        <path transform={TRAZO} d="M16422 11218 c-23 -23 -17 -2251 6 -2271 30 -27 681 -25 705 1 27 30 26 2241 -1 2265 -24 22 -689 26 -710 5z" />
      </g>
      <circle data-punto="true" cx="803" cy="180.5" r="49.5" fill="var(--logo-punto, #DB5227)" />
    </svg>
  );
}
