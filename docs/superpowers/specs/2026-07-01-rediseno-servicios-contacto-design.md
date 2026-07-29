# Rediseño — páginas de servicio + contacto

Fecha: 2026-07-01 · Estado: aprobado, en implementación

## Objetivo
Elevar `/agentes-ia`, `/software`, `/marca` y `/contacto` al nivel "pro" de la home,
orientadas a **cerrar ventas**. Respetar tokens y patrones existentes
(negro/paper/naranja, Inter + Playfair, hairlines, GSAP).

## Decisiones (confirmadas con el cliente)
- **Datos = claims de capacidad** (24/7, respuesta en segundos, 0 plantillas, código propio…). Nada inventado.
- **Sin testimonios falsos** → señales de confianza reales (por qué Zakumi + garantías).
- **Imágenes**: las de `public/work` + visuales de apoyo (mockups, chips con `simple-icons`, ilustraciones CSS).

## Enfoque
Template compartido enriquecido y data-driven (`ServicePage.tsx` + `services.ts`) + **una sección
"estrella" por servicio**: chat (agentes) · mockup de producto (software) · sistema de marca (marca).

## Arquitectura de cada página de servicio
1. Hero que ficha — título + lead + 3 datos rápidos (`heroMeta`) + doble CTA + imagen del servicio.
2. Datos clave — banda de stats de capacidad con contador (reusa `.stat`).
3. Qué hacemos — capacidades (`incluye`, filas editoriales).
4. Sección estrella — por `signature.kind`: `chat` | `producto` | `marca`.
5. Casos de uso — `ejemplos` con imagen.
6. Cómo trabajamos — `proceso` (secuencia real, numerada).
7. Tecnologías — chips con logos reales (`simple-icons`).
8. Por qué Zakumi + garantías — reemplaza testimonios.
9. Planes — 3 cards, la del medio destacada.
10. FAQ — objeciones (`<details>` accesible).
11. Cierre — doble CTA.

## Contacto (`/contacto`)
Hero vendedor + promesa de respuesta · vías de contacto en cards · "qué pasa después de escribir"
(3 pasos) · por qué Zakumi · formulario (2 columnas con imagen/razones + info clara).
El footer global de `SiteShell` se mantiene intacto.

## Modelo de datos (`services.ts`)
`Service` gana: `heroMeta`, `stats`, `signature`, `proceso`, `tech`, `porQue`, `faq`.
Se elimina `testimonios`. Se conservan `incluye`, `ejemplos`, `planes`, `seo`.
Regla dura: ningún copy contiene la palabra "stack" (test lo verifica).

## Verificación
`npm run build` + `npm run lint` + `npm test` en verde; screenshots de las 4 páginas
(móvil + desktop) y validación visual de Agentes IA antes de replicar.
