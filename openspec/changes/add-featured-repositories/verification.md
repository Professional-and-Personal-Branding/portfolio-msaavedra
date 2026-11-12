# Verificación — add-featured-repositories

Implementado en la rama `feat/featured-repositories` (worktree `wt-repos`), sobre `main` en `164e4ba`. La evidencia de cada grupo está en `verification/`. Todas las bases fueron descartables (`portfolio_repos_e2e`, `portfolio_repos_check`, `portfolio_repos_print`, dentro de `portfolio-postgres`); la base `portfolio` del owner no se tocó.

## Suites antes y después

| Suite | Antes (1.1) | Después |
|---|---|---|
| Backend `npm test` (Jest) | 126 suites · 1350 tests | 132 suites · 1460 tests |
| Backend `npm run test:e2e` | 20 suites · 338 tests | 22 suites · 364 tests |
| Frontend `npm test` (Vitest) | 74 archivos · 1136 tests | 77 archivos · 1209 tests |
| `perf:budget` (JS del arranque, gzip) | 148,9 KB + 1,2 KB (profile-prefetch) = 150,1 KB | 149,7 KB + 1,2 KB = 150,9 KB (tope 155) |

## Resultado de cada comando

| Comando | Resultado |
|---|---|
| backend `npm run lint`, `npm run typecheck`, `npm run build` | verde |
| backend `npm test` | 132 suites · 1460 tests verdes |
| backend `npm run test:e2e` (base descartable migrada y sembrada con `docs/cv-data.json`) | 22 suites · 364 tests verdes |
| backend `npm run openapi:export` + `git diff --exit-code -- openapi.json` | sin deriva |
| frontend `npm run api:types` (dos veces) | sin deriva; el test de deriva de `api.d.ts` verde |
| frontend `npm run lint`, `npm run typecheck`, `npm run build` | verde |
| frontend `npm test` | 1209 tests verdes (ver la nota de flakiness) |
| frontend `npm run perf:budget` | código 0; un solo JS de módulo; el chunk `Repositories-*.js` (0,87 KB gzip) fuera de `index.html` |
| frontend `npm run manual:check` | 49 casos alineados, 53 imágenes (3,90 MB), `index.html` 315 KB |
| `print:check` | 20 casos sobre el ejemplo y 56 sobre `docs/cv-data.json` con dos repositorios de prueba: todos en una página (A4 y Letter), contraste mínimo 9,74:1 |
| `a11y:check` con panel (`A11Y_CHECK_PROFILE=ejemplo-backend`) | 62 cargas, 0 violaciones, recorrido de teclado sin problemas |
| `perf:check` (Lighthouse mobile, 3 corridas, umbral 85) | home 94, perfil 95, perfil en inglés con sidebar 95; Accesibilidad, Mejores prácticas y SEO 100 |
| `manual:capture` | tres capturas nuevas (`tc50-*`) y `tc27-proyectos`, `tc13-seleccion` y `tc43-overrides` regeneradas; ninguna sobre 150 KB |
| `npm run seed` / `seed:verify` sobre una base vacía | código 0, `FeaturedRepository 0` |
| `SEED_DISPOSABLE_DB=1 npm run seed:example` / `seed:example:verify` | código 0, `FeaturedRepository 3` (uno con `visible = false`, `stars` nula) |
| `npm run cv:lint` sobre el ejemplo | idénticos hallazgos que antes del change (2) |
| `npx -y @fission-ai/openspec@1.14.1 validate add-featured-repositories --strict` y `validate --all --strict` | 42 de 42 sin errores ni «Archive would refuse» (`verification/11.1-validate.txt`) |

**Nota de flakiness.** Con la máquina cargada (otros agentes corriendo suites, la API, Caddy y Chrome de las verificaciones) fallan por timeout `ProfileBuilderPage.test.tsx > cambiar tags vuelve a previsualizar…` (ya fallaba en la línea base) y, una vez, `CuratedProfileView.staged.test.tsx > cambiar el idioma con el perfil revelado…`. Aislados, ambos archivos pasan.

## TC-50

