# Spec — Panel de admin Zakumi: Shell + Mapa + CRM (primer corte)

**Fecha:** 2026-08-11 · **Estado:** aprobado por Tomás · **Rama:** `feat/admin-panel`

## Visión

Un **centro de control** en `zakumistudio.com/admin` para vender los servicios digitales de
Zakumi (páginas web, CRM, agentes de IA) a negocios locales. La visión completa tiene seis
módulos; este spec cubre el primer corte. Cada módulo posterior tendrá su propio spec.

| Módulo | Alcance |
|---|---|
| **A. Shell + auth** | **este spec** |
| **B. Mapa + prospección** (Madrid Cund., Ubaté, Bogotá) | **este spec** |
| **C. CRM / pipeline** | **este spec** |
| D. Consola del bot de WhatsApp (3 SIMs, system prompt, conversaciones) | spec futura |
| E. Campañas de salida (el bot escribe a los negocios marcados) | spec futura |
| F. Clientes & cobros (productos vendidos, tarifas, próxima fecha de cobro) | **siguiente spec** |

## Decisiones de producto (cerradas con Tomás)

- **Fuente de negocios:** Google Places (Text Search, New) + captura manual en el mapa.
  Places obliga por TOS a mostrar sus datos sobre mapa de Google → Google Maps JS.
- **Base de datos:** Supabase (Postgres + Auth). Tomás crea el proyecto y pasa las env vars.
- **Usuarios:** Tomás + 1-2 personas. Email + contraseña con Supabase Auth; **registro
  público desactivado** — las cuentas se crean desde el dashboard de Supabase.
- **Ubicación:** mismo repo y proyecto Vercel que la landing; ruta `/admin` con layout
  propio (cero GSAP/CSS de la landing), `noindex` y bloqueada en `robots.txt`.
- **Pipeline:** `nuevo → contactado → respondido → interesado → cliente | descartado`.
  El cambio de estado deja **nota automática**.
- **Teléfonos:** normalizados a `+57…` (E.164). Nacional que empieza por `60` → **fijo**
  (sin WhatsApp); por `3` → móvil. Botón "Abrir WhatsApp" (`wa.me`) solo en móviles.
- **Dedupe:** `google_place_id UNIQUE` — imposible importar dos veces el mismo negocio.
- **Control fino para las campañas futuras:** la selección múltiple + cambio de estado en
  lote de `/admin/negocios` es el mecanismo con el que Tomás decide exactamente a qué
  negocios escribirá el bot (módulo E). Nunca habrá envío ciego a toda la base.

## Pantallas

### `/admin/login`
Email + contraseña. Sin registro, sin recuperación en este corte (se gestiona en Supabase).

### `/admin/mapa` — principal
- Mapa oscuro centrado en la sabana; **chips** Madrid · Ubaté · Bogotá recentran.
- **Búsqueda Places**: "restaurantes en Madrid Cundinamarca" → lista lateral con nombre,
  teléfono (o "sin teléfono"), rating. Botón **Importar** por resultado + **"Importar
  todos los que tengan teléfono"**. Los ya importados se marcan "Ya está".
- **Pins por estado** (color) del mismo array que alimenta la lista.
- **Ficha lateral** al hacer clic: datos, dropdown de estado, notas con historial,
  teléfono editable, wa.me si es móvil.
- **Captura manual**: botón activa el modo, clic en el mapa fija lat/lng → formulario.

### `/admin/negocios` — mesa de control
- Tabla con filtros: ciudad, estado, categoría, con/sin teléfono; búsqueda por nombre.
- Selección múltiple → **cambio de estado en lote**.

## Arquitectura técnica

- Next.js 16 (App Router). La landing se mueve a un route group `src/app/(site)/` para
  que `SiteShell` (nav/footer/cursor/GSAP) no llegue a `/admin`. URLs públicas idénticas.
- **Auth:** `@supabase/ssr`. Check optimista en `src/proxy.ts` (matcher `/admin/:path*`,
  único punto que persiste tokens refrescados) + `verifySession()` con React `cache()` en
  **cada** page, server action y route handler (en Next 16 los layouts no se re-renderizan
  al navegar — jamás confiar solo en el layout). Nunca se usa la service-role key; RLS es
  la barrera final.
- **Places:** route handler `POST /admin/api/places/search` server-side (la key de Places
  jamás llega al browser; sesión obligatoria para no ser proxy abierto). FieldMask mínimo,
  `regionCode: "CO"`, `locationBias` por ciudad, `pageSize: 20` sin paginación.
- **Mapa:** `@vis.gl/react-google-maps` (`<AdvancedMarker>` con DOM propio → pins con
  clases CSS; requiere Map ID).
- **Datos:** tablas `negocios` y `notas` en `supabase/schema.sql` (idempotente), RLS
  `to authenticated`, triggers `updated_at` y nota automática de cambio de estado.
- **CSS:** `src/styles/admin.css`, todo con prefijo `adm-`. El markup admin no usa
  `<nav>`/`<footer>` desnudos ni `.cta` (los estila la landing vía globals).
- **Tests:** vitest (node): normalización de teléfonos, mapper de Places, inferencia de
  ciudad, invariantes de constantes y regla editorial es-CO (sin "stack").

## Variables de entorno

`NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` ·
`GOOGLE_PLACES_API_KEY` (solo server) · `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` ·
`NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`. Detalle de setup externo en el plan de implementación.

## Riesgos aceptados

- **Costo Places:** el FieldMask con teléfono factura el SKU alto (~US$35-40/1000
  búsquedas; free tier ~1.000/mes). Suficiente para prospección interna; alerta de
  presupuesto en Google Cloud.
- **TOS Places:** teléfono/dirección tienen restricciones de retención ("temporary
  caching"); `place_id` sí se puede almacenar indefinidamente. CRM interno de bajo
  volumen — riesgo consciente; revisar antes de escalar.
- **Outreach en frío (módulo E, futuro):** con Green API es la vía rápida al baneo del
  número; con Cloud API de Meta exige plantilla de marketing aprobada y límites diarios.
  Se diseñará en su propio spec.

## Fuera de alcance de este corte

Consola del bot (D), campañas (E), clientes & cobros (F), export CSV, roles/permisos,
recuperación de contraseña, paginación de Places.
