# Tasks — add-featured-repositories

> Referencias: `proposal.md`, `design.md` (D1–D17; P1–P6 resueltas) y los deltas de `specs/`. La evidencia va en `verification/`, como en `add-certification-verification`.
>
> **Orden:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11. Cada grupo de código va en el mismo commit que sus tests. El 10 (docs) puede escribirse en paralelo con el 8, salvo las capturas, que necesitan el 9.
>
> **Bases:**
> - `portfolio` (la del owner, `localhost:5434`): **ninguna** tarea le escribe. No hay migración (D1).
> - Los e2e corren contra la base de e2e de siempre (migrada y sembrada con `docs/cv-data.json`).
> - `portfolio_repos_check`: base descartable **nueva** en el mismo contenedor, sembrada con el ejemplo, para la app real (9); borrada al terminar. Antes de cada comando que escriba en una base, `npm run prisma:status` para confirmar el destino.
>
> **Conflictos esperables** con `add-integrations-foundation` y `add-job-posting-intake`: después de rebasar, regenerar `openapi.json` y `api.d.ts` con los comandos (nunca a mano) y reservar TC-50 solo para este change.

## 1. Punto de partida

- [x] 1.1 Confirmar en la rama: `FeaturedRepository` sin código en `backend/src`; `SECTION_IDS` con 9 ids; el seed crea solo repos visibles. Verificar: `npm test` y `npm run test:e2e` en `backend/`, y `npm test`, `npm run build` y `npm run perf:budget` en `frontend/` verdes; el tamaño del arranque anotado en `verification/1.1-punto-de-partida.txt`.

## 2. Dominio del módulo (D1, D2, D3)

- [x] 2.1 `modules/featured-repository/domain/services/parse-github-repository-url.ts`: `parseGithubRepositoryUrl(value)` → `Result<{ owner, repo }, ValidationError>` con las reglas de D2, y `githubRepositoryKey(owner, repo)` (minúsculas, `owner/repo`). Verificar: spec unitario con todos los casos de la spec *URL de GitHub canónica* (válidos y rechazados), owner de 39 y de 40, repo `.`/`..`, `a--b` como owner rechazado.
- [x] 2.2 `domain/entities/featured-repository.entity.ts` (sin `stars`), `domain/repositories/featured-repository.repository.ts` (token `FEATURED_REPOSITORY_REPOSITORY`, `findAll`, `findAllVisible`, `findById`, `save`, `delete`), `domain/errors/featured-repository-not-found.error.ts` y `domain/services/validate-featured-repository.ts` (nombre 1–100 recortado, `language` ≤ 40, URL con 2.1). Verificar: spec unitario de la validación y el test de arquitectura (sin Nest ni Prisma en `domain/`).

## 3. Aplicación, persistencia y API (D3, D7)

- [x] 3.1 `application/`: `FeaturedRepositoryOutput` (público, resuelto) y el DTO del panel; mappers; `ListFeaturedRepositoriesUseCase` (locale) y los casos de uso de admin (listar crudo, crear, detalle, editar parcial, borrar) con la unicidad de D2 (`ConflictError` si otro registro tiene la misma clave; editar sin cambiar la URL no choca). Verificar: specs con repositorio simulado: listado ordenado sin ocultos; alta duplicada con otras mayúsculas → `ConflictError` sin `save`; `PATCH` solo de `name` → ok; inválido → `ValidationError` sin `save`; borrar inexistente → not found.
- [x] 3.2 `infrastructure/persistence/`: `PrismaFeaturedRepositoryRepository` y su mapper (ignora `stars`). Verificar: spec del mapper (ida y vuelta, `language` nulo).
- [x] 3.3 `infrastructure/controllers/`: `GET /api/featured-repositories` con `@RequestLocale()` y `Content-Language`; `/api/admin/featured-repositories` con el guard del panel; DTOs con `class-validator` (`@Matches` con la regex exportada del dominio, `@MaxLength`, `LocalizedTextDto`), whitelist; schemas de respuesta de Swagger. `featured-repository.module.ts` registrado en `app.module.ts`. Verificar: `npm run typecheck` y `npm run lint`.
- [x] 3.4 E2e `featured-repositories.e2e-spec.ts`: tras el seed, público y admin vacíos; sin sesión → 401; `POST` válido → 201 y aparece en ambos listados (en `en`, descripción en inglés); `POST` con `stars` → 400; con URL `https://gitlab.com/a/b`, `https://github.com/a/b/` y `https://github.com/a/b.git` → 400; duplicado con otras mayúsculas → 409; `PATCH visible:false` → sale del público y sigue en el panel; `DELETE` → 204 y detalle 404. Limpiar al terminar. Verificar: `npm run test:e2e` verde; salida en `verification/3.4-e2e.txt`.

## 4. Resolución del perfil curado (D4, D5, D6, D10)

