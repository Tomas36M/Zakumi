# Encontrar clientes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir `/admin/mapa` en un centro de operaciones de prospección donde dibujas un área, el panel te dice cuánto cuesta barrerla, la barre por completo contra Google Places y llena el CRM con los negocios de ahí — destacando los que no tienen sitio web.

**Architecture:** Un territorio es un polígono guardado en Postgres. Barrerlo = cubrirlo con una rejilla de círculos (única forma que acepta Nearby Search), consultar cada círculo una vez por vertical de negocio, recortar los resultados al polígono en TypeScript y escribirlos a `negocios` deduplicando por `google_place_id`. El bucle de teselas corre en el navegador contra un route handler que hace una tesela por request; el servidor guarda la API key y valida que el círculo caiga dentro del territorio.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind v4, Supabase (Postgres + RLS), `@vis.gl/react-google-maps`, Google Places API (New) `searchNearby`, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-31-mapa-prospeccion-design.md`

## Global Constraints

- **Idioma del código y la UI: español.** Nombres de funciones, tipos, variables, comentarios, tests y copy visible, todo en español — es la convención del repo.
- **Vitest, no Jest.** Tests en `src/lib/admin/__tests__/*.test.ts`. Se corren con `npm test` (`vitest run`). El config solo recoge `src/**/__tests__/**/*.test.ts`.
- **El repo NO usa prettier.** Nunca correr `npx prettier --write`: reformatea el archivo entero. Re-indentar a mano.
- **CSS del panel siempre prefijado.** `admin-theme.css`. Jamás selectores `nav`/`footer` desnudos ni `.cta` — los estila la landing.
- **`GOOGLE_PLACES_API_KEY` jamás baja al browser.** Solo `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` y `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` son públicas.
- **Next 16: los layouts NO se re-renderizan.** El check de sesión va en CADA page, action y handler — nunca solo en el layout.
- **Precio verificado (2026-08-31):** Nearby Search Enterprise = **US$35 / 1.000 llamadas** → `0.035` USD por llamada. Nearby Search devuelve **máximo 20 resultados y no tiene paginación**.
- **FieldMask = factura.** `addressComponents` es tier Pro y ya pagamos Enterprise por el teléfono, así que entra gratis. **No añadir ningún otro campo sin verificar su tier.**
- **Commits explícitos.** Varias sesiones de Claude comparten este checkout: `git add <ruta>` con rutas exactas. **Nunca `git add -A`.**

---

### Task 1: Sincronizar el checkout y abrir la rama

`main` local está 35 commits atrás de `origin/main`. Piezas que la spec manda copiar como patrón — `Cockpit`, `src/lib/admin/zak-caras.ts`, `src/components/admin/zak/CarasZak.tsx` — **existen en `origin/main` pero no localmente**. Sin este paso, las tareas 9 y 11 no encuentran el patrón que deben seguir.

**Files:**
- Ninguno (preparación del entorno)

**Interfaces:**
- Consumes: nada
- Produces: rama `feat/mapa-prospeccion` sobre `origin/main`, con `Cockpit`, `zak-caras.ts` y `CarasZak.tsx` presentes y la suite verde

- [ ] **Step 1: Comprobar que no se está pisando trabajo ajeno**

```bash
git status -sb
```

Esperado: pueden aparecer modificados `marketing/`, `CLAUDE.md`, `src/components/admin/bots/NuevoChatZak.tsx` — **son de otra sesión. No commitearlos, no descartarlos, no tocarlos.** Si aparece algo modificado bajo `src/lib/admin/` o `src/components/admin/mapa/`, DETENERSE y avisar: otra sesión está en este mismo terreno.

- [ ] **Step 2: Traer origin y ramificar sin tocar el working tree ajeno**

```bash
git fetch origin
git switch -c feat/mapa-prospeccion origin/main
```

`git switch -c … origin/main` deja los archivos sin commitear intactos y no requiere que `main` avance.

- [ ] **Step 3: Verificar que el patrón a copiar ya existe**

```bash
ls src/lib/admin/zak-caras.ts src/components/admin/zak/CarasZak.tsx
grep -rl "Cockpit" src/components/admin | head -3
```

Esperado: los dos archivos existen y `Cockpit` aparece. Si no, la rama base es la equivocada.

- [ ] **Step 4: Verde de partida**

```bash
npm install
npm test
```

Esperado: PASS. Anotar el número de tests (la spec menciona ~256) — es la línea base contra la que se comparan las tareas siguientes.

---

### Task 2: Geometría del barrido (funciones puras)

El corazón del feature y donde vive todo el riesgo: si `teselar` deja huecos, el censo miente; si no descarta celdas fuera del polígono, el barrido cuesta de más.

**Files:**
- Create: `src/lib/admin/barrido.ts`
- Test: `src/lib/admin/__tests__/barrido.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `type Punto = { lat: number; lng: number }`
  - `type Caja = { sur: number; norte: number; oeste: number; este: number }`
  - `type Tesela = { centro: Punto; radio: number; clave: string }`
  - `type Estimacion = { llamadas: number; costoUsd: number; llamadasMax: number; costoMaxUsd: number }`
  - `puntoEnPoligono(p: Punto, poligono: readonly Punto[]): boolean`
  - `cajaDe(poligono: readonly Punto[]): Caja`
  - `celdaTocaPoligono(centro: Punto, altoLat: number, anchoLng: number, poligono: readonly Punto[]): boolean`
  - `teselar(poligono: readonly Punto[], radio?: number): Tesela[]`
  - `subdividir(t: Tesela): Tesela[]`
  - `estimarBarrido(teselas: number, verticales: number): Estimacion`
  - `esSaturada(n: number): boolean`
  - `claveTesela(centro: Punto, radio: number): string`
  - `claveTrabajo(tesela: Tesela, vertical: string): string`
  - Constantes: `RADIO_BASE`, `TOPE_NEARBY`, `PROFUNDIDAD_MAX`, `PRECIO_POR_LLAMADA_USD`, `FACTOR_DENSIDAD`, `METROS_POR_GRADO_LAT`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/admin/__tests__/barrido.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  cajaDe,
  celdaTocaPoligono,
  claveTesela,
  claveTrabajo,
  esSaturada,
  estimarBarrido,
  puntoEnPoligono,
  subdividir,
  teselar,
  PRECIO_POR_LLAMADA_USD,
  RADIO_BASE,
  type Punto,
} from "../barrido";

// Cuadrado de ~2.2 km de lado sobre Madrid, Cundinamarca.
const CUADRADO: Punto[] = [
  { lat: 4.72, lng: -74.28 },
  { lat: 4.72, lng: -74.26 },
  { lat: 4.74, lng: -74.26 },
  { lat: 4.74, lng: -74.28 },
];

// Una "L" cóncava: sirve para probar que el ray casting no se cree convexo.
const ELE: Punto[] = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 4 },
  { lat: 2, lng: 4 },
  { lat: 2, lng: 2 },
  { lat: 4, lng: 2 },
  { lat: 4, lng: 0 },
];

describe("puntoEnPoligono", () => {
  it("dice que sí para un punto claramente adentro", () => {
    expect(puntoEnPoligono({ lat: 4.73, lng: -74.27 }, CUADRADO)).toBe(true);
  });

  it("dice que no para un punto claramente afuera", () => {
    expect(puntoEnPoligono({ lat: 4.75, lng: -74.27 }, CUADRADO)).toBe(false);
  });

  it("respeta la concavidad: el hueco de una L queda afuera", () => {
    expect(puntoEnPoligono({ lat: 1, lng: 1 }, ELE)).toBe(true);
    expect(puntoEnPoligono({ lat: 3, lng: 3 }, ELE)).toBe(false);
  });

  it("no explota con un punto exactamente sobre un vértice", () => {
    // El ray casting no define el borde; solo exigimos que no lance.
    expect(typeof puntoEnPoligono({ lat: 4.72, lng: -74.28 }, CUADRADO)).toBe(
      "boolean",
    );
  });
});

describe("cajaDe", () => {
  it("saca la caja envolvente del polígono", () => {
    expect(cajaDe(CUADRADO)).toEqual({
      sur: 4.72,
      norte: 4.74,
      oeste: -74.28,
      este: -74.26,
    });
  });
});

describe("teselar", () => {
  it("cubre el polígono sin huecos: todo punto interior cae en alguna tesela", () => {
    const teselas = teselar(CUADRADO);
    const muestras: Punto[] = [];
    for (let i = 1; i < 10; i++) {
      for (let j = 1; j < 10; j++) {
        muestras.push({
          lat: 4.72 + (0.02 * i) / 10,
          lng: -74.28 + (0.02 * j) / 10,
        });
      }
    }
    for (const p of muestras) {
      const cubierto = teselas.some((t) => distanciaM(t.centro, p) <= t.radio);
      expect(cubierto, `sin cubrir: ${p.lat},${p.lng}`).toBe(true);
    }
  });

  it("descarta las celdas que no tocan el polígono", () => {
    // Franja delgada en diagonal: su caja envolvente es enorme comparada
    // con el área real, así que teselar debe botar la mayoría de celdas.
    const franja: Punto[] = [
      { lat: 4.72, lng: -74.28 },
      { lat: 4.7205, lng: -74.28 },
      { lat: 4.74, lng: -74.26 },
      { lat: 4.7395, lng: -74.26 },
    ];
    const conRecorte = teselar(franja).length;
    const caja = cajaDe(franja);
    const sinRecorte = teselar([
      { lat: caja.sur, lng: caja.oeste },
      { lat: caja.sur, lng: caja.este },
      { lat: caja.norte, lng: caja.este },
      { lat: caja.norte, lng: caja.oeste },
    ]).length;
    expect(conRecorte).toBeLessThan(sinRecorte / 2);
  });

  it("un polígono degenerado no explota ni devuelve vacío", () => {
    const punto: Punto[] = [
      { lat: 4.73, lng: -74.27 },
      { lat: 4.73, lng: -74.27 },
      { lat: 4.73, lng: -74.27 },
    ];
    expect(teselar(punto).length).toBeGreaterThanOrEqual(1);
  });

  it("usa el radio base por defecto", () => {
    expect(teselar(CUADRADO)[0].radio).toBe(RADIO_BASE);
  });
});

describe("subdividir", () => {
  it("parte una tesela en 4 de la mitad del radio", () => {
    const t = { centro: { lat: 4.73, lng: -74.27 }, radio: 400, clave: "x" };
    const hijas = subdividir(t);
    expect(hijas).toHaveLength(4);
    expect(hijas.every((h) => h.radio === 200)).toBe(true);
    expect(new Set(hijas.map((h) => h.clave)).size).toBe(4);
  });

  it("las hijas cubren el cuadrado de la madre", () => {
    const t = { centro: { lat: 4.73, lng: -74.27 }, radio: 400, clave: "x" };
    const hijas = subdividir(t);
    // El centro de la madre queda cubierto por alguna hija.
    expect(hijas.some((h) => distanciaM(h.centro, t.centro) <= h.radio)).toBe(true);
  });
});

describe("estimarBarrido", () => {
  it("multiplica teselas por verticales y aplica el precio verificado", () => {
    const e = estimarBarrido(31, 10);
    expect(e.llamadas).toBe(310);
    expect(e.costoUsd).toBeCloseTo(310 * PRECIO_POR_LLAMADA_USD, 5);
    expect(e.llamadasMax).toBeGreaterThan(e.llamadas);
    expect(e.costoMaxUsd).toBeGreaterThan(e.costoUsd);
  });

  it("sin verticales no hay llamadas", () => {
    expect(estimarBarrido(31, 0).llamadas).toBe(0);
  });
});

describe("esSaturada", () => {
  it("20 resultados es el techo de Nearby Search: hay negocios sin ver", () => {
    expect(esSaturada(20)).toBe(true);
  });

  it("19 no está saturada", () => {
    expect(esSaturada(19)).toBe(false);
  });
});

