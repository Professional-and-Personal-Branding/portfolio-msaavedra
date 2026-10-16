# improve-mobile-performance — Performance mobile ≥ 85 en el runner de GitHub

> Continúa `improve-a11y-and-performance` (PR #30): su D17 fijó Performance ≥ 70 en CI como freno de regresiones y dejó «llevar mobile a ≥ 85 de verdad» para un change aparte. Es un deseable de 1.0.x de `docs/SPECS-POR-FASE.md` § Fase 6 (hardening), sin fase nueva. **Se archiva después de `improve-a11y-and-performance`** (D11). La evidencia está en `audit/README.md`.

## Why

1. **El CI mide un móvil de gama media y hoy da 71 / 76 / 75.** El runner de GitHub tiene `benchmarkIndex` ≈ 1.800, el equipo de referencia de Lighthouse; la máquina local (≈ 4.200) inflaba el 93–95. El owner quiere ≥ 85 medido ahí, sin recalibrar `cpuSlowdownMultiplier`.
2. **El LCP (≈ 3,8 s) espera a dos orígenes externos y a todo el bundle:** la hoja y el woff2 de Inter salen de Google Fonts, y la petición del perfil recién sale cuando terminó de cargarse y evaluarse el JS.
3. **El TBT (300–400 ms) es un solo render síncrono:** el perfil completo se renderiza de golpe al llegar los datos (TanStack Query notifica de forma síncrona), le sigue un *Layout* de ≈ 1.700 objetos y, al llegar `motion`, el `Suspense` de `MotionSection` remonta todas las secciones.
4. **Tres JS críticos por HTTP/1.1** (`index`, `react`, `query`, 179 KB gzip), cada uno con su petición en la simulación de Lantern, más Radix y Floating UI de dos menús que nadie abrió todavía.
5. **Un prototipo medido llegó a 95–98 en el proxy rápido y bajó el LCP del proxy lento a 2,2–2,5 s** (`audit/README.md`); falta la versión limpia, con tests, y el veredicto del runner.

## What Changes

- **Render en dos tiempos (D1, D2):** el hero se pinta primero y el resto de las secciones llega en una transición, con un relleno de alto de pantalla para que el pie no se mueva; una vez revelado, cambiar de idioma, tema, layout o perfil no vuelve a «solo hero». Los datos llegan por `useDeferredValue`, el montaje inicial va dentro de `startTransition` y las secciones animadas usan `content-visibility: auto`.
- **Menús en diferido (D3):** el selector de tema y el menú de perfiles cargan después de revelar el perfil, o antes si el visitante apunta, toca o enfoca el disparador; el disparador provisional es idéntico, conserva el foco al intercambiarse y, si se activó antes de tiempo, el menú abre al llegar. `TooltipProvider` pasa al panel.
- **Un solo JS de arranque (D4):** `codeSplitting.groups` con `$initial` de Rolldown en vez de `manualChunks`.
- **Petición temprana del perfil (D5):** un script mínimo del HTML (`/profile-prefetch.js`, sin módulos compartidos con el bundle) pide el perfil al parsearse la página y se lo entrega a `openapi-fetch`: **una sola petición y una sola visita**, con el mismo slug, idioma y token que resolvería la app; `/admin/*` queda afuera.
- **Inter desde el propio origen (D6):** woff2 latin (OFL, con su licencia) con `preload` y caché inmutable en `/fonts/*`; Google Fonts solo para las demás familias; sin `preconnect`.
- **Animación de entrada imperativa (D7):** la API *vanilla* de Motion (`motion/mini` + `inView`) anima la misma `<section>`, sin remontar; respeta `effects.animations` y `prefers-reduced-motion`, y la impresión sigue viendo todo.
- **Grilla `sidebar` en móvil (D8):** `grid-cols-1`, que elimina el CLS de 0,416 que destapó el hero primero.
- **Presupuesto (D9):** `perf:budget` ≤ 155 KB gzip contando todos los scripts del HTML, un solo JS de módulo, ningún `modulepreload` y, además de las marcas prohibidas de hoy, el *popper* de Radix.
- **CI (D10):** `PERF_CHECK_MIN_PERFORMANCE` de 70 a **85**, mediana de 5.
- **Docs:** `docs/MANUAL.md` (umbrales y TC-35), `docs/DEPLOY.md` (caché de `/fonts/*`), `docs/CHANGELOG.md`, `CLAUDE.md` (roadmap) y el comentario de `ci.yml`.

## Non-goals

- Recalibrar `cpuSlowdownMultiplier` o cambiar el perfil de *throttling* de Lighthouse (descartado por el owner, D17 del change anterior).
- Render del lado del servidor (SSR) o inyectar el JSON del perfil en el HTML.
- Cache de lectura del backend (`cache-de-lectura-y-visitas`, diferido; la API responde en ≈ 20 ms).
- Cambiar la CSP: sin scripts inline ni orígenes nuevos.
- Quitar Motion, Radix, React Router o TanStack Query del stack.
- Servir desde el propio origen las familias que no son Inter.
- Filtrar de la analítica las visitas de Lighthouse (P4 del change anterior, fuera de alcance).
- Cambiar el default local de `perf:check` (90) o los umbrales de Accessibility, Best Practices y SEO.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `web-performance` (creada por `improve-a11y-and-performance`): `MODIFIED` *Presupuesto de JS del arranque público* (155 KB, un JS de módulo, todos los scripts del HTML, *popper* de Radix) y *Los checks de calidad web bloquean en CI* (Performance ≥ 85); `REMOVED` *Tipografía por defecto pedida desde el HTML* (la hoja de Google para Inter deja de existir), reemplazado por `ADDED` *Tipografía por defecto desde el propio origen*; `ADDED` *Render del perfil en dos tiempos*, *Render del perfil interrumpible*, *Menús de la barra en diferido*, *Petición temprana del perfil* y *Animación de entrada sin remontar*.
- `layout-engine`: `ADDED` *Columna única del layout sidebar en móvil*. Los requisitos vigentes no cambian.

`runtime-theming` (animaciones apagadas con `effects.animations = false` o `prefers-reduced-motion`), `site-security-policy` (CSP), `printable-curated-profile` (*Las animaciones no ocultan contenido*) y `frontend-localization` no cambian de contrato: este change los cumple tal como están.

## Impact

- **Frontend (sin backend):**
  - Arranque: `src/main.tsx` (`startTransition`), `src/app/providers.tsx` (sin `TooltipProvider`), `features/backoffice/BackofficeApp.tsx` (con `TooltipProvider`), `vite.config.ts` (`codeSplitting`), `index.html` (script temprano, `preload` de Inter, sin `preconnect`).
  - Datos: `features/curated-view/hooks/use-curated-profile.ts` y un módulo de entrega de la petición temprana; `public/profile-prefetch.js`.
  - Vista: `features/curated-view/CuratedProfileView.tsx` (revelado en dos tiempos), `features/navigation/TopBar.tsx` y un componente de menú diferido, `shared/lib/lazy-with-preload.tsx` (con props).
  - Theming: `themes/motion-section.tsx`, `themes/entrance-animation.ts` (nuevo), `themes/animated-section.tsx` (se elimina), `themes/theme.css` (`@font-face`, estado inicial de la animación), `themes/fonts.ts`, `themes/layouts/SidebarLayout.tsx`.
  - Activos: `public/fonts/inter-latin-v20.woff2` y `public/fonts/OFL.txt`.
  - Scripts: `scripts/check-bundle-budget.mjs`.
- **Borde:** `frontend/Caddyfile` (`Cache-Control` inmutable para `/fonts/*`). CSP sin cambios.
- **CI:** `.github/workflows/ci.yml` (`PERF_CHECK_MIN_PERFORMANCE: '85'`).
- **Contrato OpenAPI y base de datos:** sin cambios.
- **Cambios visibles:** el hero aparece antes y el resto de las secciones un instante después; la tipografía Inter llega del propio sitio; nada más cambia de aspecto.
- **Dependencias:** ninguna nueva.