- [x] 4.1 `resolve-sections.ts`: `repositories` entre `projects` y `education`; `MIN_REPOSITORIES_FOR_SECTION = 2`. `sections-with-data.ts`: `repositories: output.repositories.length >= MIN_REPOSITORIES_FOR_SECTION`. Verificar: specs de `resolve-sections` y `sections-with-data` (0, 1 y 2 repos; orden vacío → diez ids; orden explícito sin el id → relleno al final).
- [x] 4.2 `PortfolioSectionsLoader` suma el puerto de repositorios (solo visibles); `CuratedProfileComposer` selecciona con `selectByTags` y ordena por `order`; `CuratedProfileOutput`, `toCuratedProfileOutput` y los schemas de Swagger de la vista y del preview suman `repositories`. Verificar: spec del composer con repositorios simulados: intersección, `excludeIds`, `includeIds` sobre oculto ignorado, 1 repo → sin sección pero con el dato; la spec de forma completa con la clave nueva.
- [x] 4.3 `json-resume.mapper.ts`: repos tras los proyectos con `type: "repository"` y `keywords` de D10; la clave `projects` se emite si `projects` o `repositories` están en `sections`. Verificar: spec del mapper (perfil con ambos, con `projects` oculta, con 1 repo) y el test de validación contra el schema vendorizado.
- [x] 4.4 `detect-missing-translations.ts`: `description` de cada repo seleccionado como entidad `repository`. Verificar: spec unitario.
- [x] 4.5 E2e de la vista curada con dos repos creados por la API sin tags: `GET /api/curated-profiles/all` trae `repositories` con 2 y `sections` con el id después de `projects`; borrando uno, la sección desaparece y `repositories` tiene 1; `resume.json` de `all` con 2 repos valida y termina con dos `type: "repository"`. Restaurar al terminar. Verificar: `npm run test:e2e` verde.

## 5. Consistencia del CV (D16)

- [x] 5.1 `to-cv-snapshot.ts` y `cv-snapshot.ts` suman repositorios; `translations.rule.ts` emite `i18n.missing-translation` para `description` de los visibles con `entityType: 'repository'`; mensaje en `cv-issue-messages.ts`. Verificar: specs de la regla (visible sin `en` → issue; oculto → nada) y `npm run cv:lint` sobre el ejemplo sin issues nuevos.

## 6. Seed y datos (D14, D15)

- [x] 6.1 `scripts/lib/seed-source.ts`: `SeedFeaturedRepository.id?`, validación con `parseGithubRepositoryUrl`, unicidad por clave e `id` único; `stars` aceptado y sin validar más allá de número; refs `repository:<id>` en `includeRefs`/`excludeRefs`; `expectedCounts` sin filtrar visibles. `seed-runner.ts`: crea todos con `visible`, `order` = posición, sin `stars`; resuelve `repository:` a ids. Verificar: specs de `seed-source` (URL gitlab → error con la ruta del campo; duplicado → error; `repository:no-existe` → error; archivo con `stars` y sin `id` → válido).
- [x] 6.2 `docs/cv-data.json`: `featuredRepositories: []` (si el owner ya cargó repos reales, conservarlos y sumar a este change un MODIFIED del requisito *Seed completo desde cv-data.json* con el conteo nuevo). Verificar: `npm run seed` sobre una base vacía y `npm run seed:verify` → código 0 con `FeaturedRepository 0`.
- [x] 6.3 `docs/examples/cv-data.example.json`: los tres repos de D15 con `es` y `en` completos; `ejemplo-overrides` suma `repository:experimento-oculto` en `includeRefs`; `ejemplo-secciones` declara las diez secciones (y su `description` dice «las diez secciones»). Verificar: test del archivo de ejemplo (URLs de repos con el prefijo de la cuenta ficticia), `example-translations.spec.ts` verde y el escenario *Umbral de repositorios* con la resolución sin base.
- [x] 6.4 Sobre `portfolio_repos_check` vacía y migrada: `SEED_DISPOSABLE_DB=1 npm run seed:example` y `npm run seed:example:verify` → código 0 con `FeaturedRepository 3`. Verificar: transcripción en `verification/6.4-seed.txt`.

## 7. Contrato (api-contract-types)

- [x] 7.1 `npm run openapi:export` y, en `frontend/`, `npm run api:types`. Verificar: `SectionId` con `repositories` entre `projects` y `education`; `git diff --exit-code` tras un segundo export y generación; el test de deriva verde. El frontend **no** compila hasta 8.2 (esperado: registro exhaustivo).

## 8. Frontend (D8, D9, D12, D13, D17)