describe("claveTesela / claveTrabajo", () => {
  it("la clave es estable para el mismo centro y radio", () => {
    const c = { lat: 4.73, lng: -74.27 };
    expect(claveTesela(c, 400)).toBe(claveTesela({ ...c }, 400));
  });

  it("distinto radio, distinta clave", () => {
    const c = { lat: 4.73, lng: -74.27 };
    expect(claveTesela(c, 400)).not.toBe(claveTesela(c, 200));
  });

  it("el trabajo distingue la vertical: la misma tesela se barre una vez por vertical", () => {
    const t = { centro: { lat: 4.73, lng: -74.27 }, radio: 400, clave: "x" };
    expect(claveTrabajo(t, "ferreteria")).not.toBe(claveTrabajo(t, "panaderia"));
  });
});

describe("celdaTocaPoligono", () => {
  it("una celda dentro del polígono toca", () => {
    expect(celdaTocaPoligono({ lat: 4.73, lng: -74.27 }, 0.002, 0.002, CUADRADO)).toBe(
      true,
    );
  });

  it("una celda lejos del polígono no toca", () => {
    expect(celdaTocaPoligono({ lat: 5.5, lng: -73.5 }, 0.002, 0.002, CUADRADO)).toBe(
      false,
    );
  });

  it("una celda que el borde cruza sin meter vértices adentro sí toca", () => {
    // Celda centrada justo sobre el borde norte del cuadrado.
    expect(celdaTocaPoligono({ lat: 4.74, lng: -74.27 }, 0.002, 0.002, CUADRADO)).toBe(
      true,
    );
  });
});

/** Haversine, solo para las aserciones de cobertura del test. */
function distanciaM(a: Punto, b: Punto): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
npm test -- barrido
```

Esperado: FAIL — `Failed to resolve import "../barrido"`.

- [ ] **Step 3: Implementar**

Crear `src/lib/admin/barrido.ts`:

```ts
// Geometría del barrido de territorios. Todo aquí es puro y sin red: es donde
// vive el riesgo (un hueco en la rejilla = censo incompleto; una celda de más
// = plata quemada en Google).

export type Punto = { lat: number; lng: number };
export type Caja = { sur: number; norte: number; oeste: number; este: number };
export type Tesela = { centro: Punto; radio: number; clave: string };
export type Estimacion = {
  llamadas: number;
  costoUsd: number;
  llamadasMax: number;
  costoMaxUsd: number;
};

/** Radio en metros de la tesela base. 400 m ≈ 31 celdas para el casco de Madrid. */
export const RADIO_BASE = 400;

/** Nearby Search (New) devuelve máximo 20 resultados y NO pagina. Verificado
 * contra la doc el 2026-08-31: si vuelven 20, hay negocios que no vimos. */
export const TOPE_NEARBY = 20;

/** Cuántas veces se puede partir una celda saturada. Acota el gasto: una celda
 * con profundidad 2 cuesta como máximo 1 + 4 + 16 llamadas por vertical. */
export const PROFUNDIDAD_MAX = 2;

/** Nearby Search Enterprise = US$35/1.000 llamadas (verificado 2026-08-31). */
export const PRECIO_POR_LLAMADA_USD = 0.035;

/** Margen sobre la estimación base por la subdivisión adaptativa. */
export const FACTOR_DENSIDAD = 1.4;

export const METROS_POR_GRADO_LAT = 111_320;

function metrosPorGradoLng(lat: number): number {
  return METROS_POR_GRADO_LAT * Math.cos((lat * Math.PI) / 180);
}

/** Ray casting. El borde exacto queda indefinido a propósito: los resultados
 * de Places nunca caen justo sobre la línea que dibujó un humano. */
export function puntoEnPoligono(p: Punto, poligono: readonly Punto[]): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i];
    const b = poligono[j];
    if (a.lat > p.lat === b.lat > p.lat) continue;
    const lngCorte = ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng;
    if (p.lng < lngCorte) dentro = !dentro;
  }
  return dentro;
}

export function cajaDe(poligono: readonly Punto[]): Caja {
  const lats = poligono.map((p) => p.lat);
  const lngs = poligono.map((p) => p.lng);
  return {
    sur: Math.min(...lats),
    norte: Math.max(...lats),
    oeste: Math.min(...lngs),
    este: Math.max(...lngs),
  };
}

