# Tasks — add-cv-consistency-rules

> Referencias: `proposal.md`, `design.md` (D1–D15) y los deltas de `specs/` (`cv-consistency`, `admin-backoffice-shell`, `platform-manual`). La evidencia va en `verification/`.
>
> **Rama:** `feat/cv-consistency-rules` desde `main`. Antes de empezar, revisar `main`: TC-46 y TC-48 son de otros dos changes en paralelo, y el que se fusione segundo va a conflictuar en `docs/MANUAL.md` (suite de regresión y tabla de estados). Este change usa solo **TC-47** y la pantalla **B15**; si otro change ya tomó B15, usar la siguiente libre.
>
> **Orden:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Cada grupo de código va en el mismo commit que sus tests.
>
> **Bases:** ninguna tarea escribe en una base. La 8 levanta la app contra una base **descartable** sembrada con el ejemplo (`portfolio_lint_check`, creada y borrada en la misma tarea); `portfolio` (la del owner) no se toca. Los e2e corren contra la base de e2e de siempre.
>
> **Datos del owner:** si `cv:lint` da un `error` sobre `docs/cv-data.json`, no se corrige el archivo: se informa al owner (design, Migration Plan, punto 2).

## 1. Punto de partida

- [ ] 1.1 Confirmar en la rama: no existe `computeYearsOfExperience` (`grep -rn "computeYears" backend/src` vacío); `fast-check` no está en `backend/package.json`; `CuratedProfileModule` no exporta `CURATED_PROFILE_REPOSITORY`; no hay ruta `/admin/revision`. Verificar: `npm test`, `npm run test:e2e`, `npm run lint` y `npm run typecheck` en `backend/`, y `npm test` en `frontend/`, en verde antes de tocar nada; conteos en `verification/1.1-punto-de-partida.txt`.

## 2. Cálculo de años (D2, D14)

- [ ] 2.1 Agregar `fast-check` a `devDependencies` del backend (D14): versión verificada con `npm view fast-check version engines`, fijada con `~`. Verificar: `npm ci` limpio y `npm ls fast-check` muestra una sola versión; `dependencies` sin cambios (`git diff backend/package.json`).
- [ ] 2.2 `modules/profile/domain/services/compute-years-of-experience.ts`: `ExperienceInterval`, `YearsOfExperience`, `YearMonth` y `computeYearsOfExperience(intervals, asOf)` según D2 (meses inclusivos, fusión de solapados y contiguos, actual hasta `asOf`, recorte a `asOf`, inválidos ignorados). Reusa `YEAR_MONTH_REGEX` de `experience/domain/services/validate-experience.ts`. Verificar: test de arquitectura verde (sin Nest ni Prisma).
- [ ] 2.3 `compute-years-of-experience.spec.ts`, tabular: los escenarios del spec (35 meses; 23 meses con actual), un solo mes = 1, intervalos anidados, fecha inválida ignorada, fin anterior al inicio ignorado, inicio posterior a `asOf` ignorado, fin futuro recortado, lista vacía = 0, y los datos de `cv-data.json` = 103 meses con `asOf` `2026-11`. Verificar: `npm test` verde.
- [ ] 2.4 `compute-years-of-experience.property.spec.ts` con fast-check: propiedades 1 a 4 de D14 (cotas, permutación y duplicación, suma de disjuntos no contiguos, monotonía de subconjuntos), `numRuns: 200` y semilla fija leída de `FC_SEED` si está definida. Verificar: `npm test` verde; con una mutación deliberada (meses exclusivos en lugar de inclusivos) la propiedad 1 o 3 falla, y se anota en `verification/2.4-mutacion.txt` antes de revertirla.

## 3. Dominio del linter (D1, D3–D8, D11)

