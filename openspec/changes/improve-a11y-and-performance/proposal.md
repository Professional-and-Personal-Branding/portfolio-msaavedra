# improve-a11y-and-performance — Accesibilidad AA y arranque público más liviano

> Cierra dos ítems abiertos de `docs/RELEASE-1.0.0-CHECKLIST.md` (*Accesibilidad (a11y)* y *Caché / performance*), que `docs/SPECS-POR-FASE.md` § Fase 6 y `docs/ARCHITECTURE.md` listan como deseables de 1.0.x. No abre una fase nueva. La evidencia está en `audit/` (`audit/README.md` resume números y entorno).

## Why

La auditoría del 15 de octubre de 2026 sobre `main` (`fdad7a1`), con el build de producción servido por el Caddy de `frontend/Dockerfile`, dio:

1. **Accesibilidad 88 en todas las páginas públicas** (Lighthouse) y **ninguna vista de perfil sin violaciones serias** (axe): 1376 nodos de `color-contrast` y 330 de `definition-list`/`dlitem` en las 30 vistas de perfil medidas; en el panel, 22 nodos **críticos** de `aria-valid-attr-value` (`LocalizedField`) y 420 de contraste.
2. **El contraste lo rompen tokens derivados, no los presets**: `text-dim` (falla en los cinco presets), el acento usado como texto (12 de 14 perfiles tienen un acento oscuro sobre `modern-dark`: hasta 1,15:1; también `modern-light`) y el texto sobre el acento elegido por brillo YIQ y no por contraste.
3. **El foco no siempre se ve**: el anillo es el acento al 50 % (1,12–3,03:1 contra el fondo) y no hay enlace para saltar al contenido, ni en la vista pública ni en el panel.
4. **Performance mobile en el borde**: medianas de 91, 92 y 94 en las tres páginas públicas, con corridas de 87 y 89. El arranque público baja 228 KB gzip de JS; `zod` es el 29 % del chunk de entrada (solo para validar tokens) y `motion` se precarga en todas las páginas para animar secciones. El LCP (el resumen del hero) espera además el fundido de entrada del hero.
5. **El backend no es el cuello**: HTML en ≈ 22 ms y API en ≈ 20 ms. El cache de lectura (`cache-de-lectura-y-visitas`, diferido en `docs/ROADMAP-1.1.md` § 5) no movería ningún número.

## What Changes

- **Contraste por construcción (D1–D3):** el motor de theming deriva del tema tres valores legibles: el acento como texto (`--t-accent-ink`, mismo tono, luminosidad ajustada hasta 4,5:1 contra `bg`, `bgSoft` y `card`), el texto atenuado (`--t-text-dim`, ≥ 4,5:1) y el texto sobre el acento (blanco u oscuro, el de **mayor contraste**). Los presets y los `themeOverrides` guardados no cambian (P1 = a).
- **Foco visible (D4):** un indicador sólido de 2 px con separación, del color `--t-ring` (≥ 3:1 contra el fondo), para todo control enfocado con teclado, en la vista pública y en el panel.
- **Saltar al contenido y landmarks (D5):** enlace *Saltar al contenido* como primer foco de la vista pública y del panel, hacia el `<main>` que ya tienen; `/admin/login`, que no lo tiene, pasa a estar dentro de uno.
- **Estructura válida (D6):** el `<dl>` de `Contact` pasa a grupos `div > dt + dd`; `LocalizedField` conserva las pestañas ES/EN pero con paneles reales, así `aria-controls` apunta a algo que existe.
- **Movimiento (D7):** `scroll-behavior: smooth` solo con `prefers-reduced-motion: no-preference`; el hero se pinta visible desde el primer frame, sin fundido de entrada; el resto de las secciones sigue animando (P2 = a).
- **Arranque más liviano (D8, D9):** `themes/tokens.ts` valida con `zod/mini` (sigue siendo Zod); las animaciones de sección cargan sus features de `motion` en diferido (`LazyMotion`), fuera del camino crítico; `index.html` pide temprano la hoja de Inter. Presupuesto de JS del arranque público verificable con `npm run perf:budget`.
- **Auditoría reproducible (D10, D11):** `npm run a11y:check` (axe + recorrido de teclado) y `npm run perf:check` (Lighthouse con versión fija, mediana de N corridas) en `frontend/scripts/`, que **se niegan a correr** sin `A11Y_CHECK_DISPOSABLE_DB=1`, como `print:check`, porque cada carga registra una visita.
- **En CI, bloqueantes (D13–D15, P5):** `perf:budget` en el job `frontend`; `a11y:check` y `perf:check` en un job nuevo `web-quality` (matriz de dos, en paralelo) contra la imagen de `frontend/Dockerfile` y la API sobre un Postgres de servicio sembrado, con Chrome fijado. Lighthouse en CI usa mediana de 5 y Performance ≥ 85; el resto, ≥ 90. Si algo falla, se suben los reportes como artefacto. Suma ≈ 6–7 min de pared al CI.
- **Evidencia (D16, P3):** de `audit/` se versionan los resúmenes, los JSON de axe y los ocho HTML de Lighthouse (≈ 9,3 MB); el resto queda fuera con un `.gitignore` local.
- **Docs:** `docs/RELEASE-1.0.0-CHECKLIST.md` (cierra los dos ítems; *lazy-loading de imágenes* no aplica: la vista pública no tiene `<img>`), `docs/MANUAL.md` (TC-33 y TC-34), `docs/CHANGELOG.md` y `CLAUDE.md` (roadmap).