function orientacion(a: Punto, b: Punto, c: Punto): number {
  return (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
}

/** Cruce propio de dos segmentos (colineales y roces no cuentan: los cubren
 * las pruebas de vértices y esquinas de celdaTocaPoligono). */
function segmentosCruzan(a1: Punto, a2: Punto, b1: Punto, b2: Punto): boolean {
  const d1 = orientacion(b1, b2, a1);
  const d2 = orientacion(b1, b2, a2);
  const d3 = orientacion(a1, a2, b1);
  const d4 = orientacion(a1, a2, b2);
  return d1 > 0 !== d2 > 0 && d3 > 0 !== d4 > 0;
}

/** ¿La celda rectangular centrada en `centro` toca el polígono? Tres pruebas,
 * porque ninguna sola basta: centro/esquinas adentro (celda dentro del área),
 * vértice del polígono adentro (área pequeña dentro de la celda) y cruce de
 * aristas (una franja delgada que atraviesa la celda en diagonal). */
export function celdaTocaPoligono(
  centro: Punto,
  altoLat: number,
  anchoLng: number,
  poligono: readonly Punto[],
): boolean {
  const sur = centro.lat - altoLat / 2;
  const norte = centro.lat + altoLat / 2;
  const oeste = centro.lng - anchoLng / 2;
  const este = centro.lng + anchoLng / 2;
  const esquinas: Punto[] = [
    { lat: sur, lng: oeste },
    { lat: sur, lng: este },
    { lat: norte, lng: este },
    { lat: norte, lng: oeste },
  ];

  if (puntoEnPoligono(centro, poligono)) return true;
  if (esquinas.some((q) => puntoEnPoligono(q, poligono))) return true;
  if (
    poligono.some(
      (v) => v.lat >= sur && v.lat <= norte && v.lng >= oeste && v.lng <= este,
    )
  ) {
    return true;
  }

  for (let i = 0; i < poligono.length; i++) {
    const a = poligono[i];
    const b = poligono[(i + 1) % poligono.length];
    for (let k = 0; k < 4; k++) {
      if (segmentosCruzan(a, b, esquinas[k], esquinas[(k + 1) % 4])) return true;
    }
  }
  return false;
}

export function claveTesela(centro: Punto, radio: number): string {
  return `${centro.lat.toFixed(5)},${centro.lng.toFixed(5)}@${Math.round(radio)}`;
}

/** Una tesela se barre UNA VEZ POR VERTICAL: la unidad de trabajo (y lo que se
 * anota en territorios.teselas_hechas) es el par. */
export function claveTrabajo(tesela: Tesela, vertical: string): string {
  return `${tesela.clave}#${vertical}`;
}

/** Rejilla de círculos que cubre el polígono. Separación r·√2: es la que
 * garantiza que el cuadrado inscrito de cada círculo tesele el plano sin
 * huecos. Las celdas que no tocan el polígono se botan — dibujar una franja
 * cuesta lo que mide la franja, no lo que mide su caja. */
export function teselar(
  poligono: readonly Punto[],
  radio: number = RADIO_BASE,
): Tesela[] {
  const caja = cajaDe(poligono);
  const paso = radio * Math.SQRT2;
  const pasoLat = paso / METROS_POR_GRADO_LAT;
  const latMedia = (caja.sur + caja.norte) / 2;
  const pasoLng = paso / metrosPorGradoLng(latMedia);

  const filas = Math.max(1, Math.ceil((caja.norte - caja.sur) / pasoLat));
  const columnas = Math.max(1, Math.ceil((caja.este - caja.oeste) / pasoLng));

  const teselas: Tesela[] = [];
  for (let f = 0; f < filas; f++) {
    const lat = caja.sur + (f + 0.5) * pasoLat;
    for (let c = 0; c < columnas; c++) {
      const lng = caja.oeste + (c + 0.5) * pasoLng;
      const centro = { lat, lng };
      if (filas * columnas > 1 && !celdaTocaPoligono(centro, pasoLat, pasoLng, poligono)) {
        continue;
      }
      teselas.push({ centro, radio, clave: claveTesela(centro, radio) });
    }
  }
  return teselas;
}

/** Parte una tesela saturada en 4 de la mitad del radio. */
export function subdividir(t: Tesela): Tesela[] {
  const subRadio = t.radio / 2;
  const desplazamiento = (t.radio * Math.SQRT2) / 4;
  const dLat = desplazamiento / METROS_POR_GRADO_LAT;
  const dLng = desplazamiento / metrosPorGradoLng(t.centro.lat);
  return [
    { lat: t.centro.lat - dLat, lng: t.centro.lng - dLng },
    { lat: t.centro.lat - dLat, lng: t.centro.lng + dLng },
    { lat: t.centro.lat + dLat, lng: t.centro.lng - dLng },
    { lat: t.centro.lat + dLat, lng: t.centro.lng + dLng },
  ].map((centro) => ({
    centro,
    radio: subRadio,
    clave: claveTesela(centro, subRadio),
  }));
}

export function estimarBarrido(teselas: number, verticales: number): Estimacion {
  const llamadas = teselas * verticales;
  const llamadasMax = Math.ceil(llamadas * FACTOR_DENSIDAD);
  return {
    llamadas,
    costoUsd: llamadas * PRECIO_POR_LLAMADA_USD,
    llamadasMax,
    costoMaxUsd: llamadasMax * PRECIO_POR_LLAMADA_USD,
  };
}

export function esSaturada(n: number): boolean {
  return n >= TOPE_NEARBY;
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

```bash
npm test -- barrido
```

Esperado: PASS, todos los `describe`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/barrido.ts src/lib/admin/__tests__/barrido.test.ts
git commit -m "prospección: geometría del barrido (teselado, recorte y estimación)"
```

---

### Task 3: Verticales → tipos de Google

Las 10 verticales de `zak.ts` traen `matchers`, que son substrings para clasificar `negocios.categoria`. **No sirven como `includedTypes`**, que exige identificadores exactos de la Tabla A de Places. Este archivo es el puente.

**Files:**
- Create: `src/lib/admin/verticales-places.ts`
- Test: `src/lib/admin/__tests__/verticales-places.test.ts`

**Interfaces:**
- Consumes: `VERTICALES_PROSPECCION` de `src/lib/admin/zak.ts`
- Produces:
  - `TIPOS_POR_VERTICAL: Readonly<Record<string, readonly string[]>>`
  - `tiposDeVertical(slug: string): readonly string[]`

- [ ] **Step 1: Verificar los identificadores contra la Tabla A de Google**

Abrir `https://developers.google.com/maps/documentation/places/web-service/place-types` y confirmar uno por uno los tipos del Step 3. Un tipo inexistente hace que Google devuelva `INVALID_ARGUMENT` y **la tesela entera se pierde en silencio**. Corregir la lista si algún identificador no aparece en la Tabla A.

- [ ] **Step 2: Escribir el test que falla**

Crear `src/lib/admin/__tests__/verticales-places.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { VERTICALES_PROSPECCION } from "../zak";
import { TIPOS_POR_VERTICAL, tiposDeVertical } from "../verticales-places";

describe("TIPOS_POR_VERTICAL", () => {
  it("toda vertical del catálogo tiene al menos un tipo de Google", () => {
    for (const v of VERTICALES_PROSPECCION) {
      expect(tiposDeVertical(v.slug), `vertical sin tipos: ${v.slug}`).not.toHaveLength(0);
    }
  });

  it("no inventa verticales que el catálogo no tenga", () => {
    const slugs = new Set(VERTICALES_PROSPECCION.map((v) => v.slug));
    for (const slug of Object.keys(TIPOS_POR_VERTICAL)) {
      expect(slugs.has(slug), `vertical fantasma: ${slug}`).toBe(true);
    }
  });

  it("los tipos son identificadores de Google, no prosa", () => {
    for (const tipos of Object.values(TIPOS_POR_VERTICAL)) {
      for (const t of tipos) {
        expect(t, `tipo mal formado: ${t}`).toMatch(/^[a-z][a-z0-9_]*$/);
      }
    }
  });

  it("una vertical desconocida devuelve vacío en vez de romper el barrido", () => {
    expect(tiposDeVertical("no-existe")).toEqual([]);
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

```bash
npm test -- verticales-places
```

Esperado: FAIL — `Failed to resolve import "../verticales-places"`.

- [ ] **Step 4: Implementar**

Crear `src/lib/admin/verticales-places.ts`:

```ts
// Puente entre las verticales de prospección (que ya traen su plantilla de
// WhatsApp en zak.ts) y los includedTypes de la Tabla A de Places.
//
// Los `matchers` de zak.ts NO sirven aquí: son substrings para clasificar
// negocios.categoria después del hecho. includedTypes exige identificadores
// exactos, y uno inventado hace que Google devuelva INVALID_ARGUMENT.

export const TIPOS_POR_VERTICAL: Readonly<Record<string, readonly string[]>> = {
  restaurante: ["restaurant", "cafe", "bar", "meal_takeaway"],
  panaderia: ["bakery"],
  ferreteria: ["hardware_store", "home_improvement_store"],
  veterinaria: ["veterinary_care", "pet_store"],
  farmacia: ["pharmacy", "drugstore"],
  belleza: ["beauty_salon", "hair_salon", "nail_salon", "spa", "barber_shop"],
  taller: ["car_repair", "car_wash", "auto_parts_store"],
  hogar: ["furniture_store", "home_goods_store"],
  moda: ["clothing_store", "shoe_store", "jewelry_store"],
  comercio: ["grocery_store", "supermarket", "convenience_store", "florist"],
};

export function tiposDeVertical(slug: string): readonly string[] {
  return TIPOS_POR_VERTICAL[slug] ?? [];
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

```bash
npm test -- verticales-places
```

Esperado: PASS. Si falla "toda vertical del catálogo tiene al menos un tipo", el catálogo de `zak.ts` tiene un slug que no está mapeado — añadirlo, no borrar el test.

- [ ] **Step 6: Commit**

```bash
git add src/lib/admin/verticales-places.ts src/lib/admin/__tests__/verticales-places.test.ts
git commit -m "prospección: mapeo de verticales a includedTypes de Places"
```

---

### Task 4: `localidadDe` reemplaza a `inferirCiudad`

Hoy la ciudad se adivina con substring-match de "madrid"/"ubate"/"bogota" sobre la dirección. Con territorios libres eso no sirve: se lee la localidad real que manda Google en `addressComponents`.

**Files:**
- Modify: `src/lib/admin/places.ts`
- Modify: `src/app/admin/api/places/search/route.ts`
- Test: `src/lib/admin/__tests__/places.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `type ComponenteDireccion = { longText?: string; shortText?: string; types?: string[] }`
  - `localidadDe(componentes: ComponenteDireccion[] | undefined): string | null`
  - `placeANegocio(place: PlaceApi): ResultadoPlace` — **pierde el segundo parámetro `sesgo`**
  - `ResultadoPlace.ciudad` pasa de `Ciudad` a `string | null`
  - `PlaceApi` gana `addressComponents?: ComponenteDireccion[]`
  - `inferirCiudad` **se elimina**

- [ ] **Step 1: Escribir el test que falla**

En `src/lib/admin/__tests__/places.test.ts`: quitar el import de `inferirCiudad` y su bloque `describe`, añadir `addressComponents` a la fixture `FERRETERIA_UBATE`, cambiar la expectativa de `ciudad` a `"Ubaté"`, y añadir:

```ts
import { localidadDe } from "../places";

// Añadir dentro de la fixture FERRETERIA_UBATE:
//   addressComponents: [
//     { longText: "Ubaté", shortText: "Ubaté", types: ["locality", "political"] },
//     { longText: "Cundinamarca", types: ["administrative_area_level_1"] },
//     { longText: "Colombia", types: ["country"] },
//   ],
// y cambiar la expectativa de `ciudad` de "ubate" a "Ubaté".

describe("localidadDe", () => {
  it("saca el municipio del componente locality", () => {
    expect(
      localidadDe([
        { longText: "Madrid", types: ["locality", "political"] },
        { longText: "Cundinamarca", types: ["administrative_area_level_1"] },
      ]),
    ).toBe("Madrid");
  });

  it("cae a administrative_area_level_2 cuando no hay locality", () => {
    expect(
      localidadDe([
        { longText: "Ubaté", types: ["administrative_area_level_2"] },
        { longText: "Colombia", types: ["country"] },
      ]),
    ).toBe("Ubaté");
  });

  it("devuelve null cuando Google no manda localidad", () => {
    expect(localidadDe([{ longText: "Colombia", types: ["country"] }])).toBeNull();
    expect(localidadDe(undefined)).toBeNull();
    expect(localidadDe([])).toBeNull();
  });

  it("no confunde 'Madrid, España' con Madrid Cundinamarca: la localidad es literal", () => {
    // regionCode=CO en el handler evita el caso; aquí solo se exige que la
    // función NO normalice ni adivine nada.
    expect(localidadDe([{ longText: "Madrid", types: ["locality"] }])).toBe("Madrid");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
npm test -- places
```

Esperado: FAIL — `localidadDe` no existe y la expectativa de `ciudad` no cuadra.

- [ ] **Step 3: Implementar**

En `src/lib/admin/places.ts`:

1. Borrar el import de `Ciudad` (dejar `TipoTelefono`) y la función `inferirCiudad` completa.
2. Añadir el tipo y la función:

```ts
export type ComponenteDireccion = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

/** El municipio tal como lo manda Google. En Colombia `locality` es el
 * municipio; algunos rurales solo traen `administrative_area_level_2`.
 * Sin adivinanzas por substring: si Google no lo dice, es null. */
export function localidadDe(
  componentes: ComponenteDireccion[] | undefined,
): string | null {
  if (!componentes || componentes.length === 0) return null;
  const porTipo = (t: string) =>
    componentes.find((c) => c.types?.includes(t))?.longText ?? null;
  return porTipo("locality") ?? porTipo("administrative_area_level_2") ?? null;
}
```

3. En `PlaceApi`, añadir `addressComponents?: ComponenteDireccion[];`.
4. En `ResultadoPlace`, cambiar `ciudad: Ciudad` por `ciudad: string | null`.
5. En `placeANegocio`, quitar el parámetro `sesgo` y usar `ciudad: localidadDe(place.addressComponents)`.

En `src/app/admin/api/places/search/route.ts`:

6. Añadir `"places.addressComponents",` al `FIELD_MASK`, con el comentario:

```ts
  // addressComponents es tier Pro y ya pagamos Enterprise por el teléfono:
  // entra sin subir la factura (verificado 2026-08-31).
  "places.addressComponents",
```

7. Quitar el cálculo de `sesgo` y la llamada `placeANegocio(p, sesgo)` → `placeANegocio(p)`. `CIUDADES` sigue usándose para el `locationBias` de la búsqueda de texto **hasta la Task 6**, que lo elimina.

- [ ] **Step 4: Correr los tests y verificar que pasan**

```bash
npm test -- places
npx tsc --noEmit
```

Esperado: PASS y typecheck limpio salvo los usos de `Ciudad` que la Task 6 arregla; si `tsc` se queja de `ResultadoPlace.ciudad` en `actions.ts`, es esperado y se resuelve en la Task 6.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/places.ts src/lib/admin/__tests__/places.test.ts "src/app/admin/api/places/search/route.ts"
git commit -m "prospección: la ciudad sale de addressComponents, no de adivinar la dirección"
```

---

### Task 5: SQL — `territorios` y la muerte del enum `ciudad`

**Files:**
- Create: `supabase/prospeccion.sql`

**Interfaces:**
- Consumes: `supabase/schema.sql` (tabla `negocios`, enum `public.ciudad`), `supabase/rls.sql` (patrón de política solo-admin)
- Produces: tabla `public.territorios`; `negocios.territorio_id`; `negocios.ciudad` como `text`; el tipo `public.ciudad` deja de existir

- [ ] **Step 1: Confirmar que nada más depende del enum**

```bash
grep -rn "public.ciudad\|::ciudad" supabase/
```

Esperado: solo `schema.sql:13` (la definición) y `schema.sql:35` (la columna). Si aparece otra tabla, **DETENERSE**: el `drop type` no es seguro y hay que replanificar.

- [ ] **Step 2: Escribir el SQL**

Crear `supabase/prospeccion.sql`:

```sql
-- Panel de admin Zakumi — territorios de prospección.
-- Spec: docs/superpowers/specs/2026-08-31-mapa-prospeccion-design.md
--
-- ⚠️ ORDEN: este archivo corre ANTES de desplegar el código nuevo. Quita el
-- enum public.ciudad; si el código nuevo sube primero, la lista de leads se cae.

create table if not exists public.territorios (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null check (length(nombre) between 1 and 120),
  -- [{lat,lng}, …]. Sin PostGIS a propósito: el recorte por polígono corre en
  -- TypeScript sobre los ≤20 resultados que Google acaba de devolver.
  poligono       jsonb not null,
  -- Caja envolvente desnormalizada: "¿qué territorios tocan esta vista?" sin
  -- abrir el jsonb.
  bbox_sur       double precision not null check (bbox_sur between -90 and 90),
  bbox_norte     double precision not null check (bbox_norte between -90 and 90),
  bbox_oeste     double precision not null check (bbox_oeste between -180 and 180),
  bbox_este      double precision not null check (bbox_este between -180 and 180),
  verticales     text[] not null default '{}',
  -- Claves "lat,lng@radio#vertical" ya barridas: permite reanudar sin volver a
  -- pagarle a Google lo ya comprado.
  teselas_hechas jsonb not null default '[]',
  llamadas       int not null default 0 check (llamadas >= 0),
  ultimo_barrido timestamptz,
  creado_por     uuid references auth.users (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists territorios_creado_por_idx on public.territorios (creado_por);

drop trigger if exists territorios_updated_at on public.territorios;
create trigger territorios_updated_at
  before update on public.territorios
  for each row execute function public.tocar_updated_at();

-- ---- negocios: territorio de origen ------------------------------------------

alter table public.negocios
  add column if not exists territorio_id uuid
  references public.territorios (id) on delete set null;

create index if not exists negocios_territorio_idx on public.negocios (territorio_id);

-- ---- muerte del enum ciudad ---------------------------------------------------
-- Con territorios libres, un enum de tres municipios es una jaula. Verificado
-- que public.ciudad SOLO lo usa negocios.ciudad.

alter table public.negocios alter column ciudad drop default;
alter table public.negocios alter column ciudad type text using ciudad::text;
update public.negocios set ciudad = null where ciudad = 'otra';
drop type if exists public.ciudad;

-- ---- RLS: CRM interno, solo admin (mismo patrón que negocios) ------------------

alter table public.territorios enable row level security;

drop policy if exists territorios_solo_admin on public.territorios;
create policy territorios_solo_admin on public.territorios
  for all
  using (public.es_admin())
  with check (public.es_admin());

revoke all on public.territorios from anon;
```

- [ ] **Step 3: Verificar los nombres del trigger y del helper de RLS**

```bash
grep -n "updated_at()\|function public.es_admin\|public.es_admin()" supabase/schema.sql supabase/rls.sql | head
```

Esperado: aparecen la función del trigger `updated_at` y el helper de admin. **Si se llaman distinto** (p. ej. `public.set_updated_at()` o `public.is_admin()`), corregir `prospeccion.sql` para usar los nombres reales. Este paso existe porque un nombre inventado hace fallar el script a mitad de camino, dejando la migración a medias.

- [ ] **Step 4: Correrlo en Supabase**

Pegar el archivo completo en el SQL Editor de Supabase y ejecutarlo. Luego verificar:

```sql
select column_name, data_type from information_schema.columns
 where table_name = 'negocios' and column_name in ('ciudad','territorio_id');
select 1 from pg_type where typname = 'ciudad';
```

Esperado: `ciudad` es `text`, `territorio_id` es `uuid`, y la consulta de `pg_type` devuelve **0 filas**.

- [ ] **Step 5: Commit**

```bash
git add supabase/prospeccion.sql
git commit -m "prospección: tabla territorios y ciudad como texto libre"
```

---

### Task 6: Matar `Ciudad` en TypeScript

**Files:**
- Modify: `src/lib/admin/negocios.ts`
- Modify: `src/lib/admin/actions.ts`
- Modify: `src/app/admin/api/places/search/route.ts`
- Modify: `src/components/admin/mapa/MapCanvas.tsx`, `MapaView.tsx`, `NuevoNegocioForm.tsx`
- Modify: `src/components/admin/negocios/NegociosView.tsx`
- Test: `src/lib/admin/__tests__/negocios.test.ts`

**Interfaces:**
- Consumes: `localidadDe` (Task 4)
- Produces:
  - `Negocio.ciudad: string | null`
  - `ciudadesDe(negocios: Negocio[]): string[]` — las ciudades presentes en la base, ordenadas, para armar el filtro
  - `Ciudad` y `CIUDADES` **eliminados**

- [ ] **Step 1: Escribir el test que falla**

Añadir a `src/lib/admin/__tests__/negocios.test.ts`:

```ts
import { ciudadesDe } from "../negocios";
import type { Negocio } from "../negocios";

function negocioCon(ciudad: string | null): Negocio {
  return {
    id: crypto.randomUUID(),
    nombre: "N",
    direccion: null,
    ciudad,
    lat: 4.7,
    lng: -74.2,
    categoria: null,
    rating: null,
    sitio_web: null,
    telefono: null,
    tipo_telefono: "desconocido",
    google_place_id: null,
    fuente: "manual",
    estado: "nuevo",
    territorio_id: null,
    creado_por: null,
    created_at: "2026-08-31T00:00:00Z",
    updated_at: "2026-08-31T00:00:00Z",
  };
}

describe("ciudadesDe", () => {
  it("saca las ciudades presentes, sin repetir y ordenadas", () => {
    expect(
      ciudadesDe([negocioCon("Ubaté"), negocioCon("Madrid"), negocioCon("Ubaté")]),
    ).toEqual(["Madrid", "Ubaté"]);
  });

  it("ignora los negocios sin ciudad en vez de meter un hueco en el filtro", () => {
    expect(ciudadesDe([negocioCon(null), negocioCon("Madrid")])).toEqual(["Madrid"]);
  });

  it("sin negocios, sin ciudades", () => {
    expect(ciudadesDe([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
npm test -- negocios
```

Esperado: FAIL — `ciudadesDe` no existe y `territorio_id` no está en el tipo `Negocio`.

- [ ] **Step 3: Implementar**

En `src/lib/admin/negocios.ts`:

```ts
// Reemplazar `export type Ciudad = …` (borrarlo) y en `Negocio`:
//   ciudad: string | null;
//   territorio_id: string | null;   // ← nuevo, junto a google_place_id
// Borrar el bloque `export const CIUDADES = […] as const;` completo.

/** Las ciudades que existen en la base, para armar el filtro de la lista de
 * leads. Antes era una constante de tres municipios; con territorios libres la
 * única fuente honesta son los datos. */
export function ciudadesDe(negocios: readonly Negocio[]): string[] {
  const vistas = new Set<string>();
  for (const n of negocios) {
    if (n.ciudad) vistas.add(n.ciudad);
  }
  return [...vistas].sort((a, b) => a.localeCompare(b, "es"));
}
```

Luego seguir los errores de `npx tsc --noEmit` uno por uno:

- `actions.ts` — `importarNegocios` inserta `ciudad`; ya es `string | null`, sin cambio de lógica. Añadir `territorio_id: null` si el insert enumera columnas.
- `zak.ts` — `FichaNegocio.ciudad` está declarado como `Negocio["ciudad"]`, así que **sigue el tipo solo**; `COLUMNAS_FICHA` no cambia. Verificar que `fichaDeNegocio` y sus tests sigan verdes: si un test fija `ciudad: "madrid"` en minúscula, actualizarlo al nombre real que ahora manda Google (`"Madrid"`).
- `search/route.ts` — quitar el import y el uso de `CIUDADES`. **El `locationBias` de la búsqueda de texto pasa a recibir el centro y el radio del viewport actual del mapa**, enviados por el cliente como `centro?: {lat,lng}` y `radio?: number` en el body (validar `radio` entre 1.000 y 50.000; si no vienen, no mandar `locationBias`).
- `MapCanvas.tsx` — quitar `CIUDADES`, la constante `MADRID` y el componente `RecentrarCiudad`. `defaultCenter` pasa a ser una constante local `CENTRO_INICIAL = { lat: 4.7326, lng: -74.2642 }` con el comentario de que es solo el encuadre de arranque, no un preset de búsqueda.
- `MapaView.tsx` — quitar `PESTANAS_CIUDAD`, el estado `ciudadActiva` y el `<Tabs>` de ciudades del header.
- `NuevoNegocioForm.tsx` — `ciudadSugerida` pasa a `string | null` (o se elimina el prop si el formulario ya no lo necesita; preferir eliminarlo).
- `NegociosView.tsx` — el `<Select>` de ciudad se alimenta de `ciudadesDe(negocios)`; el estado pasa de `Ciudad | "todas"` a `string | "todas"`.

- [ ] **Step 4: Correr todo y verificar que pasa**

```bash
npm test
npx tsc --noEmit
npm run lint
```

Esperado: PASS, typecheck limpio, lint limpio. **Cero referencias a `Ciudad` o `CIUDADES`:**

```bash
grep -rn "CIUDADES\|\bCiudad\b" src/ | grep -v "ciudades" | head
```

Esperado: sin resultados.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/negocios.ts src/lib/admin/actions.ts src/lib/admin/__tests__/negocios.test.ts "src/app/admin/api/places/search/route.ts" src/components/admin/mapa/ src/components/admin/negocios/NegociosView.tsx
git commit -m "prospección: fuera el enum de tres ciudades, la ciudad ahora es un dato"
```

---

### Task 7: Territorios — acceso a datos y acciones

**Files:**
- Create: `src/lib/admin/territorios.ts`
- Create: `src/lib/admin/territorios-actions.ts`
- Test: `src/lib/admin/__tests__/territorios.test.ts`

**Interfaces:**
- Consumes: `cajaDe`, `Punto` (Task 2); `verifySession` de `src/lib/admin/dal.ts`
- Produces:
  - `type Territorio = { id, nombre, poligono: Punto[], bbox_sur, bbox_norte, bbox_oeste, bbox_este, verticales: string[], teselas_hechas: string[], llamadas: number, ultimo_barrido: string | null, creado_por: string | null, created_at: string, updated_at: string }`
  - `filasDeTerritorio(poligono: Punto[], nombre: string): { nombre, poligono, bbox_sur, bbox_norte, bbox_oeste, bbox_este }`
  - `poligonoValido(poligono: readonly Punto[]): boolean`
  - `crearTerritorio(nombre: string, poligono: Punto[]): Promise<{ id: string } | { error: string }>`
  - `renombrarTerritorio(id: string, nombre: string): Promise<{ ok: true } | { error: string }>`
  - `eliminarTerritorio(id: string): Promise<{ ok: true } | { error: string }>`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/admin/__tests__/territorios.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { filasDeTerritorio, poligonoValido } from "../territorios";
import type { Punto } from "../barrido";

const CUADRADO: Punto[] = [
  { lat: 4.72, lng: -74.28 },
  { lat: 4.72, lng: -74.26 },
  { lat: 4.74, lng: -74.26 },
  { lat: 4.74, lng: -74.28 },
];

describe("poligonoValido", () => {
  it("un cuadrado sirve", () => {
    expect(poligonoValido(CUADRADO)).toBe(true);
  });

  it("menos de 3 puntos no es un área", () => {
    expect(poligonoValido(CUADRADO.slice(0, 2))).toBe(false);
  });

  it("coordenadas fuera del planeta no sirven", () => {
    expect(poligonoValido([...CUADRADO, { lat: 91, lng: 0 }])).toBe(false);
    expect(poligonoValido([...CUADRADO, { lat: 0, lng: 181 }])).toBe(false);
  });

  it("un polígono absurdamente grande no sirve: barrerlo cuesta una fortuna", () => {
    expect(
      poligonoValido([
        { lat: -4, lng: -80 },
        { lat: -4, lng: -66 },
        { lat: 12, lng: -66 },
        { lat: 12, lng: -80 },
      ]),
    ).toBe(false);
  });
});

describe("filasDeTerritorio", () => {
  it("desnormaliza la caja envolvente junto al polígono", () => {
    expect(filasDeTerritorio(CUADRADO, "Madrid centro")).toEqual({
      nombre: "Madrid centro",
      poligono: CUADRADO,
      bbox_sur: 4.72,
      bbox_norte: 4.74,
      bbox_oeste: -74.28,
      bbox_este: -74.26,
    });
  });

  it("recorta el nombre a lo que aguanta la columna", () => {
    expect(filasDeTerritorio(CUADRADO, "x".repeat(200)).nombre).toHaveLength(120);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
npm test -- territorios
```

Esperado: FAIL — `Failed to resolve import "../territorios"`.

- [ ] **Step 3: Implementar el módulo puro + tipos**

Crear `src/lib/admin/territorios.ts`:

```ts
import { cajaDe, type Punto } from "./barrido";

export type Territorio = {
  id: string;
  nombre: string;
  poligono: Punto[];
  bbox_sur: number;
  bbox_norte: number;
  bbox_oeste: number;
  bbox_este: number;
  verticales: string[];
  teselas_hechas: string[];
  llamadas: number;
  ultimo_barrido: string | null;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
};

export const NOMBRE_MAX = 120;

/** Grados de lado máximos de la caja. ~1.1° ≈ 120 km: más que eso no es un
 * territorio de prospección, es una factura de Google. */
export const LADO_MAX_GRADOS = 1.1;

export function poligonoValido(poligono: readonly Punto[]): boolean {
  if (poligono.length < 3) return false;
  const enElPlaneta = poligono.every(
    (p) =>
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng) &&
      p.lat >= -90 &&
      p.lat <= 90 &&
      p.lng >= -180 &&
      p.lng <= 180,
  );
  if (!enElPlaneta) return false;
  const caja = cajaDe(poligono);
  return (
    caja.norte - caja.sur <= LADO_MAX_GRADOS &&
    caja.este - caja.oeste <= LADO_MAX_GRADOS
  );
}

export function filasDeTerritorio(poligono: Punto[], nombre: string) {
  const caja = cajaDe(poligono);
  return {
    nombre: nombre.trim().slice(0, NOMBRE_MAX),
    poligono,
    bbox_sur: caja.sur,
    bbox_norte: caja.norte,
    bbox_oeste: caja.oeste,
    bbox_este: caja.este,
  };
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

```bash
npm test -- territorios
```

Esperado: PASS.

- [ ] **Step 5: Implementar las server actions**

Crear `src/lib/admin/territorios-actions.ts`, siguiendo el patrón exacto de `src/lib/admin/actions.ts` (`"use server"` arriba, `verifySession()` en CADA action, `revalidatePath` al final):

```ts
"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "./dal";
import { filasDeTerritorio, poligonoValido, NOMBRE_MAX } from "./territorios";
import type { Punto } from "./barrido";

export async function crearTerritorio(
  nombre: string,
  poligono: Punto[],
): Promise<{ id: string } | { error: string }> {
  const { supabase } = await verifySession();

  if (typeof nombre !== "string" || nombre.trim().length === 0) {
    return { error: "Ponle un nombre al territorio." };
  }
  if (!Array.isArray(poligono) || !poligonoValido(poligono)) {
    return { error: "Dibuja un área válida y más chica que un departamento." };
  }

  const { data, error } = await supabase
    .from("territorios")
    .insert(filasDeTerritorio(poligono, nombre))
    .select("id")
    .single();

  if (error) {
    console.error("[territorios] error creando:", error.message);
    return { error: "No se pudo guardar el territorio." };
  }

  revalidatePath("/admin/prospeccion");
  return { id: data.id as string };
}

export async function renombrarTerritorio(
  id: string,
  nombre: string,
): Promise<{ ok: true } | { error: string }> {
  const { supabase } = await verifySession();
  const limpio = typeof nombre === "string" ? nombre.trim().slice(0, NOMBRE_MAX) : "";
  if (limpio.length === 0) return { error: "El nombre no puede quedar vacío." };

  const { error } = await supabase
    .from("territorios")
    .update({ nombre: limpio })
    .eq("id", id);

  if (error) {
    console.error("[territorios] error renombrando:", error.message);
    return { error: "No se pudo renombrar." };
  }
  revalidatePath("/admin/prospeccion");
  return { ok: true };
}

export async function eliminarTerritorio(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const { supabase } = await verifySession();
  // Los negocios NO se borran: territorio_id es ON DELETE SET NULL. Borrar un
  // territorio tira el mapa del barrido, nunca los leads que produjo.
  const { error } = await supabase.from("territorios").delete().eq("id", id);
  if (error) {
    console.error("[territorios] error eliminando:", error.message);
    return { error: "No se pudo eliminar el territorio." };
  }
  revalidatePath("/admin/prospeccion");
  return { ok: true };
}
```

- [ ] **Step 6: Verificar**

```bash
npm test
npx tsc --noEmit
```

Esperado: PASS y typecheck limpio.

- [ ] **Step 7: Commit**

```bash
git add src/lib/admin/territorios.ts src/lib/admin/territorios-actions.ts src/lib/admin/__tests__/territorios.test.ts
git commit -m "prospección: territorios — validación, caja envolvente y acciones"
```

---

### Task 8: El route handler de una tesela

Una request = una tesela × una vertical = una llamada a Google. Es el único lugar que toca la API key y el único que escribe negocios del barrido.

**Files:**
- Create: `src/app/admin/api/territorio/[id]/barrer/route.ts`
- Create: `src/lib/admin/barrido-servidor.ts`
- Test: `src/lib/admin/__tests__/barrido-servidor.test.ts`

**Interfaces:**
- Consumes: `puntoEnPoligono`, `esSaturada`, `claveTrabajo`, `Tesela`, `Punto` (Task 2); `tiposDeVertical` (Task 3); `placeANegocio`, `soloConTelefono`, `PlaceApi` (Task 4); `Territorio` (Task 7); `getSesionAdmin` de `dal.ts`
- Produces:
  - `type ResumenTesela = { encontrados: number; fueraDelArea: number; sinTelefono: number; insertados: number; saturada: boolean }`
  - `circuloDentroDelTerritorio(centro: Punto, radio: number, t: Territorio): boolean`
  - `recortarAlArea(resultados: ResultadoPlace[], poligono: Punto[]): ResultadoPlace[]`
  - `POST /admin/api/territorio/[id]/barrer` con body `{ centro: Punto; radio: number; vertical: string }` → `ResumenTesela`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/admin/__tests__/barrido-servidor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { circuloDentroDelTerritorio, recortarAlArea } from "../barrido-servidor";
import type { Territorio } from "../territorios";
import type { ResultadoPlace } from "../places";

const TERRITORIO: Territorio = {
  id: "t1",
  nombre: "Madrid centro",
  poligono: [
    { lat: 4.72, lng: -74.28 },
    { lat: 4.72, lng: -74.26 },
    { lat: 4.74, lng: -74.26 },
    { lat: 4.74, lng: -74.28 },
  ],
  bbox_sur: 4.72,
  bbox_norte: 4.74,
  bbox_oeste: -74.28,
  bbox_este: -74.26,
  verticales: [],
  teselas_hechas: [],
  llamadas: 0,
  ultimo_barrido: null,
  creado_por: null,
  created_at: "2026-08-31T00:00:00Z",
  updated_at: "2026-08-31T00:00:00Z",
};

function resultadoEn(lat: number, lng: number): ResultadoPlace {
  return {
    placeId: `${lat},${lng}`,
    nombre: "N",
    direccion: null,
    lat,
    lng,
    categoria: null,
    rating: null,
    sitioWeb: null,
    telefono: "+573001112233",
    tipoTelefono: "movil",
    ciudad: "Madrid",
    operativo: true,
    yaImportado: false,
  };
}

describe("circuloDentroDelTerritorio", () => {
  it("acepta un círculo dentro del área", () => {
    expect(circuloDentroDelTerritorio({ lat: 4.73, lng: -74.27 }, 400, TERRITORIO)).toBe(
      true,
    );
  });

  it("acepta un círculo sobre el borde: las teselas se desbordan por diseño", () => {
    expect(circuloDentroDelTerritorio({ lat: 4.74, lng: -74.27 }, 400, TERRITORIO)).toBe(
      true,
    );
  });

  it("rechaza barrer Bogotá desde un territorio de Madrid", () => {
    expect(circuloDentroDelTerritorio({ lat: 4.711, lng: -74.07 }, 400, TERRITORIO)).toBe(
      false,
    );
  });

  it("rechaza un radio fuera de rango: el endpoint no es un proxy abierto", () => {
    expect(circuloDentroDelTerritorio({ lat: 4.73, lng: -74.27 }, 49_000, TERRITORIO)).toBe(
      false,
    );
    expect(circuloDentroDelTerritorio({ lat: 4.73, lng: -74.27 }, 0, TERRITORIO)).toBe(
      false,
    );
  });
});

describe("recortarAlArea", () => {
  it("bota lo que el círculo trajo de fuera del polígono", () => {
    const dentro = resultadoEn(4.73, -74.27);
    const fuera = resultadoEn(4.75, -74.27);
    expect(recortarAlArea([dentro, fuera], TERRITORIO.poligono)).toEqual([dentro]);
  });

  it("sin resultados devuelve vacío", () => {
    expect(recortarAlArea([], TERRITORIO.poligono)).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
npm test -- barrido-servidor
```

Esperado: FAIL — `Failed to resolve import "../barrido-servidor"`.

- [ ] **Step 3: Implementar el módulo puro**

Crear `src/lib/admin/barrido-servidor.ts`:

```ts
import { METROS_POR_GRADO_LAT, puntoEnPoligono, type Punto } from "./barrido";
import type { ResultadoPlace } from "./places";
import type { Territorio } from "./territorios";

export type ResumenTesela = {
  encontrados: number;
  fueraDelArea: number;
  sinTelefono: number;
  insertados: number;
  saturada: boolean;
};

export const RADIO_MIN = 50;
export const RADIO_MAX = 1_000;

/** El endpoint recibe el círculo del cliente, así que hay que atarlo al
 * territorio guardado: si no, es un proxy con el que barrer Colombia entera a
 * nombre de Zakumi. Se admite desbordarse del borde (las teselas se desbordan
 * por diseño) pero no salirse de la caja más de un radio. */
export function circuloDentroDelTerritorio(
  centro: Punto,
  radio: number,
  t: Territorio,
): boolean {
  if (!Number.isFinite(radio) || radio < RADIO_MIN || radio > RADIO_MAX) return false;
  if (!Number.isFinite(centro.lat) || !Number.isFinite(centro.lng)) return false;

  const margenLat = radio / METROS_POR_GRADO_LAT;
  const margenLng =
    radio / (METROS_POR_GRADO_LAT * Math.cos((centro.lat * Math.PI) / 180));

  return (
    centro.lat >= t.bbox_sur - margenLat &&
    centro.lat <= t.bbox_norte + margenLat &&
    centro.lng >= t.bbox_oeste - margenLng &&
    centro.lng <= t.bbox_este + margenLng
  );
}

/** Los círculos se desbordan del área dibujada; lo de afuera no se guarda. */
export function recortarAlArea(
  resultados: ResultadoPlace[],
  poligono: readonly Punto[],
): ResultadoPlace[] {
  return resultados.filter((r) => puntoEnPoligono({ lat: r.lat, lng: r.lng }, poligono));
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

```bash
npm test -- barrido-servidor
```

Esperado: PASS.

- [ ] **Step 5: Implementar el route handler**

Crear `src/app/admin/api/territorio/[id]/barrer/route.ts`. Seguir el patrón de `src/app/admin/api/places/search/route.ts` (sesión primero, key solo en servidor, el body de Google nunca al browser). **Next 16: `params` es una Promise — hay que `await`.**

```ts
import { NextResponse } from "next/server";
import { getSesionAdmin } from "@/lib/admin/dal";
import {
  claveTesela,
  claveTrabajo,
  esSaturada,
  type Punto,
} from "@/lib/admin/barrido";
import {
  circuloDentroDelTerritorio,
  recortarAlArea,
  type ResumenTesela,
} from "@/lib/admin/barrido-servidor";
import { placeANegocio, soloConTelefono, type PlaceApi } from "@/lib/admin/places";
import type { Territorio } from "@/lib/admin/territorios";
import { tiposDeVertical } from "@/lib/admin/verticales-places";

// Mismo FieldMask que la búsqueda de texto: define el SKU que factura Google
// (Enterprise, US$35/1.000). addressComponents es Pro y viaja gratis.
// No añadir campos sin mirar el precio.
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.rating",
  "places.websiteUri",
  "places.types",
  "places.businessStatus",
].join(",");

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await getSesionAdmin();
  if (!sesion) return NextResponse.json({ error: "no_autorizado" }, { status: 401 });

  const { id } = await params;

  let payload: { centro?: Punto; radio?: number; vertical?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "peticion_invalida" }, { status: 400 });
  }

  const { centro, radio, vertical } = payload;
  const tipos = typeof vertical === "string" ? tiposDeVertical(vertical) : [];
  if (!centro || typeof radio !== "number" || tipos.length === 0) {
    return NextResponse.json({ error: "peticion_invalida" }, { status: 400 });
  }

  const { data: fila, error: errorTerritorio } = await sesion.supabase
    .from("territorios")
    .select("*")
    .eq("id", id)
    .single();

  if (errorTerritorio || !fila) {
    return NextResponse.json({ error: "territorio_no_encontrado" }, { status: 404 });
  }
  const territorio = fila as Territorio;

  if (!circuloDentroDelTerritorio(centro, radio, territorio)) {
    return NextResponse.json({ error: "circulo_fuera_del_territorio" }, { status: 400 });
  }

  let respuesta: Response;
  try {
    respuesta = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        includedTypes: tipos,
        maxResultCount: 20,
        languageCode: "es",
        regionCode: "CO",
        locationRestriction: {
          circle: { center: { latitude: centro.lat, longitude: centro.lng }, radius },
        },
      }),
    });
  } catch (error) {
    console.error("[barrido] fallo de red hacia Google:", error);
    return NextResponse.json({ error: "places_error" }, { status: 502 });
  }

  if (!respuesta.ok) {
    console.error(
      `[barrido] Google respondió ${respuesta.status}:`,
      await respuesta.text().catch(() => "(sin body)"),
    );
    const esCuota = respuesta.status === 429;
    return NextResponse.json(
      { error: esCuota ? "cuota" : "places_error" },
      { status: esCuota ? 503 : 502 },
    );
  }

  const data = (await respuesta.json()) as { places?: PlaceApi[] };
  const crudos = (data.places ?? []).map((p) => placeANegocio(p));
  const enElArea = recortarAlArea(crudos, territorio.poligono);
  const contactables = soloConTelefono(enElArea);

  let insertados = 0;
  if (contactables.length > 0) {
    // ignoreDuplicates: re-barrer NUNCA pisa el estado del pipeline ni las
    // notas de un lead ya trabajado.
    const { data: filas, error } = await sesion.supabase
      .from("negocios")
      .upsert(
        contactables.map((r) => ({
          nombre: r.nombre,
          direccion: r.direccion,
          ciudad: r.ciudad,
          lat: r.lat,
          lng: r.lng,
          categoria: r.categoria,
          rating: r.rating,
          sitio_web: r.sitioWeb,
          telefono: r.telefono,
          tipo_telefono: r.tipoTelefono,
          google_place_id: r.placeId,
          fuente: "places" as const,
          territorio_id: territorio.id,
        })),
        { onConflict: "google_place_id", ignoreDuplicates: true },
      )
      .select("id");

    if (error) {
      console.error("[barrido] error insertando negocios:", error.message);
      return NextResponse.json({ error: "db_error" }, { status: 502 });
    }
    insertados = filas?.length ?? 0;
  }

  // La tesela se anota SIEMPRE que Google respondió: lo que protege la plata es
  // no volver a pedirla, aunque no haya traído nada.
  const tesela = { centro, radio, clave: claveTesela(centro, radio) };
  const hechas = new Set(territorio.teselas_hechas ?? []);
  hechas.add(claveTrabajo(tesela, vertical));
  const verticales = new Set(territorio.verticales ?? []);
  verticales.add(vertical);

  const { error: errorUpdate } = await sesion.supabase
    .from("territorios")
    .update({
      llamadas: territorio.llamadas + 1,
      teselas_hechas: [...hechas],
      verticales: [...verticales],
      ultimo_barrido: new Date().toISOString(),
    })
    .eq("id", territorio.id);

  if (errorUpdate) {
    console.error("[barrido] error actualizando territorio:", errorUpdate.message);
  }

  const resumen: ResumenTesela = {
    encontrados: crudos.length,
    fueraDelArea: crudos.length - enElArea.length,
    sinTelefono: enElArea.length - contactables.length,
    insertados,
    saturada: esSaturada(crudos.length),
  };
  return NextResponse.json(resumen);
}
```

**Nota sobre el orden:** la tesela se anota en `teselas_hechas` *después* del insert y solo si Google respondió `ok`. Si el insert falla, el handler devuelve 502 antes de anotar, así que el barrido reintentará esa tesela — se paga dos veces esa llamada, pero no se pierde el negocio. Es el lado correcto del intercambio.

- [ ] **Step 6: Probar el handler a mano contra un territorio real**

Con el dev server arriba y sesión de admin iniciada, crear un territorio desde el SQL Editor y llamar:

```bash
curl -s -X POST "http://localhost:3000/admin/api/territorio/<ID>/barrer" \
  -H "Content-Type: application/json" \
  -b "<cookies de la sesión>" \
  -d '{"centro":{"lat":4.7326,"lng":-74.2642},"radio":400,"vertical":"ferreteria"}' | jq
