# Tasks — polish-pre-deploy-cleanup

> Bases: siempre descartables (`portfolio_cleanup_check` o similar), nunca `portfolio`. Comandos desde `backend/` o `frontend/` según corresponda.

## 1. Spec y verificación previa

- [x] 1.1 Deltas en `specs/`: `MODIFIED` de *Campos de un repositorio destacado*, *Repositorios destacados en el seed* y *Regiones desplazables alcanzables con teclado* (con todos sus escenarios); `ADDED` en `web-performance`, `web-accessibility` y `platform-manual`. Verificar: `npx -y @fission-ai/openspec@1.14.1 validate polish-pre-deploy-cleanup --strict` sin errores y sin «Archive would refuse».
- [x] 1.2 Confirmar que `main` no trae otra migración posterior a `20261116212530_add_github_code_evidence` ni otro change que toque `FeaturedRepository`. Verificar: `ls backend/prisma/migrations` y `ls openspec/changes`.

## 2. Columna `stars` (D1, D3, D4)

- [x] 2.1 Sacar `stars` del modelo `FeaturedRepository` en `backend/prisma/schema.prisma` (sin tocar `RepositoryEvidence.stars`). Verificar: `npm run prisma:generate` y `npm run typecheck` en verde.
- [x] 2.2 Crear la migración con `npx prisma migrate dev --create-only --name retire_featured_repository_stars` contra una base descartable y dejar el SQL exactamente como en D1 (comentario y una sola sentencia). Verificar: el archivo solo contiene `ALTER TABLE "FeaturedRepository" DROP COLUMN "stars";` además de los comentarios; `npm run prisma:status` sin deriva.
- [x] 2.3 Escenario «Base con datos»: en una base descartable migrada **hasta** `add_github_code_evidence`, insertar dos repositorios (uno con `stars = 7`) con evidencia, guardar `GET /api/featured-repositories`, aplicar la migración y repetir la petición. Verificar: la migración termina con 0, las dos respuestas son iguales y `\d "FeaturedRepository"` no lista `stars`. Salida en `verification/2.3-migracion.txt`.
- [x] 2.4 `seed-source.ts`: sale `stars?` de `SeedFeaturedRepository` y la validación de tipo. `seed-runner.ts`: el comentario «`stars` se ignora» se actualiza. Comentarios de `featured-repository.prisma-mapper.ts` sin la mención a la columna inerte. Verificar: `grep -rn "stars" backend/scripts` solo devuelve el comentario de compatibilidad.
- [x] 2.5 Tests del seed: `seed-source.spec.ts` (acepta `stars: 12` y `stars: "muchas"` sin errores) y `seed-runner.spec.ts` (los repositorios se crean sin `stars`). Verificar: `npm run test -- seed` en verde.
- [x] 2.6 Contrato sin cambios. Verificar: `npm run openapi:export` y `git diff --exit-code backend/openapi.json`; en `frontend`, `npm run api:types` y `git diff --exit-code src/shared/types/api.d.ts`.
- [x] 2.7 Suite completa. Verificar: `npm run lint`, `npm run test` y `npm run test:e2e` (base local migrada y sembrada) en verde, incluidos `featured-repositories.e2e-spec.ts` (400 por `stars`) y `github-code-evidence.e2e-spec.ts`; `npm run seed` + `npm run seed:verify` y `SEED_DISPOSABLE_DB=1 npm run seed:example` + `npm run seed:example:verify` con código 0.

## 3. Caddy (D5, D6)

- [x] 3.1 `frontend/Caddyfile`: `header @noCache ?Cache-Control "no-cache"` y comentario que explique el `?` y por qué `/api/*` no se excluye. Verificar: el diff toca solo esa regla y su comentario.
- [x] 3.2 Sintaxis con la imagen fijada. Verificar: `docker run --rm -v "$PWD/frontend/Caddyfile:/etc/caddy/Caddyfile:ro" -e PORT=8080 -e API_ORIGIN=http://localhost:3300 caddy:2.11.4-alpine caddy validate --config /etc/caddy/Caddyfile` termina con 0, y `caddy adapt` muestra el handler `headers` con `require`/`deferred` para `Cache-Control`.
- [x] 3.3 Test de Vitest (junto a `src/themes/fonts.spec.ts` o en un `caddyfile.spec.ts` nuevo) que lee `frontend/Caddyfile` y exige `?Cache-Control "no-cache"` en la regla `@noCache` y ninguna `header @noCache Cache-Control` sin prefijo. Verificar: `npm run test` en verde y el test falla si se quita el `?`.
- [x] 3.4 Verificación local contra la imagen: `docker build -t portfolio-web:cleanup frontend` y `docker run -d --name web-cleanup -p 8156:8080 -e PORT=8080 -e API_ORIGIN=http://host.docker.internal:3356 portfolio-web:cleanup`, con la API de la rama en `3356` sobre una base descartable sembrada con el ejemplo. Para cada URL, `curl -sS -D - -o /dev/null <url> | grep -ci '^cache-control:'` da `1` y el valor es el esperado: `/` y `/profile-prefetch.js` → `no-cache`; un `/assets/*.js` → `public, max-age=31536000, immutable`; `/api/curated-profiles/all` → `no-cache`; `/api/curated-profiles/ejemplo-protegido/resume.json?token=ejemplo-token-2026` → `private, no-store`; `/api/admin/consistency` con la cookie de `POST /api/auth/login` → `no-store`. Salida en `verification/3.4-cabeceras.txt`, con el mismo conteo hecho antes del cambio (dos líneas en las rutas con política propia).
- [x] 3.5 (corrida local del bloque, pasa con el Caddyfile nuevo y falla con el anterior; el job `web-quality` en verde se confirma en el PR) CI: en `.github/workflows/ci.yml`, paso «Frontend · Caddy con la imagen de producción», bloque que cuenta las cabeceras de las cinco URLs de D6 y sale con 1 ante un conteo distinto de 1 o un valor inesperado (el asset se toma del primer `src="/assets/…js"` de `/`). Verificar: el job `web-quality` en verde en el PR, y en una corrida local del bloque con el `Caddyfile` anterior falla.