- [ ] 3.1 `shared/domain/i18n/missing-translation.ts`: mover `isMissingTranslation(field, locale)` desde `detect-missing-translations.ts`, que pasa a importarlo (D7). Verificar: `detect-missing-translations.spec.ts`, `example-translations.spec.ts` y `seed-translations.spec.ts` verdes **sin cambiar expectativas**.
- [ ] 3.2 `modules/cv-consistency/domain/`: `cv-snapshot.ts` (D1), `cv-issue.ts` (`CvIssue`, `CvIssueCode` con los 14 códigos de D4, `CvSeverity`, `CvEntityType`), `CvRuleContext` y `rules/` con un archivo por familia: `years.rule.ts`, `dates.rule.ts`, `current.rule.ts`, `translations.rule.ts`, `urls.rule.ts`, `certifications.rule.ts` y `curated.rule.ts`. `run-cv-rules.ts` las corre en orden fijo. Las reglas `error` reutilizan `YEAR_MONTH_REGEX`, `EDUCATION_DATE_REGEX`, `YEAR_REGEX`, el patrón de `expiresAt` de `validate-certification.ts`, `isHttpUrl` e `isHttpsUrl`; las de perfiles curados, `selectByTags` y `matchesAnyTag`. Si alguno no está exportado, se exporta sin cambiar su comportamiento. Verificar: `npm run typecheck` y el test de arquitectura verdes.
- [ ] 3.3 Tests tabulares por regla (`rules/*.spec.ts`): cada escenario de `specs/cv-consistency/spec.md`, más los alcances de D6: ocultos con fecha rota sí, ocultos sin traducir no, actual oculta no cuenta para `multiple-current`, archivado no se revisa, PRIVATE sí, y un id de ítem oculto no es huérfano. Verificar: `npm test` verde.
- [ ] 3.4 `cv-rules.seeded.fixture.ts` y `cv-rules.seeded.spec.ts` (D14): la instantánea limpia da 0 `error` y 0 `warning`; una mutación por cada uno de los 14 códigos produce ese código sobre el `entityId` y el `field` esperados y ningún otro `error`. El test recorre `CvIssueCode` y falla si un código no tiene mutación: así el 100 % es verificable. Verificar: `npm test` verde; la tabla «código → detectado» en `verification/3.4-sembrados.txt`.
- [ ] 3.5 Test cruzado con los validadores (Risks): cada mutación `error` del fixture que tiene un equivalente en un validador de escritura (`validateExperience`, `validateEducation`, `validateCertification`, `validateProject`, `validateSocialLink`) es rechazada por ese validador. Verificar: `npm test` verde.
- [ ] 3.6 `years.property.spec.ts` (propiedad 5 de D14): para experiencias y un declarado arbitrarios, `profile.years-mismatch` aparece si y solo si el declarado está fuera de `[floor, ceil]`, y sus `params` coinciden con `computeYearsOfExperience`. Más `as-of.spec.ts` (D11): el fixture sembrado con `asOf` `2026-11` y `2031-01` da los mismos `error`. Verificar: `npm test` verde.

## 4. Aplicación, API y módulo (D8, D9, D10)

- [ ] 4.1 `curated-profile.module.ts` exporta `CURATED_PROFILE_REPOSITORY`. Se confirma que `ExperienceModule`, `EducationModule`, `ProjectModule` y `SocialLinkModule` exportan sus tokens y, si no, se agregan los exports. Verificar: `npm run typecheck`; `npm run test:e2e` sigue verde.
- [ ] 4.2 `cv-consistency/application/`: `to-cv-snapshot.ts` (entidades → instantánea), `cv-issue-messages.ts` (plantillas ES de D8 y sus equivalentes EN, `entityLabel` por tipo), `cv-consistency.output.ts` y `RunCvConsistencyCheckUseCase` (D9). Verificar: `run-cv-consistency-check.use-case.spec.ts` con repositorios simulados: (a) cada repositorio se llama una vez y ningún método de escritura se llama; (b) sin perfil base, `experience` es null y no falla; (c) `asOf` sale del `Clock` en UTC (un `now` de `2026-11-30T23:30:00-04:00` da `2026-12`); (d) orden de D10; (e) `locale` `en` traduce `message` y `entityLabel` y no cambia `code`.
- [ ] 4.3 `cv-issue-messages.spec.ts`: cada `CvIssueCode` tiene plantilla en `es` y `en`, y cada `{param}` de las plantillas está entre los `params` que emite la regla en el fixture sembrado. Verificar: `npm test` verde.
- [ ] 4.4 `infrastructure/controllers/admin-cv-consistency.controller.ts`: `GET /api/admin/consistency` con `JwtAuthGuard`, `@RequestLocale()`, `Cache-Control: no-store` y documentación Swagger con los enums `CvIssueCode`, `CvSeverity` y `CvEntityType`. `cv-consistency.module.ts` registrado en `app.module.ts`. Verificar: `npm run build` y `npm run typecheck` verdes.
- [ ] 4.5 E2e `backend/test/cv-consistency.e2e-spec.ts` sobre la base de e2e sembrada: sin sesión → 401; con sesión → 200 con `summary`, `experience` y 0 `error`; `?locale=en` cambia `message` y no `code`; la respuesta trae `Cache-Control: no-store`; después de la petición, los conteos de las nueve tablas no cambiaron. Verificar: `npm run test:e2e` verde; salida en `verification/4.5-e2e.txt`.

