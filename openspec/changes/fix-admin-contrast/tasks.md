# Tasks — fix-admin-contrast

> Referencias: `proposal.md`, `design.md` (D1–D5, P1–P3), `specs/web-accessibility/spec.md`, la auditoría de partida en `audit/`. La evidencia nueva va en `verification/`, como en los changes archivados.
>
> **Orden:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Los grupos 2 a 4 van en el mismo commit (código y tests). El 5 puede ir en un commit propio del mismo PR.
>
> **Bases:** ninguna tarea usa la base `portfolio` del owner (`portfolio-postgres`, `localhost:5434`): `a11y:check` registra una visita por carga. Las corridas locales usan dos bases **descartables** en el mismo contenedor, creadas en el grupo 6 y borradas al terminarlo: `portfolio_contrast_example` (sembrada con `SEED_DISPOSABLE_DB=1 npm run seed:example`) y `portfolio_contrast_cv` (con `npm run seed` sobre la base vacía). Antes de sembrar, `npm run prisma:status` tiene que nombrar la base descartable. El administrador de prueba se crea con `npm run admin:bootstrap` y una contraseña aleatoria en una variable de la terminal; el login de `a11y:check` es por `fetch` y la contraseña no se escribe en ningún navegador ni archivo.

## 1. Punto de partida

- [x] 1.1 Confirmar que la rama sale de `main` con `improve-a11y-and-performance` y `add-learning-guide-and-example-data` archivados: existen `frontend/src/themes/contrast.ts` (`accentInk`, `textDim`), `frontend/scripts/check-a11y.mjs` con `A11Y_CHECK_PROFILE` y `docs/examples/cv-data.example.json` con al menos un ítem `visible: false` en experiencias, formación, proyectos y enlaces y una experiencia `current: true` que entra en `ejemplo-backend`. Verificar: `npm test` y `npm run perf:budget` (tras `npm run build`) verdes en `frontend/` antes de tocar nada; anotar el tamaño gzip del arranque público en `verification/1.1-punto-de-partida.txt`.

## 2. Ítems ocultos sin opacidad (D1)

- [x] 2.1 Definir el estilo único de la fila oculta: una utilidad en `frontend/src/themes/theme.css` (por ejemplo `@utility surface-hidden { @apply rounded-theme border border-dashed border-border bg-bg-soft; }`) o un componente de fila en `features/backoffice/shared/`. `HiddenBadge` (hoy en `ProyectosPage.tsx`) pasa a `features/backoffice/shared/` y acepta el género («Oculto»/«Oculta»). Verificar: revisión del diff; ningún color literal nuevo fuera de `themes/presets/`.
- [x] 2.2 `ExperiencesPage.tsx`, `FormacionPage.tsx` (`Row`) y `ProyectosPage.tsx` (proyectos y enlaces): quitar `opacity-60`, aplicar el estilo de 2.1 cuando `visible === false` y usar la insignia compartida. Los textos conservan sus clases de color. Verificar: tests de 4.1 y la medición de 6.2.

## 3. Insignia de estado y región de barras (D2, D3)

- [x] 3.1 `frontend/src/themes/css-vars.ts`: constante `SUCCESS = '#00bc7d'` y `'--t-success-ink': accentInk(SUCCESS, [bg, bgSoft, card, tinte 15 % sobre bg, tinte 15 % sobre card], mode)`, con su línea en `ThemeCssVars`. `theme.css`: `--color-success: #00bc7d` (o la variable equivalente) y `--color-success-ink: var(--t-success-ink)` en `@theme inline`, y el valor por defecto de `--t-success-ink` junto a los demás `--t-*` de respaldo. Verificar: tests de 4.2.
- [x] 3.2 `ExperienceTimeline.tsx`: la insignia «Actual» pasa a `border-success/30 bg-success/15 text-success-ink`. `ExperiencesPage.tsx`: la insignia «Actual» pasa a `text-success-ink`. Opcional: el punto de `Hero.tsx` a `bg-success` (decorativo). Verificar: `grep -r "emerald-" frontend/src` sin resultados fuera de `themes/` y tests de 4.3 y 4.4.
- [x] 3.3 `DashboardPage.tsx` (`DayBars`): envolver el `<ol>` en `<div role="region" aria-label="Visitas por día" tabIndex={0} className="overflow-x-auto pb-1">` y quitar `overflow-x-auto` del `<ol>`. Verificar: test de 4.5 y la medición de 6.2.