Número reservado solo para este change. Quedó en 🔍: los pasos 1 a 8 se ejecutaron en la app real (Chrome controlado con la sesión iniciada por `POST /api/auth/login`, sin escribir contraseñas) y por la API; el paso 9 (diálogo de impresión de Chrome) no se ejecutó a mano y lo cubren `print:check` y la línea impresa en el DOM de impresión. Ver el caso en `docs/MANUAL.md` y la tabla del § 6.

## Desvíos y decisiones menores (sin cambiar arquitectura)

1. **Orden de secciones de las bases ya sembradas (D4) — resuelto con una migración de datos.** El seed escribe `sectionsOrder: [...SECTION_IDS]`, así que las filas anteriores tenían nueve ids y la sección habría llegado al final. La migración `20261112235611_order_repositories_section` la inserta tras `projects` (idempotente; no toca arreglos vacíos ni filas que ya la tienen). Evidencia: `verification/12-migracion-orden.txt`.
2. **El puerto del repositorio usa `create` y `update`** (como `project`), no un único `save` (tarea 2.2). Los specs de los casos de uso verifican que no se escribe (`create`/`update`) ante conflicto o validación fallida.
3. **Reglas de perfiles curados de `cv-consistency`.** Para que `cv:lint` sobre el ejemplo no dé `curated.orphan-reference` por `repository:experimento-oculto`, la regla reconoce los ids de los repositorios (visibles u ocultos) y cuenta los tags de los visibles en `curated.unmatched-filter-tag`. El delta de D16 no lo pedía: lo agregué como requisito nuevo en `specs/cv-consistency/spec.md`.
4. **Digest del seed por defecto.** `LEGACY_SHA256` de `seed-runner.spec.ts` cambió porque `sectionsOrder` copia `SECTION_IDS`; verifiqué que quitando `repositories` de esas listas el digest vuelve al original.
5. **Arranque público +0,8 KB gzip** (148,9 → 149,7), no ≤ 0,5 KB como pide el objetivo de D8: la sección, sus rótulos y el wrapper diferido sumaron 0,3 KB (medido en 8.2) y la línea del PDF con su estimador, 0,5 KB más. El tope de `perf:budget` (155 KB) y un solo JS de módulo se mantienen. Decidir si la línea del PDF debe quedar fuera del arranque.
6. **Calibración (D9).** `PRINT_CAPACITY_LINES = 63`. El peso «+1 tecnologías» de la experiencia detallada se aplica siempre (literal de la tabla). El perfil que desborda con la línea es `tech-lead-dotnet` en Letter (estimado 63 y 62). La tabla está en D9 de `design.md`.
7. **Imagen de frontend.** `docker build` necesita bajar `node:22-alpine`; usé la imagen `caddy:2` ya presente con el `dist/` y el `Caddyfile` del repo montados (lo mismo que sirve la imagen de `frontend/Dockerfile`).
8. **`perf:check` local en Windows.** El manual advierte que el Chrome de Windows no es comparable con el runner de GitHub (da más alto aquí); el valor que decide es el del job `web-quality` del CI.
9. **Detalles del panel.** `tagUniverse` recibe los repositorios como 5.º parámetro; el grupo del aviso de faltantes se llama «Repositorio» (D13); `?editar=<id>` de la Revisión abre también el diálogo de un repositorio (`issue-links`); los fixtures y MSW del frontend suman repositorios.
10. **Tests del frontend actualizados por el décimo id:** `sections.spec`, `layouts.test`, `profile-draft.spec`, `ProfileBuilderPage.test`, `use-edit-param.test` (el título de la página pasó a «Proyectos, repositorios y enlaces») y la fixture por defecto, que ahora trae dos repositorios.

## Pendientes y dudas para la sesión principal

- El job `web-quality` del CI mide la Performance con el equipo de referencia: confirmar ≥ 85 tras abrir el PR.
- `docs/manual/index.html` y `MANUAL.md` ya tienen TC-50; si otro change reservó otro número en paralelo, el conflicto esperable es el de las tablas del manual y `CHANGELOG.md`.