## 5. Línea de comandos y CI (D13)

- [ ] 5.1 `backend/scripts/lib/seed-to-cv-snapshot.ts`: traduce el `SeedSource` de `parseSeedSource` a `CvSnapshot` con las claves de D13 (clave del seed o posicional) y resuelve `includeIds`/`excludeIds` (`experience:key`). Verificar: `seed-to-cv-snapshot.spec.ts` (claves estables, referencia resuelta, referencia a una clave inexistente que queda como id huérfano); la regex de `jest.testRegex` admite el archivo nuevo si vive en `test/`.
- [ ] 5.2 `backend/scripts/cv-lint.ts` y el script `"cv:lint": "tsx scripts/cv-lint.ts"`, con `--file`, `--as-of`, `--locale` y `--format` y los códigos 0, 1 y 2 de D13. No importa `@prisma/client` ni lee `DATABASE_URL`. Verificar: test del núcleo (`scripts/lib/cv-lint-runner.ts`) con la copia del ejemplo con un error sembrado → 1; con solo avisos → 0; ruta inexistente → 2; JSON que el parser rechaza → 2; `--format json` con la forma del endpoint.
- [ ] 5.3 Corridas reales: `npm run cv:lint` y `npm run cv:lint -- --file ../docs/examples/cv-data.example.json`, con `DATABASE_URL` vacía. Verificar: los dos salen con 0; la salida completa en `verification/5.3-cv-lint.txt`. Con `cv-data.json` aparece `profile.years-mismatch` (10 contra 8 años y 7 meses); si aparece cualquier `error`, se detiene y se informa al owner.
- [ ] 5.4 `.github/workflows/ci.yml`, job `backend`: `npm run cv:lint` y `npm run cv:lint -- --file ../docs/examples/cv-data.example.json` después de `typecheck`. Verificar: el CI del PR muestra los dos pasos en verde.

## 6. Contrato y panel (D10, D12)