## 4. Tablas del Dashboard (D7)

- [x] 4.1 `frontend/src/shared/components/ui/table.tsx`: prop opcional `regionLabel`; con ella, el contenedor lleva `role="region"`, `aria-label` y `tabIndex={0}`. Verificar: `npm run typecheck`.
- [x] 4.2 `DashboardPage.tsx`: `ShareLinkTable` con `regionLabel="Visitas por enlace"` y `SourceTable` con `regionLabel="Visitas por portal"`. Verificar: test del Dashboard con `byShareLink` y `bySource` no vacíos: `getByRole('region', { name: 'Visitas por enlace' })` y `{ name: 'Visitas por portal' }` con `tabIndex` 0; con listas vacías, ninguna de las dos regiones.
- [x] 4.3 Test de `Table` sin `regionLabel` (o el de Postulaciones): el contenedor no tiene `role`, `aria-label` ni `tabIndex`. Verificar: `npm run test` en verde.
- [x] 4.4 Verificar: `npm run lint`, `npm run build` y `npm run perf:budget` (el panel es otro chunk; el arranque público no cambia).

## 5. `a11y:check` con las tablas llenas (D8)

- [x] 5.1 `frontend/scripts/check-a11y.mjs`: `seedShareLinkVisits(session, home)` con el perfil `all`: enlace idempotente «Auditoría a11y — enlace de seguimiento con etiqueta larga para el móvil» (portal `linkedin`), dos `GET /api/curated-profiles/all?via=<código>` y uno `?src=portal-de-empleo-ejemplo` desde Node con un User-Agent de Chrome de escritorio y sin cookies, y espera (hasta 5 s) a ver filas en `byShareLink` y `bySource`. Cabecera del script al día. Verificar: `node --check scripts/check-a11y.mjs`.
- [x] 5.2 Entrada `admin-dashboard-tablas` (`/admin`) en `ERROR_ENTRIES` o un mapa equivalente, con `prepare` que exige filas en las dos tablas y, en móvil, `scrollWidth > clientWidth` en el contenedor de **Por enlace**. Verificar: con `A11Y_CHECK_DISPOSABLE_DB=1` y panel, contra la imagen de 3.4, la entrada sale sin problemas de preparación y sin violaciones en los dos viewports.
- [x] 5.3 Prueba negativa: con el `table.tsx` anterior (sin `regionLabel`), la misma corrida reporta `scrollable-region-focusable` en `admin-dashboard-tablas.mobile` y sale con 1. Verificar: salida en `verification/5.3-a11y-negativo.txt`.
- [x] 5.4 Corrida completa en las dos bases: `npm run a11y:check -- http://localhost:8156 --out reports` con `cv-data.json` y con el ejemplo (`A11Y_CHECK_PROFILE=ejemplo-backend`), con panel. Verificar: código 0 en las dos; segunda corrida sobre la misma base sin un enlace duplicado (`GET /api/admin/curated-profiles/<id-de-all>/share-links`). Salida en `verification/5.4-a11y.txt`.

## 6. Documentación (D2, D9)

- [x] 6.1 `docs/DEPLOY.md`: sección *Migración `retire_featured_repository_stars` (destructiva)* con la comprobación previa, el respaldo y el rollback por SQL de D2; en § Caddy, la regla de `no-cache` como valor por defecto. Verificar: lectura y enlaces internos.
- [ ] 6.2 (PENDIENTE del owner: la sesión de implementación tiene prohibido tocar la base `portfolio`; ya se sabe que el conteo da 0) Aplicar la migración en la base local del owner **solo** después de `SELECT count(*) FROM "FeaturedRepository" WHERE "stars" IS NOT NULL;` (y `pg_dump -Fc` si da más de 0). Verificar: conteo y resultado de `npm run prisma:migrate` en `verification/6.2-base-local.txt`.
- [x] 6.3 `docs/DATA-POPULATION.md`: sin la fila `stars` de § 12 y sin la oración de la columna inerte; una línea que diga que una clave `stars` de un archivo viejo se ignora. `docs/ARCHITECTURE.md`: sin «La columna `FeaturedRepository.stars` queda inerte». Verificar: `grep -n "stars" docs/DATA-POPULATION.md docs/ARCHITECTURE.md` solo devuelve menciones a la evidencia y a la compatibilidad.
- [x] 6.4 `docs/MANUAL.md` e `index.html`: TC-53 (pasos, resultado esperado, errores típicos y la fila en la tabla de la suite), oración nueva en B2 *Acciones y avisos*. Ejecutarlo sobre la base de ejemplo descartable después de TC-41 y marcar su estado según lo ejecutado. Verificar: `npm run manual:check` en verde.
- [x] 6.5 `docs/CHANGELOG.md`: entrada del change. Verificar: lectura.

## 7. Cierre

- [x] 7.1 Verificar: `npx -y @fission-ai/openspec@1.14.1 validate --all --strict` sin fallas nuevas (las de requisitos de más de 500 caracteres de specs ya archivadas se informan aparte) y sin «Archive would refuse».
- [x] 7.2 `verification.md` con el índice de evidencias y el estado de TC-53.