## 4. Pruebas (Vitest)

- [x] 4.1 Tests de `ExperiencesPage`, `FormacionPage` y `ProyectosPage` (los `*.test.tsx` vigentes): con un ítem `visible: false`, la fila (`[data-visible="false"]`) no tiene ninguna clase `opacity-*`, muestra la insignia «Oculta»/«Oculto» con el ícono y tiene el estilo de 2.1; una fila visible no lo tiene. Verificar: `npm test` verde y que el test falla si se restituye `opacity-60` en cualquiera de las cuatro listas.
- [x] 4.2 `css-vars.spec.ts`: para los cinco presets, `--t-success-ink` mide ≥ 4,5:1 contra `bg`, `bgSoft`, `card` y los dos tintes (con `contrastRatio`); en `modern-dark` y `elegant` es `#00bc7d`; en `modern-light` es `#00754e`; con un override `card: '#1E293B'` sobre `modern-light` el derivado se recalcula y sigue cumpliendo. Verificar: `npm test` verde.
- [x] 4.3 Test del componente de la línea de tiempo (o del perfil público): con una experiencia `current`, la insignia «Actual» usa `text-success-ink` y ninguna clase `emerald-*`. Verificar: `npm test` verde.
- [x] 4.4 Test estático hermano de `brand-ink-usage.spec.ts`: en `shared/components/portfolio`, `features/navigation`, `features/curated-view` y `features/backoffice`, ninguna línea usa un color de Tailwind con nombre como texto (`text-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+`) ni `opacity-` junto a `data-visible`/`visible ?`. Verificar: `npm test` verde y que el test falla con una línea de prueba que use `text-emerald-500`.
- [x] 4.5 `DashboardPage.test.tsx`: la lista de barras está dentro de un elemento con `role="region"`, nombre accesible «Visitas por día» y `tabIndex` 0 (`getByRole('region', { name: 'Visitas por día' })`), y la lista conserva sus `listitem`. Verificar: `npm test` verde.
- [x] 4.6 `npm run lint`, `npm run typecheck` y `npm test` en `frontend/`. Verificar: los tres verdes; salida en `verification/4.6-lint-tipos-tests.txt`.

## 5. Auditoría y CI (D4, D5)

- [x] 5.1 `frontend/scripts/check-a11y.mjs`: antes de lanzar Chrome, `GET /api/curated-profiles/<PROFILE>`; si no responde 200, imprimir `El perfil base «<slug>» no existe en esta base: definí A11Y_CHECK_PROFILE con un slug público.` y salir con 2. Actualizar la cabecera del script (códigos de salida y la variable). Verificar: contra la base de ejemplo y sin `A11Y_CHECK_PROFILE`, sale con 2 sin abrir páginas (`ProfileView` no cambia: `SELECT count(*)` antes y después) — salida en `verification/5.1-perfil-base.txt`.
- [ ] 5.2 `.github/workflows/ci.yml`, job `web-quality`: matriz `check: [a11y, a11y-example, lighthouse]`; paso de siembra condicional (`a11y-example`: `SEED_DISPOSABLE_DB=1 npm run seed:example` y `npm run seed:example:verify`; el resto: `npm run seed` y `npm run seed:verify`), `admin:bootstrap` en todas; paso de accesibilidad con `if: startsWith(matrix.check, 'a11y')` y `A11Y_CHECK_PROFILE` según la pierna (`ejemplo-backend` / `tech-lead-dotnet`); el nombre del job y del artefacto siguen usando `matrix.check`. Comentario en el YAML con el costo (D5). Verificar: el PR muestra las tres piernas verdes; anotar la duración de cada una en `verification/5.2-ci.txt`.
- [ ] 5.3 Prueba negativa del CI: en un commit temporal del PR (que se revierte antes del merge), restituir `opacity-60` en una sola fila. Verificar: falla `web-quality (a11y-example)` con `color-contrast` y `web-quality (a11y)` pasa; enlace a la corrida en `verification/5.2-ci.txt`. Revertir y confirmar las tres piernas verdes.