- [ ] 6.1 `npm run openapi:export` y, en `frontend/`, `npm run api:types`: aparece `GET /api/admin/consistency` con los tres enums. Verificar: el test de deriva del frontend verde y `git diff --exit-code` tras un segundo export.
- [ ] 6.2 `use-admin-api.ts`: `useCvConsistency()` (`staleTime: 0`, `refetch` expuesto). `revision/issue-links.ts`: el mapeo de D12. Verificar: `issue-links.spec.ts` cubre los diez `entityType` y codifica el id en la URL.
- [ ] 6.3 `shared/use-edit-param.ts` y su uso en Experiencias, Skills, Formación y Proyectos (D12): cuando la lista cargó, abre el diálogo del id, saca `editar` con `replace` y, si no lo encuentra, muestra «El ítem ya no existe.». Verificar: un test por pantalla (abre el diálogo correcto, incluidas una certificación en Formación, un enlace en Proyectos y una skill en Skills; id inexistente → toast y ningún diálogo) y `use-dialog-discard-guard.test.tsx` sin cambios.
- [ ] 6.4 `revision/RevisionPage.tsx`, la ruta `revision` en `BackofficeApp.tsx` y el ítem **Revisión** (`ListChecks`) en `NAV` después de Perfiles curados. Verificar: `RevisionPage.test.tsx`: resumen y línea de experiencia; bloques Errores, Avisos y Sugerencias en ese orden y los vacíos ocultos; agrupación por entidad; **Abrir** con el `href` de `issue-links`; estado vacío con «No hay hallazgos: el CV es consistente.»; estado de error con reintento; **Volver a revisar** vuelve a pedir; la severidad se lee como texto (consulta por rol y nombre, no por clase). `AdminShell.test.tsx` incluye el ítem nuevo.
- [ ] 6.5 Tests de accesibilidad del panel: `AdminShell.a11y.test.tsx` y un test axe de `RevisionPage` con los tres bloques. Verificar: `npm test` verde; `npm run perf:budget` igual que antes (el panel es un chunk aparte), con el número en `verification/6.5-perf-budget.txt`.

## 7. Calidad

- [ ] 7.1 Backend: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` y `npm run test:e2e`. Verificar: todo verde; conteos en `verification/7.1-backend.txt`.
- [ ] 7.2 Frontend: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` y `npm run perf:budget`. Verificar: todo verde; conteos en `verification/7.2-frontend.txt`.
- [ ] 7.3 `fast-check` fuera del runtime: `grep -rn "fast-check" backend/dist` vacío después de `npm run build`, y `npm ls fast-check --omit=dev` sin resultados. Verificar: salida en `verification/7.3-dev-only.txt`.

## 8. App real

- [ ] 8.1 Base descartable `portfolio_lint_check` sembrada con `npm run seed:example` (`SEED_DISPOSABLE_DB=1`), API y frontend levantados (de preferencia la imagen de `frontend/Dockerfile`). Verificar: `npm run prisma:status` contra `portfolio_lint_check` antes de sembrar; el entorno en `verification/8.1-entorno.txt`.
- [ ] 8.2 Ejecutar **TC-47** (`verification.md`) completo, panel y API. Verificar: resultado paso por paso en `verification/8.2-tc47.txt` y la captura `bo-revision.jpg` con `npm run manual:capture` (sumarla al manifiesto de `capture-manual.mjs`).
- [ ] 8.3 `npm run a11y:check` con panel (`A11Y_CHECK_DISPOSABLE_DB=1`), con `/admin/revision` sumada a las rutas del panel. Verificar: 0 violaciones; salida en `verification/8.3-a11y.txt`. Borrar `portfolio_lint_check` al terminar.

## 9. Docs y cierre

- [ ] 9.1 `docs/MANUAL.md` y `docs/manual/index.html`: pantalla **B15 — Revisión** (severidades, aviso de años según la pregunta 20 = A, enlaces **Abrir**, que nada se corrige solo y `cv:lint`), **TC-47** con el texto de `verification.md`, la fila en la suite de regresión, la entrada de `cv:lint` en § 0 o § 5 y el glosario (hallazgo, severidad). Verificar: `npm run manual:check` verde con TC-47 y la captura.
- [ ] 9.2 `docs/DATA-POPULATION.md`: correr `npm run cv:lint -- --file <archivo>` antes de sembrar y qué significa cada código de salida. `docs/CHANGELOG.md`: la entrada del change. Verificar: diff revisado.
- [ ] 9.3 `npx -y @fission-ai/openspec@1.14.1 validate add-cv-consistency-rules --strict` y `validate --all --strict`. Verificar: sin fallos y sin «Archive would refuse»; salida en `verification/9.3-validacion.txt`.
- [ ] 9.4 Al archivar: la línea del change en el roadmap de `CLAUDE.md`, con `npm run cv:lint` en la lista de comandos. **No** se toca `docs/PROPUESTA-FEATURES.md`: lo actualiza otro change. Verificar: diff de `CLAUDE.md`.