```

Esperado: un `ResumenTesela` con números coherentes. Verificar en Supabase que `territorios.llamadas` subió a 1 y que `teselas_hechas` tiene una entrada.

Probar también el guardarraíl:

```bash
curl -s -X POST "http://localhost:3000/admin/api/territorio/<ID>/barrer" \
  -H "Content-Type: application/json" -b "<cookies>" \
  -d '{"centro":{"lat":4.711,"lng":-74.07},"radio":400,"vertical":"ferreteria"}' | jq
```

Esperado: `{"error":"circulo_fuera_del_territorio"}` con status 400.

- [ ] **Step 7: Commit**

```bash
git add src/lib/admin/barrido-servidor.ts src/lib/admin/__tests__/barrido-servidor.test.ts "src/app/admin/api/territorio"
git commit -m "prospección: handler de una tesela — Google, recorte, dedupe y contador"
```

---

### Task 9: Las dos caras (lógica pura de navegación)

Espejo exacto de `src/lib/admin/zak-caras.ts`, que ya trae este patrón resuelto con sus 9 tests. **Leerlo antes de escribir este archivo.**

**Files:**
- Create: `src/lib/admin/prospeccion-caras.ts`
- Test: `src/lib/admin/__tests__/prospeccion-caras.test.ts`
- Reference: `src/lib/admin/zak-caras.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `type CaraProspeccion = "territorio" | "leads"`
  - `caraDe(tab: string | null | undefined): CaraProspeccion`
  - `pestanaInicial(cara: CaraProspeccion): string`

