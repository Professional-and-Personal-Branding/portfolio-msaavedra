# Tasks — polish-views-updated-at-and-builder

> Referencias: `proposal.md`, `design.md` (D1–D9, P1–P2) y los deltas de `specs/` (`profile-view-analytics`, `public-seo`, `curated-profile-builder`). La evidencia va en `verification/`, como en los changes archivados.
>
> **Orden:** 1 → 2 → 3 → 4 (opcional, según P2) → 5 → 6 → 7 → 8. Los grupos 2 y 3 pueden ir en commits propios del mismo PR; el 6 va en uno aparte para poder revertirlo solo.
>
> **Bases:** el e2e corre contra la base local del e2e (migrada y sembrada), como el resto de `npm run test:e2e`. Ninguna tarea usa la base `portfolio` del owner ni corre `views:reclassify` sobre ella. La captura del grupo 7 usa una base **descartable** sembrada con `seed:example` (`MANUAL_CAPTURE_DISPOSABLE_DB=1`), creada y borrada en la misma tarea.
>
> **Rama apilada:** `fix/views-updated-at-and-builder` sale de `feat/profile-structured-data` (PR #47). Antes del grupo 8, si #47 ya está en `main`, rebasar sobre `main`.

## 1. Punto de partida y rojo

- [ ] 1.1 Confirmar la base: la rama contiene `upgrade-profile-structured-data` (#47), y `npm run lint`, `npm run typecheck` y `npm test` del backend y del frontend están verdes (el frontend, en una corrida tibia). Verificar: salida en `verification/1.1-punto-de-partida.txt` con el hash de partida.
- [ ] 1.2 Escribir `backend/test/views-updated-at.e2e-spec.ts` según D4 (fecha fijada, visita `HUMAN` con `BROWSER_UA`, `settleBackgroundTasks`, `updatedAt` exacto, `<lastmod>2026-01-15</lastmod>` junto al `<loc>` de `/tech-lead-dotnet`, control con `PATCH`, caso de `applyReclassification` y `afterAll` que restituye `updatedAt`, `views` y las visitas marcadas). Sin tocar el código todavía. Verificar: `npm run test:e2e -- views-updated-at` **falla** en los pasos 3 y 5 de D4 y pasa el control del paso 4; salida en `verification/1.2-rojo.txt`. Además, con un cambio temporal del `record` a `updateMany` (que no se commitea), el paso 3 sigue fallando: así se confirma la alternativa descartada de D1.

## 2. El contador no toca `updatedAt` (D1, D2)

- [ ] 2.1 `prisma-profile-view.repository.ts`, `record`: reemplazar `curatedProfile.update({ data: { views: { increment: 1 } } })` por el `$executeRaw` parametrizado de D1, en la misma posición del `$transaction([...])` y con la misma condición `kind === 'HUMAN'`. Comentario junto al SQL: el motivo («una visita no es una edición») y la advertencia de nombres de tabla y columna escritos a mano. Corregir el comentario «Único SQL crudo del proyecto» de `aggregate`. Verificar: los pasos 3 y 4 de D4 en verde; `background-views.e2e-spec.ts` (incluido «todo o nada»), `view-kind.e2e-spec.ts` y `share-links.e2e-spec.ts` verdes sin cambios.
- [ ] 2.2 `backend/scripts/lib/reclassify-views.ts`, `applyReclassification`: escribir `views` con `tx.$executeRaw` (D2) dentro de la misma transacción interactiva, sin cambiar lotes, `timeout` ni `maxWait`. Verificar: el paso 5 de D4 en verde y `backend/test/reclassify-views.spec.ts` verde sin cambios.
- [ ] 2.3 Comprobar que no hay otras escrituras de `views` con `update`/`updateMany`. Verificar: `grep -rn "views:" backend/src backend/scripts` solo muestra lecturas, el `create` del seed, el mapper y los dos `$executeRaw`; resultado anotado en `verification/2.3-escrituras.txt`.
- [ ] 2.4 Backend completo: `npm run lint`, `npm run typecheck`, `npm run test` y `npm run test:e2e`. `npm run openapi:export` no cambia `backend/openapi.json` (sin cambios de contrato). Verificar: todo verde y `git diff --exit-code backend/openapi.json`; salida en `verification/2.4-backend.txt`.

## 3. Contadores del preview (D5, D6)

- [ ] 3.1 `frontend/src/shared/i18n/plural.ts` con `formatCount(count, { one, other }, locale = 'es')` sobre `Intl.PluralRules` (D5) y `plural.spec.ts`: en `es`, 0 → «0 proyectos», 1 → «1 proyecto», 2 → «2 proyectos»; en `en`, 0 → «0 projects», 1 → «1 project», 2 → «2 projects». Verificar: `npm test -- plural` verde.
- [ ] 3.2 `PreviewPanel.tsx`: los tres contadores con `formatCount` y formas en español (`experiencia`/`experiencias`, `categoría`/`categorías`, `proyecto`/`proyectos`), siempre en `es` aunque `locale` sea `en` (D6). El `data-testid="preview-counts"` y el separador « · » no cambian. Verificar: tests de 3.3.
- [ ] 3.3 `PreviewPanel.test.tsx`: con 1/1/1, el texto de `preview-counts` es exactamente «1 experiencia · 1 categoría · 1 proyecto»; con 2/3/0, «2 experiencias · 3 categorías · 0 proyectos»; con `locale="en"` y 1 proyecto, sigue «1 proyecto». Los tests de `ProfileBuilderPage.test.tsx` que buscan «2 experiencias» siguen verdes. Verificar: `npm test -- PreviewPanel ProfileBuilderPage` verde, y el test de 1/1/1 falla si se restituye el plural fijo.

## 4. Otros contadores del panel (opcional, P2 = A)

> Si el owner elige B en P2, este grupo se borra antes de implementar.

- [ ] 4.1 Usar `formatCount` en el badge «{n} visitas» de `ProfileBuilderPage.tsx`, en «{n} visitas» de la fila y del diálogo de borrar de `ProfilesPage.tsx`, en «{n} skills» y su diálogo de `SkillsPage.tsx` («1 skill» / «N skills») y en el `aria-label` de las barras de `DashboardPage.tsx` («{día}: 1 visita»). Verificar: un test por pantalla con la cantidad 1 en los `*.test.tsx` vigentes; `npm test` verde.

## 5. Frontend completo

- [ ] 5.1 `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` y `npm run perf:budget` en `frontend/`. Verificar: todo verde y el arranque público sin cambio apreciable (≤ 155 KB gzip; el helper no entra en el arranque público, solo lo usa el panel); salida en `verification/5.1-frontend.txt`.

## 6. Timeouts en frío (D7)

- [ ] 6.1 Medir antes de cambiar: tres veces, `npm run build` y después `npx vitest run` en un proceso nuevo, sobre el estado del grupo 5. Registrar cada fallo con archivo, test y mensaje literal (`Test timed out in 5000ms` o `Unable to find … within 1000ms` / `Timed out in waitFor`), la duración total y la del primer test de los cuatro archivos señalados. Verificar: `verification/6.1-medicion.md` con la tabla de las tres corridas. Si las tres pasan sin fallos, se anota igual y se sigue con 6.2: la máquina puede estar descargada.
- [ ] 6.2 `frontend/vite.config.ts`, bloque `test`: `testTimeout: 15_000` y `hookTimeout: 30_000`, con un comentario que remite a D7 de este change. Sin tocar `src/test/setup.ts`. Verificar: `git diff --exit-code frontend/src/test/setup.ts` y `npm test` verde.
- [ ] 6.3 Solo si 6.1 registró fallos de `findBy`/`waitFor` en el primer test de un archivo: `frontend/src/test/warm-up.ts` con `warmPublicView()` (y `warmBuilder()` si hace falta) según D7, y un `beforeAll(() => warmPublicView())` en cada archivo afectado. Si no hubo fallos de ese tipo, no se crea el helper y se anota en `verification/6.1-medicion.md`. Verificar: revisión del diff; ningún `beforeAll` nuevo en `setup.ts` ni en `setupFiles`.
- [ ] 6.4 Criterio de aceptación de D7: tres corridas completas, cada una con `npm run build` y después `npx vitest run` en un proceso nuevo, **sin fallos**. Verificar: `verification/6.4-tres-corridas.txt` con el resumen de las tres (archivos, tests, duración).
- [ ] 6.5 Control de que `asyncUtilTimeout` no cambió: un test temporal con `await screen.findByText('no-existe')` falla en torno a 1 s, no a 15 s. Se borra antes del commit. Verificar: duración anotada en `verification/6.4-tres-corridas.txt`.

## 7. Manual y docs (D8)

- [ ] 7.1 Epígrafe de la captura `tc12b-identidad` en `docs/MANUAL.md` y en `docs/manual/index.html`: `2 experiencias · 3 categorías · 1 proyecto`. Sin caso nuevo (no TC-46). Verificar: `npm run manual:check` verde.
- [ ] 7.2 Regenerar `docs/manual/tc12b-identidad.jpg` con `npm run manual:capture` contra la API de ejemplo sobre una base descartable (`MANUAL_CAPTURE_DISPOSABLE_DB=1`, `seed:example`), y borrar la base al terminar. Solo esa imagen entra en el commit. Verificar: la imagen muestra «1 proyecto», `manual:check` verde (topes de tamaño) y `git status` sin otras capturas modificadas.
- [ ] 7.3 `docs/CHANGELOG.md`: entrada con las tres correcciones. Verificar: revisión del diff.

## 8. Cierre

- [ ] 8.1 `npx -y @fission-ai/openspec@1.14.1 validate --all --strict` y `validate polish-views-updated-at-and-builder --strict`, sin avisos «Archive would refuse». Verificar: salida en `verification/8.1-validacion.txt`.
- [ ] 8.2 Completar `verification.md` con la tabla de resultados y abrir el PR (con el `merge-base` revisado si la rama sigue apilada). Verificar: CI verde en el PR (`Backend · e2e…` y `Frontend · lint, tipos, tests y build`); enlace a la corrida en `verification.md`.
- [ ] 8.3 Al archivar: roadmap de `CLAUDE.md` con una línea del change. Si `upgrade-profile-structured-data` todavía no se archivó, avisar en su PR que el arreglo de su P1 lo hizo este change y no `fix-curated-profile-updated-at`; los changes ya archivados no se editan. Verificar: revisión del diff del PR de archivado.