## 6. Medición local

- [x] 6.1 Crear las dos bases descartables del encabezado, migrarlas, sembrarlas y crear el administrador de prueba en cada una. Levantar la API (`NODE_ENV=production` con secretos de un solo uso, como el CI) y la imagen de `frontend/Dockerfile` con Caddy. Verificar: `npm run prisma:status` nombra la base descartable antes de cada siembra; `seed:example:verify` y `seed:verify` terminan con 0.
- [x] 6.2 `a11y:check` con panel sobre la base de ejemplo (`A11Y_CHECK_PROFILE=ejemplo-backend`) y sobre la de `cv-data.json` (valor por defecto), con `--out verification/6.2-ejemplo` y `--out verification/6.2-cv`. Verificar: las dos salen con 0, **0 violaciones `serious` y 0 `critical`**, recorrido de teclado sin problemas; comparar con `audit/ejemplo-backend/a11y-summary.md` (antes: 39 `color-contrast` + 1 `scrollable-region-focusable`).
- [x] 6.3 `npm run build` y `npm run perf:budget` en `frontend/`. Verificar: un solo JS de módulo, ≤ 155 KB gzip y sin regresión apreciable frente a 1.1 (tolerancia: +0,5 KB gzip); salida en `verification/6.3-perf-budget.txt`.
- [x] 6.4 Bajar la API y el contenedor, borrar las dos bases descartables (`DROP DATABASE … WITH (FORCE)`) y la imagen local. Verificar: `docker exec portfolio-postgres psql -U portfolio -d postgres -Atc "select datname from pg_database"` ya no las lista y `portfolio` sigue ahí sin cambios.

## 7. Documentación

- [x] 7.1 `docs/MANUAL.md`: nuevo **TC-40 — Ítems ocultos e insignias legibles** (precondición: base de ejemplo descartable y sesión en `/admin`; pasos: `/admin/experiencias`, `/admin/formacion` y `/admin/proyectos` con sus ocultos; `/ejemplo-backend?theme=modern-light`, `minimal` y `corporate` con la insignia «Actual»; `/admin` a 375 px con Tab y flechas sobre las barras; resultado esperado con las cifras de D2 y la corrida de 6.2). En TC-34, una fila para el verde de estado; en TC-33, la región de las barras en el paso 4. Actualizar la línea de `a11y:check` del manual con `A11Y_CHECK_PROFILE` y la salida 2. Verificar: revisión del diff.
- [x] 7.2 `docs/manual/index.html`: el mismo TC-40 (`<article class="case" data-status id="tc40">`), en el índice lateral y en la tabla de la suite; captura opcional (si se agrega, en el manifiesto de `manual:capture` y ≤ 150 KB). Verificar: `npm run manual:check` sale con 0; salida en `verification/7.2-manual-check.txt`.
- [x] 7.3 `CLAUDE.md` (línea de `a11y:check` en *Comandos esperados*: `A11Y_CHECK_PROFILE`, salida 2 sin perfil base) y `docs/CHANGELOG.md`. Verificar: revisión del diff.

## 8. Cierre

- [x] 8.1 `npx -y @fission-ai/openspec@1.14.1 validate fix-admin-contrast --strict` y `validate --all --strict`. Verificar: el change valida sin «Archive would refuse»; las fallas de `--all` son solo las de longitud ya conocidas en specs archivadas; salida en `verification/8.1-validacion.txt`.
- [ ] 8.2 Al archivar: roadmap de `CLAUDE.md` (Fase 1.2, `fix-admin-contrast`) y `openspec/specs/web-accessibility/spec.md` sincronizada. Verificar: `git diff` del archivado y `validate --all --strict` sin fallas nuevas.