- [ ] **Step 1: Leer el patrón**

```bash
cat src/lib/admin/zak-caras.ts
cat src/lib/admin/__tests__/zak-caras.test.ts
```

Copiar la forma: nombres, manejo de valores desconocidos, comentarios.

- [ ] **Step 2: Escribir el test que falla**

Crear `src/lib/admin/__tests__/prospeccion-caras.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { caraDe, pestanaInicial } from "../prospeccion-caras";

describe("caraDe", () => {
  it("sin tab, abre en Territorio: el mapa es la puerta", () => {
    expect(caraDe(null)).toBe("territorio");
    expect(caraDe(undefined)).toBe("territorio");
    expect(caraDe("")).toBe("territorio");
  });

  it("un tab de leads abre la cara de leads", () => {
    expect(caraDe("leads")).toBe("leads");
    expect(caraDe("leads-lista")).toBe("leads");
  });

  it("un tab de territorio abre la cara de territorio", () => {
    expect(caraDe("territorio")).toBe("territorio");
    expect(caraDe("territorio-mapa")).toBe("territorio");
  });

  it("un tab desconocido no rompe: cae a territorio", () => {
    expect(caraDe("cualquier-cosa")).toBe("territorio");
  });
});

describe("pestanaInicial", () => {
  it("cada cara tiene su pestaña de entrada", () => {
    expect(pestanaInicial("territorio")).toBe("territorio");
    expect(pestanaInicial("leads")).toBe("leads");
  });

  it("la pestaña inicial de una cara vuelve a esa misma cara", () => {
    for (const cara of ["territorio", "leads"] as const) {
      expect(caraDe(pestanaInicial(cara))).toBe(cara);
    }
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

```bash
npm test -- prospeccion-caras
```

Esperado: FAIL — el módulo no existe.

- [ ] **Step 4: Implementar**

Crear `src/lib/admin/prospeccion-caras.ts`:

```ts
// Las dos caras de "Encontrar clientes". Un SOLO parámetro en la URL (?tab=):
// dos parámetros pueden contradecirse entre sí, uno no. Mismo patrón que
// zak-caras.ts.