## Non-goals

- **Cache de lectura del backend** (`cache-de-lectura-y-visitas`): sigue diferido; la medición no lo justifica (D12).
- Cambiar los colores de los presets o los acentos que el owner eligió para cada perfil.
- Quitar Framer Motion, React Router o TanStack Query del stack, o reescribir el render del lado del servidor (SSR) para adelantar los datos del perfil (D8, alternativas descartadas).
- Cambiar la CSP: el `inspector-issues` de Lighthouse es un artefacto de axe (D11).
- Filtrar de la analítica las visitas de herramientas automáticas (Lighthouse, PageSpeed Insights, `HeadlessChrome`): va en un change aparte después del deploy (P4).
- WCAG AAA (contraste 7:1, foco 2.4.13) y auditorías con lectores de pantalla reales.
- La hoja imprimible: ya fija su paleta de papel con contraste ≥ 4,5:1 (`printable-curated-profile`).

## Capabilities

### New Capabilities

- `web-accessibility`: contraste legible derivado de los tokens, foco visible, salto al contenido y landmarks, estructura semántica válida, movimiento reducido y la auditoría automatizada que lo sostiene.
- `web-performance`: presupuesto de JS del arranque público, contenido principal sin esperar animaciones, carga temprana de la tipografía por defecto, umbral de Lighthouse verificable y los checks de calidad web bloqueantes en CI.

### Modified Capabilities

Ninguna. `runtime-theming` no cambia de contrato: los tokens y presets siguen iguales y el botón primario sigue pintándose con el acento; los valores nuevos son derivados y los fija `web-accessibility`.

## Impact

- **Frontend (sin backend):**
  - Theming: `themes/css-vars.ts` (derivados y `readableOn` por contraste) con su spec, `themes/theme.css` (`--color-brand-ink`, `--color-text-dim`, `--color-ring`, foco global, `scroll-behavior`), `themes/tokens.ts` (`zod/mini`), `themes/motion-section.tsx` y `themes/theme-provider.tsx` (`LazyMotion`).
  - Vista pública: `features/curated-view/CuratedProfileView.tsx` (salto y `main`), `shared/components/portfolio/*` (`text-brand` → `text-brand-ink` donde es texto; `Contact.tsx`; `Hero.tsx`), `features/navigation/*`, `shared/i18n/messages.ts`.
  - Panel: `features/backoffice/shared/AdminShell.tsx` (salto y `main`), `features/backoffice/auth/LoginPage.tsx`, `features/backoffice/shared/fields/LocalizedField.tsx` y sus tests; `shared/components/ui/*` solo para el foco.
  - Build: `index.html` (preload de Inter), `vite.config.ts` si hace falta para el chunk de `motion`, `package.json` (scripts y `axe-core` como devDependency) y `frontend/scripts/` (`check-bundle-budget.mjs`, `check-a11y.mjs`, `check-lighthouse.mjs`).
- **CI:** `.github/workflows/ci.yml` (paso `perf:budget` en `frontend` y job `web-quality`).
- **Contrato OpenAPI, base de datos y Caddy:** sin cambios.
- **Cambios visibles:** el acento como texto se aclara u oscurece donde no llegaba a 4,5:1; el texto atenuado gana contraste; el botón de `modern-light` pasa a texto oscuro; el foco se ve; el hero ya no hace fundido de entrada.
- **Operación:** ninguna en producción. El CI tarda ≈ 6–7 min más; marcar los checks nuevos como requeridos en la protección de `main` lo hace el owner (P6).