- [x] 8.1 `shared/i18n/messages.ts`: las claves de D17 en ES y EN. Verificar: test de paridad de claves.
- [x] 8.2 `shared/components/portfolio/Repositories.tsx` y `section-registry.ts` con `lazyWithPreload`; precarga en la vista pública cuando `sections` contiene `repositories`; contenedor con título y alto reservado mientras carga. Verificar: Vitest (render con 2 repos: enlaces con `target`/`rel` y nombre accesible propio; sin `language` no hay etiqueta; perfil sin la sección no llama a `preload`); `npm run build` y `npm run perf:budget` → código 0, un solo JS de módulo, crecimiento ≤ 0,5 KB gzip respecto de 1.1 y el chunk de la sección fuera de `index.html` (anotar en `verification/8.2-budget.txt`).
- [x] 8.3 `features/curated-view/print/print-sheet.ts`: `PRINT_LIMITS.repositories = 3`, `estimatePrintLines`, `PRINT_CAPACITY_LINES` y el bloque `repositories` de D9; `PrintableSheet.tsx` lo renderiza con `LinkOrText`. Verificar: specs de `print-sheet` (entra; estimado `capacidad − 1` → no entra y sin línea de omitidos; 5 repos → 3 y «y 2 más»; nombre de 45 caracteres recortado; texto sin `github.com`; sin la sección en `sections` → sin bloque).
- [x] 8.4 Calibrar `PRINT_CAPACITY_LINES` con `npm run print:check` (con `PRINT_CHECK_DISPOSABLE_DB=1`) contra `portfolio_repos_check` (ejemplo) y contra una base descartable con `docs/cv-data.json` más dos repos de prueba visibles sin tags creados por la API; registrar el valor y la tabla final en D9 de `design.md`. Verificar: las dos corridas con código 0, salidas en `verification/8.4-print.txt`.
- [x] 8.5 `features/backoffice/proyectos/`: bloque Repositorios, `RepositoryForm.tsx`, Zod con la regla de D2 y sus mensajes literales, nombre propuesto desde la URL, 409 en el campo URL, borrado con confirmación, aviso de cambios sin guardar; rótulo de la página de D12; `use-proyectos-api.ts` y `test/msw-admin.ts`. Verificar: Vitest de `ProyectosPage` y del schema (URL inválida no envía; 409 muestra «Ese repositorio ya está cargado»; nombre propuesto; ocultos marcados).
- [x] 8.6 `features/backoffice/curated-profiles/`: bloque Repositorios en Selección (Incluir/Excluir mutuamente excluyentes, ocultos), huérfanas con las cuatro listas en `selection-overrides.ts`, aviso del umbral y faltantes de traducción de repos. Verificar: Vitest de `ProfileBuilderPage`/`selection-overrides` con los escenarios de la spec `curated-profile-builder` (incluido «una lista no cargó» para repositorios).
- [x] 8.7 Verificar: `npm run lint`, `npm run typecheck` y `npm test` del frontend verdes.

## 9. App real y checks de calidad

- [ ] 9.1 Con la imagen de `frontend/Dockerfile` y la API sobre `portfolio_repos_check`: `A11Y_CHECK_DISPOSABLE_DB=1 npm run a11y:check -- <base>` (con credenciales del panel, `A11Y_CHECK_PROFILE=ejemplo-backend`) y `npm run perf:check -- <base>` (≥ 85). Verificar: ambos con código 0; salidas en `verification/9.1-calidad.txt`.
- [ ] 9.2 `MANUAL_CAPTURE_DISPOSABLE_DB=1 npm run manual:capture -- <base>`: captura nueva del bloque Repositorios de `/admin/proyectos` con su diálogo y de la sección pública; regenera las que cambian (`/admin/proyectos`, Selección del constructor). Verificar: `npm run manual:check` verde (topes de 150 KB por imagen y 4 MB en total).

## 10. Documentación

- [ ] 10.1 `docs/MANUAL.md` y `docs/manual/index.html`: **TC-50 — Destacar repositorios de GitHub** (alta con URL inválida y repetida, dos repos visibles en la home, umbral con `ejemplo-renombrado`, Incluir/Excluir en el constructor, línea en el PDF y `resume.json`), los mensajes literales, el bloque de `/admin/proyectos` y la sección en el glosario. Verificar: `npm run manual:check` verde y TC-50 en el índice de casos.
- [ ] 10.2 `docs/DATA-POPULATION.md` § 10 (deja de ser «inerte»: panel, umbral de 2, solo GitHub) y § 12.10 (fila por campo: `id`, `name`, `url`, `language`, `description`, `technologies`, `tags`, `visible`, `stars` ignorado; dónde se ve y qué pantalla lo edita), más `repository:<id>` en la fila de `includeRefs`. Verificar: el escenario *Campo documentado* de `example-seed-data` para cada clave nueva del ejemplo.
- [ ] 10.3 `docs/CHANGELOG.md`: entrada del change (sección nueva, umbral, PDF condicional, JSON Resume, sin migración ni dependencias, tamaño del arranque). Verificar: lectura.

## 11. Cierre

- [ ] 11.1 `npx -y @fission-ai/openspec@1.14.1 validate add-featured-repositories --strict` y `validate --all --strict` sin errores nuevos ni «Archive would refuse»; CI verde (`web-quality` incluido). Verificar: salida en `verification/11.1-validate.txt`.
- [ ] 11.2 Al archivar: línea del roadmap en `CLAUDE.md` y la mención de `SECTION_IDS` (diez ids) en la sección de decisiones. Verificar: `git diff CLAUDE.md`.