export type CaraProspeccion = "territorio" | "leads";

/** La cara a la que pertenece una pestaña. Desconocido cae a territorio: un
 * enlace viejo abre el mapa, nunca una pantalla en blanco. */
export function caraDe(tab: string | null | undefined): CaraProspeccion {
  return tab?.startsWith("leads") ? "leads" : "territorio";
}

export function pestanaInicial(cara: CaraProspeccion): string {
  return cara === "leads" ? "leads" : "territorio";
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

```bash
npm test -- prospeccion-caras
```

Esperado: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/admin/prospeccion-caras.ts src/lib/admin/__tests__/prospeccion-caras.test.ts
git commit -m "prospección: caras Territorio y Leads en un solo parámetro de URL"
```

---

### Task 10: `useBarrido` — el bucle del cliente

El bucle vive en el navegador: 310-600 llamadas no caben cómodas en un request de Vercel, y así hay progreso real y botón de pausar sin infraestructura nueva.

**Files:**
- Create: `src/components/admin/prospeccion/useBarrido.ts`
- Create: `src/lib/admin/plan-barrido.ts`
- Test: `src/lib/admin/__tests__/plan-barrido.test.ts`

**Interfaces:**
- Consumes: `teselar`, `subdividir`, `claveTrabajo`, `estimarBarrido`, `PROFUNDIDAD_MAX`, `Tesela` (Task 2); `ResumenTesela` (Task 8); `Territorio` (Task 7)
- Produces:
  - `type Trabajo = { tesela: Tesela; vertical: string; profundidad: number; clave: string }`
  - `planDeBarrido(territorio: Territorio, verticales: readonly string[]): Trabajo[]` — excluye lo ya hecho
  - `type ResumenBarrido = { encontrados: number; fueraDelArea: number; sinTelefono: number; insertados: number; saturadasAlFondo: number }`
  - `type EstadoBarrido = { total: number; hechos: number; corriendo: boolean; resumen: ResumenBarrido; error: string | null }`
  - `useBarrido(territorio: Territorio): { estado: EstadoBarrido; arrancar(verticales: string[]): void; pausar(): void }`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/admin/__tests__/plan-barrido.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { planDeBarrido } from "../plan-barrido";
import { claveTesela, claveTrabajo, teselar } from "../barrido";
import type { Territorio } from "../territorios";

const POLIGONO = [
  { lat: 4.72, lng: -74.28 },
  { lat: 4.72, lng: -74.26 },
  { lat: 4.74, lng: -74.26 },
  { lat: 4.74, lng: -74.28 },
];

function territorioCon(teselasHechas: string[]): Territorio {
  return {
    id: "t1",
    nombre: "Madrid centro",
    poligono: POLIGONO,
    bbox_sur: 4.72,
    bbox_norte: 4.74,
    bbox_oeste: -74.28,
    bbox_este: -74.26,
    verticales: [],
    teselas_hechas: teselasHechas,
    llamadas: 0,
    ultimo_barrido: null,
    creado_por: null,
    created_at: "2026-08-31T00:00:00Z",
    updated_at: "2026-08-31T00:00:00Z",
  };
}

describe("planDeBarrido", () => {
  it("un trabajo por tesela y vertical", () => {
    const teselas = teselar(POLIGONO).length;
    expect(planDeBarrido(territorioCon([]), ["ferreteria", "panaderia"])).toHaveLength(
      teselas * 2,
    );
  });

  it("salta lo ya barrido: reanudar no vuelve a pagarle a Google", () => {
    const teselas = teselar(POLIGONO);
    const yaHecha = claveTrabajo(teselas[0], "ferreteria");
    const plan = planDeBarrido(territorioCon([yaHecha]), ["ferreteria"]);
    expect(plan).toHaveLength(teselas.length - 1);
    expect(plan.some((t) => t.clave === yaHecha)).toBe(false);
  });

  it("una vertical ya barrida no bloquea otra vertical en la misma tesela", () => {
    const teselas = teselar(POLIGONO);
    const plan = planDeBarrido(
      territorioCon([claveTrabajo(teselas[0], "ferreteria")]),
      ["ferreteria", "panaderia"],
    );
    expect(plan.some((t) => t.clave === claveTrabajo(teselas[0], "panaderia"))).toBe(
      true,
    );
  });

  it("los trabajos del plan arrancan en profundidad 0", () => {
    expect(planDeBarrido(territorioCon([]), ["ferreteria"]).every((t) => t.profundidad === 0)).toBe(
      true,
    );
  });

  it("sin verticales no hay plan", () => {
    expect(planDeBarrido(territorioCon([]), [])).toEqual([]);
  });

  it("la clave del trabajo usa la clave estable de la tesela", () => {
    const plan = planDeBarrido(territorioCon([]), ["ferreteria"]);
    const t = plan[0];
    expect(t.clave).toBe(`${claveTesela(t.tesela.centro, t.tesela.radio)}#ferreteria`);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
npm test -- plan-barrido
```

Esperado: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar el plan (puro)**

Crear `src/lib/admin/plan-barrido.ts`:

```ts
import { claveTrabajo, teselar, type Tesela } from "./barrido";
import type { Territorio } from "./territorios";

export type Trabajo = {
  tesela: Tesela;
  vertical: string;
  profundidad: number;
  clave: string;
};

/** La cola de trabajo de un barrido: una tesela por vertical, saltando lo que
 * ya se barrió. Reanudar es gratis; volver a empezar cuesta plata. */
export function planDeBarrido(
  territorio: Territorio,
  verticales: readonly string[],
): Trabajo[] {
  const hechas = new Set(territorio.teselas_hechas ?? []);
  const teselas = teselar(territorio.poligono);
  const plan: Trabajo[] = [];
  for (const tesela of teselas) {
    for (const vertical of verticales) {
      const clave = claveTrabajo(tesela, vertical);
      if (hechas.has(clave)) continue;
      plan.push({ tesela, vertical, profundidad: 0, clave });
    }
  }
  return plan;
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

```bash
npm test -- plan-barrido
```

Esperado: PASS.

- [ ] **Step 5: Implementar el hook**

Crear `src/components/admin/prospeccion/useBarrido.ts`:

```tsx
"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { claveTrabajo, subdividir, PROFUNDIDAD_MAX } from "@/lib/admin/barrido";
import { planDeBarrido, type Trabajo } from "@/lib/admin/plan-barrido";
import type { ResumenTesela } from "@/lib/admin/barrido-servidor";
import type { Territorio } from "@/lib/admin/territorios";

/** Cuatro peticiones en vuelo: suficiente para que 310 teselas tarden ~20s sin
 * que Google nos vea como un abuso. */
const CONCURRENCIA = 4;

export type ResumenBarrido = {
  encontrados: number;
  fueraDelArea: number;
  sinTelefono: number;
  insertados: number;
  saturadasAlFondo: number;
};

export type EstadoBarrido = {
  total: number;
  hechos: number;
  corriendo: boolean;
  resumen: ResumenBarrido;
  error: string | null;
};

const RESUMEN_CERO: ResumenBarrido = {
  encontrados: 0,
  fueraDelArea: 0,
  sinTelefono: 0,
  insertados: 0,
  saturadasAlFondo: 0,
};

export function useBarrido(territorio: Territorio) {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoBarrido>({
    total: 0,
    hechos: 0,
    corriendo: false,
    resumen: RESUMEN_CERO,
    error: null,
  });

  // La cola vive en un ref, no en el estado: crece durante el barrido (cada
  // celda saturada mete 4 más) y no queremos re-renderizar por eso.
  const cola = useRef<Trabajo[]>([]);
  const aborto = useRef<AbortController | null>(null);

  const pausar = useCallback(() => {
    aborto.current?.abort();
    aborto.current = null;
    cola.current = [];
    setEstado((e) => ({ ...e, corriendo: false }));
    // Refresca para que el próximo plan lea teselas_hechas al día.
    router.refresh();
  }, [router]);

  const arrancar = useCallback(
    (verticales: string[]) => {
      const plan = planDeBarrido(territorio, verticales);
      if (plan.length === 0) return;

      cola.current = [...plan];
      const control = new AbortController();
      aborto.current = control;
      setEstado({
        total: plan.length,
        hechos: 0,
        corriendo: true,
        resumen: RESUMEN_CERO,
        error: null,
      });

      let vivos = CONCURRENCIA;

      async function procesar(t: Trabajo, reintento = false): Promise<void> {
        let res: Response;
        try {
          res = await fetch(`/admin/api/territorio/${territorio.id}/barrer`, {
            method: "POST",
            signal: control.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              centro: t.tesela.centro,
              radio: t.tesela.radio,
              vertical: t.vertical,
            }),
          });
        } catch {
          if (control.signal.aborted) return;
          // Un fallo de red se reintenta UNA vez; al segundo, esta tesela se
          // descarta y el barrido sigue. Una celda perdida no tumba un censo.
          if (!reintento) return procesar(t, true);
          setEstado((e) => ({ ...e, hechos: e.hechos + 1 }));
          return;
        }

        if (res.status === 503) {
          // Cuota de Google: PAUSA, no muerte. Lo barrido ya está en la base y
          // en teselas_hechas, así que reanudar no vuelve a pagarlo.
          setEstado((e) => ({
            ...e,
            error:
              "Google cortó por cuota. Lo barrido quedó guardado: reanuda en un rato.",
          }));
          control.abort();
          return;
        }

        if (!res.ok) {
          setEstado((e) => ({ ...e, hechos: e.hechos + 1 }));
          return;
        }

        const r = (await res.json()) as ResumenTesela;

        if (r.saturada && t.profundidad < PROFUNDIDAD_MAX) {
          // Volvieron 20 (el techo de Nearby Search): hay negocios que no
          // vimos. Se parte la celda y se reconsulta SOLO esta vertical.
          const hijas = subdividir(t.tesela).map((tesela) => ({
            tesela,
            vertical: t.vertical,
            profundidad: t.profundidad + 1,
            clave: claveTrabajo(tesela, t.vertical),
          }));
          cola.current.push(...hijas);
          setEstado((e) => ({ ...e, total: e.total + hijas.length }));
        }

        setEstado((e) => ({
          ...e,
          hechos: e.hechos + 1,
          resumen: {
            encontrados: e.resumen.encontrados + r.encontrados,
            fueraDelArea: e.resumen.fueraDelArea + r.fueraDelArea,
            sinTelefono: e.resumen.sinTelefono + r.sinTelefono,
            insertados: e.resumen.insertados + r.insertados,
            saturadasAlFondo:
              e.resumen.saturadasAlFondo +
              (r.saturada && t.profundidad >= PROFUNDIDAD_MAX ? 1 : 0),
          },
        }));
      }

      async function trabajar(): Promise<void> {
        while (!control.signal.aborted) {
          const t = cola.current.shift();
          if (!t) break;
          await procesar(t);
        }
        vivos--;
        if (vivos === 0) {
          aborto.current = null;
          setEstado((e) => ({ ...e, corriendo: false }));
          // Los negocios nuevos bajan por props del server, como en el
          // importar de MapaView. Una sola vez, al final.
          router.refresh();
        }
      }

      for (let i = 0; i < CONCURRENCIA; i++) void trabajar();
    },
    [territorio, router],
  );

  return { estado, arrancar, pausar };
}
```

- [ ] **Step 6: Verificar**

```bash
npm test
npx tsc --noEmit
npm run lint
```

Esperado: PASS y limpio.

- [ ] **Step 7: Commit**

```bash
git add src/lib/admin/plan-barrido.ts src/lib/admin/__tests__/plan-barrido.test.ts src/components/admin/prospeccion/useBarrido.ts
git commit -m "prospección: cola del barrido con concurrencia, subdivisión y reanudar"
```

---

### Task 11: La pantalla — caras, territorios y progreso

Aquí se parte `MapaView` (250 líneas) antes de que le entre dibujo, territorios, barrido y progreso.

**Files:**
- Create: `src/app/admin/(panel)/prospeccion/page.tsx`
- Create: `src/components/admin/prospeccion/ProspeccionView.tsx`
- Create: `src/components/admin/prospeccion/CarasProspeccion.tsx`
- Create: `src/components/admin/prospeccion/TerritorioView.tsx`
- Create: `src/components/admin/prospeccion/PanelTerritorios.tsx`
- Create: `src/components/admin/prospeccion/DibujarTerritorio.tsx`
- Create: `src/components/admin/prospeccion/BarridoProgreso.tsx`
- Reference: `src/components/admin/zak/CarasZak.tsx`, `src/components/admin/mapa/MapaView.tsx`

**Interfaces:**
- Consumes: `caraDe`, `pestanaInicial` (Task 9); `useBarrido`, `planDeBarrido` (Task 10); `estimarBarrido`, `teselar` (Task 2); `crearTerritorio`, `renombrarTerritorio`, `eliminarTerritorio` (Task 7); `Territorio`; `VERTICALES_PROSPECCION` de `zak.ts`
- Produces: la ruta `/admin/prospeccion`

- [ ] **Step 1: Leer los patrones antes de escribir**

```bash
cat src/components/admin/zak/CarasZak.tsx
cat src/components/admin/mapa/MapaView.tsx
grep -rn "Cockpit" src/components/admin --include=*.tsx | head -5
```

Las caras se dibujan como **tarjetas, no `<Tabs>`**: viven un nivel por encima de las pestañas y si se vieran iguales, los dos niveles se leen como uno.

- [ ] **Step 2: La page (server component)**

Crear `src/app/admin/(panel)/prospeccion/page.tsx`, siguiendo `src/app/admin/(panel)/mapa/page.tsx`:

```tsx
import { ProspeccionView } from "@/components/admin/prospeccion/ProspeccionView";
import { verifySession } from "@/lib/admin/dal";
import type { Negocio } from "@/lib/admin/negocios";
import type { Territorio } from "@/lib/admin/territorios";

export const metadata = { title: "Encontrar clientes" };

export default async function ProspeccionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  // Next 16: los layouts NO se re-renderizan — el check va en CADA page.
  const { supabase } = await verifySession();
  const { tab } = await searchParams;

  const [negocios, territorios] = await Promise.all([
    supabase.from("negocios").select("*").order("created_at", { ascending: false }),
    supabase.from("territorios").select("*").order("created_at", { ascending: false }),
  ]);

  if (negocios.error) console.error("[prospección] negocios:", negocios.error.message);
  if (territorios.error) console.error("[prospección] territorios:", territorios.error.message);

  return (
    <ProspeccionView
      tab={tab ?? null}
      negocios={(negocios.data as Negocio[]) ?? []}
      territorios={(territorios.data as Territorio[]) ?? []}
    />
  );
}
```

- [ ] **Step 3: `ProspeccionView` — el shell**

Shell puro: lee `caraDe(tab)`, dibuja `CarasProspeccion` arriba y monta `TerritorioView` o la cara de leads. **El `TerritorioView` se monta persistente con `hidden`, no se desmonta** al cambiar de cara: desmontarlo corta un barrido en vuelo. Es el mismo patrón que el Lab de voz.

Todo dentro del `Cockpit` para que no haya scroll de página.

- [ ] **Step 4: `CarasProspeccion`**

Dos tarjetas: **🗺 Territorio** y **📇 Leads**. Cada una muestra un subtítulo con el dato vivo — Territorio: `"N territorios · M leads"`; Leads: `"M leads · K sin web"`. Al hacer clic, `router.push` con `?tab=` = `pestanaInicial(cara)`.

- [ ] **Step 5: `DibujarTerritorio`**

El cableado del `DrawingManager`, que es donde está la trampa: el overlay que dibuja el usuario **se borra** al terminar, porque el polígono guardado lo redibuja `MapCanvas` desde la base. Dejar los dos vivos es tener dos dibujos del mismo territorio desincronizándose.

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { crearTerritorio } from "@/lib/admin/territorios-actions";
import type { Punto } from "@/lib/admin/barrido";

export function DibujarTerritorio({
  activo,
  onTerminar,
}: {
  activo: boolean;
  onTerminar: () => void;
}) {
  const map = useMap();
  const drawing = useMapsLibrary("drawing");
  const [puntos, setPuntos] = useState<Punto[] | null>(null);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, startGuardar] = useTransition();

  useEffect(() => {
    if (!map || !drawing || !activo) return;

    const manager = new drawing.DrawingManager({
      map,
      drawingMode: drawing.OverlayType.POLYGON,
      drawingControl: false,
      polygonOptions: {
        fillColor: "#ff5c1a",
        fillOpacity: 0.12,
        strokeColor: "#ff5c1a",
        strokeWeight: 2,
        clickable: false,
      },
    });

    const escucha = google.maps.event.addListener(
      manager,
      "polygoncomplete",
      (poligono: google.maps.Polygon) => {
        const trazo = poligono
          .getPath()
          .getArray()
          .map((p) => ({ lat: p.lat(), lng: p.lng() }));
        // Fuera el overlay: el territorio guardado lo redibuja MapCanvas desde
        // la base. Dos dibujos de lo mismo se desincronizan.
        poligono.setMap(null);
        manager.setDrawingMode(null);
        setPuntos(trazo);
      },
    );

    return () => {
      google.maps.event.removeListener(escucha);
      manager.setMap(null);
    };
  }, [map, drawing, activo]);

  if (!puntos) return null;

  return (
    <Modal titulo="Nombra el territorio" onCerrar={() => { setPuntos(null); onTerminar(); }}>
      <Field etiqueta="Nombre">
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
      </Field>
      {error && <Banner variante="error">{error}</Banner>}
      <Button
        variante="primaria"
        disabled={guardando}
        onClick={() =>
          startGuardar(async () => {
            const res = await crearTerritorio(nombre, puntos);
            if ("error" in res) {
              setError(res.error);
              return;
            }
            setPuntos(null);
            setNombre("");
            onTerminar();
          })
        }
      >
        {guardando ? "Guardando…" : "Guardar territorio"}
      </Button>
    </Modal>
  );
}
```

Ajustar los imports de `Modal`, `Field`, `Input`, `Banner` y `Button` a las firmas reales de `src/components/admin/ui/` — leerlas antes de escribir, no asumirlas.

**Verificar que los tipos de Google Maps estén disponibles:**

```bash
grep -n "@types/google.maps" package.json
```

Si no está, instalarlo (`npm i -D @types/google.maps`): `@vis.gl/react-google-maps` lo tiene como peer y sin él `google.maps.Polygon` no compila.

- [ ] **Step 6: `PanelTerritorios`**

Isla flotante a la izquierda (reusar la constante `ISLA_FLOTANTE` de `MapaView`). Por territorio: nombre, `N leads · M sin web`, `barrido hace X` (usar el helper de `src/lib/admin/formato.ts`), `llamadas` gastadas, y los botones **Barrer**, renombrar y eliminar. Eliminar pasa por `useConfirmar` (`src/components/admin/ui/Confirmar.tsx`) — el repo ya se quitó `window.confirm` por INP.

**Barrer** abre el diálogo de estimación: casillas de las 10 verticales (todas marcadas por defecto) y la cuenta viva de `estimarBarrido(teselar(poligono).length, verticalesMarcadas.length)`:

> **Madrid centro** — 31 teselas × 10 verticales = **310 llamadas ≈ US$10,85**.
> Puede subir hasta ~US$15,19 si hay zonas densas.
> Este territorio lleva **0** llamadas gastadas.

Formatear el costo con `Intl.NumberFormat("es-CO", { style: "currency", currency: "USD" })`.

- [ ] **Step 7: `BarridoProgreso`**

Barra con `hechos/total`, botón **Pausar**/**Reanudar** y, al terminar, el resumen honesto:

> 412 encontrados · 89 sin teléfono · 312 nuevos · 11 ya estaban

Si `saturadasAlFondo > 0`, un `Banner`: *"N zonas quedaron muy densas para el detalle máximo: puede faltar gente ahí."* Un censo incompleto que se declara incompleto es útil; uno que se declara completo es mentira.

- [ ] **Step 8: `TerritorioView`**

Lo que era `MapaView`, sin las pestañas de ciudad, con `PanelTerritorios` a la izquierda, `BarridoProgreso` cuando hay barrido corriendo, y la ficha a la derecha. El buscador de texto (`SearchPanel`) se conserva pero pasa a un panel colapsado: sigue siendo útil para consultas sueltas, ya no es el protagonista.

- [ ] **Step 9: Verificar en el navegador**

```bash
npm run dev
```

Recorrido manual en `/admin/prospeccion`:
1. Dibujar un polígono chico sobre Madrid y guardarlo con nombre. → aparece en el panel.
2. **Barrer** con UNA sola vertical (ferretería): la estimación debe mostrar pocas llamadas y poco costo. Confirmar.
3. Ver la barra avanzar y el resumen al final. Verificar en Supabase que `negocios` creció y `territorios.llamadas` cuadra con las teselas.
4. Recargar a mitad de un barrido y volver a barrer: el plan debe ser **más corto** que la primera vez.
5. Cambiar a la cara Leads y volver: el barrido en curso no se corta.

- [ ] **Step 10: Commit**

```bash
git add "src/app/admin/(panel)/prospeccion" src/components/admin/prospeccion/
git commit -m "prospección: pantalla Encontrar clientes con territorios y barrido"
```

---

### Task 12: El mapa — polígonos y el anillo de "sin web"

**Files:**
- Modify: `src/components/admin/mapa/MapCanvas.tsx`

**Interfaces:**
- Consumes: `Territorio` (Task 7); `Negocio` (Task 6)
- Produces: `MapCanvas` acepta `territorios: Territorio[]`, `territorioActivo: string | null` y dibuja el anillo de sin-web

- [ ] **Step 1: Dibujar los polígonos**

`@vis.gl/react-google-maps` no trae componente de polígono, así que se manejan como overlays imperativos dentro de un componente hijo del mapa (necesita `useMap()`):

```tsx
/** Los territorios como overlays. No hay <Polygon> en la librería: se crean y
 * se limpian a mano, y el cleanup NO es opcional — sin él cada render deja un
 * polígono huérfano encima del anterior. */
function PoligonosTerritorio({
  territorios,
  activo,
  onSeleccionar,
}: {
  territorios: Territorio[];
  activo: string | null;
  onSeleccionar: (id: string) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const overlays = territorios.map((t) => {
      const esActivo = t.id === activo;
      const poly = new google.maps.Polygon({
        map,
        paths: t.poligono,
        fillColor: "#ff5c1a",
        fillOpacity: esActivo ? 0.14 : 0.05,
        strokeColor: "#ff5c1a",
        strokeOpacity: esActivo ? 0.9 : 0.35,
        strokeWeight: esActivo ? 2 : 1,
        // Bajo los pines: el territorio es el escenario, no el actor.
        zIndex: 0,
      });
      poly.addListener("click", () => onSeleccionar(t.id));
      return poly;
    });
    return () => overlays.forEach((o) => o.setMap(null));
  }, [map, territorios, activo, onSeleccionar]);

  return null;
}
```

**`onSeleccionar` tiene que venir memoizado** (`useCallback` en el padre): está en las dependencias del efecto, y una función nueva en cada render redibuja todos los polígonos en cada tecla que se pulse.

- [ ] **Step 2: Tres señales en tres canales**

Hoy el color del rombo es el estado y el contorno naranja hueco significa "resultado sin importar". **Ese contorno sigue ocupado**: la búsqueda de texto se conserva. Así que "sin web" necesita canal propio:

- **Relleno** = estado del pipeline (`COLOR_PIN`, sin cambios).
- **Contorno naranja sin relleno** = resultado sin importar (sin cambios).
- **Anillo alrededor del rombo** = **sin sitio web**.

```tsx
// Anillo de "sin web": el lead que queremos. Va en un canal distinto al
// relleno (estado) y al contorno naranja (resultado sin importar), para que
// las tres señales se puedan leer a la vez.
const PIN_SIN_WEB = "ring-2 ring-offset-1 ring-acento ring-offset-transparent";
```

Aplicarlo con `cn(PIN_BASE, COLOR_PIN[n.estado], !n.sitio_web && PIN_SIN_WEB, activo && PIN_ACTIVO)`.

**Tailwind no ve plantillas:** la clase va literal, como ya hace `COLOR_PIN`.

- [ ] **Step 3: Verificar en el navegador**

Con un territorio barrido: los pines de negocios sin `sitio_web` llevan anillo, los que tienen web no, y el polígono se ve. Confirmar que un resultado de la búsqueda de texto (contorno naranja) sigue distinguiéndose de un negocio con anillo.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/mapa/MapCanvas.tsx
git commit -m "prospección: polígonos de territorio y anillo de sin-web en el mapa"
```

---

### Task 13: La cara Leads — filtros de web y territorio

**Files:**
- Modify: `src/components/admin/negocios/NegociosView.tsx`

**Interfaces:**
- Consumes: `ciudadesDe` (Task 6); `Territorio` (Task 7)
- Produces: `NegociosView` acepta `territorios: Territorio[]`; filtros `web` y `territorio`

- [ ] **Step 1: Añadir los filtros**

Junto al `FiltroTelefono` que ya existe:

```tsx
type FiltroWeb = "todos" | "sin" | "con";

// "Sin web" es la señal de lead: es a quien le vendemos marca y sitio.
const [web, setWeb] = useState<FiltroWeb>("todos");
const [territorio, setTerritorio] = useState<string | "todos">("todos");
```

En el `useMemo` de filtrado:

```tsx
if (web === "sin" && n.sitio_web) return false;
if (web === "con" && !n.sitio_web) return false;
if (territorio !== "todos" && n.territorio_id !== territorio) return false;
```

- [ ] **Step 2: Mostrar la web en la fila**

Añadir una columna al `GRID_FILA` con un enlace al sitio (`target="_blank" rel="noreferrer"`) o el texto `Sin web` marcado con el acento — es la señal que se está buscando, no un dato secundario. Ajustar el `grid-cols-[…]` para la columna nueva.

- [ ] **Step 3: Verificar en el navegador**

Filtrar por "solo sin web" y confirmar que el conteo cuadra con el que muestra `PanelTerritorios` para ese territorio. Si no cuadran, uno de los dos está contando mal — arreglarlo antes de seguir.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/negocios/NegociosView.tsx
git commit -m "prospección: filtros de sitio web y territorio en la lista de leads"
```

---

### Task 14: Sidebar, rutas y redirects

**Files:**
- Modify: `src/components/admin/Sidebar.tsx`
- Modify: `src/app/admin/(panel)/mapa/page.tsx`
- Modify: `src/app/admin/(panel)/negocios/page.tsx`
- Delete: `src/components/admin/mapa/MapaView.tsx`

**Interfaces:**
- Consumes: `pestanaInicial` (Task 9)
- Produces: una entrada de sidebar "Encontrar clientes"; `/admin/mapa` y `/admin/negocios` redirigen

- [ ] **Step 1: Una entrada en vez de dos**

En `src/components/admin/Sidebar.tsx`, reemplazar las dos primeras entradas de `SECCIONES`:

```tsx
// Antes:
//   { href: "/admin/mapa", label: "Mapa", Icono: Map },
//   { href: "/admin/negocios", label: "Negocios", Icono: Store },
// Después — una sola puerta: dos puertas a lo mismo se desincronizan.
{ href: "/admin/prospeccion", label: "Encontrar clientes", Icono: Target },
```

Importar `Target` de `lucide-react` y quitar los imports de `Map` y `Store` si quedan sin uso. Revisar también el `<Link href="/admin/mapa">` de `Sidebar.tsx:100`.

- [ ] **Step 2: Redirigir las rutas viejas**

Reemplazar el contenido de `src/app/admin/(panel)/mapa/page.tsx`:

```tsx
import { redirect } from "next/navigation";

// Dos puertas a la misma ficha se desincronizan (lección de la PR #12 con
// /admin/voz/<id-de-Zak>). Los enlaces viejos siguen funcionando.
export default function MapaPage() {
  redirect("/admin/prospeccion?tab=territorio");
}
```

Y `src/app/admin/(panel)/negocios/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function NegociosPage() {
  redirect("/admin/prospeccion?tab=leads");
}
```

- [ ] **Step 3: Borrar el `MapaView` viejo**

```bash
git rm src/components/admin/mapa/MapaView.tsx
grep -rn "MapaView" src/ | head
```

Esperado: sin resultados. Si `Seleccion` (el tipo que exportaba `MapaView`) sigue usándose en `MapCanvas`/`FichaNegocio`, moverlo a `src/components/admin/prospeccion/TerritorioView.tsx` y actualizar los imports.

- [ ] **Step 4: Verificación completa**

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Esperado: todo verde. En el navegador: `/admin/mapa` y `/admin/negocios` redirigen bien, el sidebar muestra una sola entrada y el barrido sigue funcionando.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/Sidebar.tsx "src/app/admin/(panel)/mapa/page.tsx" "src/app/admin/(panel)/negocios/page.tsx" src/components/admin/mapa/MapaView.tsx
git commit -m "prospección: una sola entrada 'Encontrar clientes' y redirects de las rutas viejas"
```

---

## Antes de mergear

- [ ] `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` — los cuatro verdes.
- [ ] **`supabase/prospeccion.sql` corrido en producción ANTES del deploy.** La migración quita el enum `ciudad`; si el código sube primero, la lista de leads se cae.
- [ ] Un barrido real de un territorio chico en producción, comparando `territorios.llamadas` contra la estimación que mostró el diálogo. Si el gasto real se dispara sobre lo estimado, el `FACTOR_DENSIDAD` está mal calibrado.
- [ ] Revisar en la consola de Google Cloud que el consumo del mes cuadre con lo esperado.
