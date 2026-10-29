# Tasks — classify-profile-views

> Referencias: `proposal.md`, `design.md` (D1–D11, P1–P2), `specs/profile-view-analytics/spec.md` y `specs/admin-analytics-dashboard/spec.md`. La evidencia va en `verification/`, como en `protect-default-seed`.
>
> **Orden:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10. Cada grupo de código va en el mismo commit que sus tests. El 9 (docs) puede escribirse en paralelo con el 8, salvo la captura, que necesita el 7.
>
> **Bases:**
> - `portfolio` (la del owner, `portfolio-postgres` en `localhost:5434`): **ninguna** tarea le aplica la migración, le corre `views:reclassify` ni registra visitas en ella. La reclasificación de esa base la hace el owner (design, *Migration Plan* paso 3).
> - Los e2e corren contra la base de e2e de siempre (migrada y sembrada), nunca contra `portfolio`.
> - `portfolio_views_check`: base descartable **nueva** en el mismo contenedor para los grupos 6 y 8, creada al empezar el 6 y borrada al terminar el 8. En PowerShell: `$env:DATABASE_URL = "postgresql://portfolio:portfolio@localhost:5434/portfolio_views_check?schema=public"`.
>
> Antes de cada comando que escriba en una base, correr `npm run prisma:status` y confirmar el destino. `backend/.env` apunta a `portfolio`: la variable de la terminal tiene que estar definida en la misma sesión.

## 1. Punto de partida

- [x] 1.1 Confirmar sobre la rama que `PrismaProfileViewRepository.record` hace `create` + `increment` en una `$transaction`, que `main.ts` aplica `cookieParser()`, que `profile-prefetch.js` usa `credentials: 'include'` y cuáles e2e piden el perfil público sin `User-Agent` y después cuentan `views` o el agregado (lista con archivo y línea). Verificar: `npm test` y `npm run test:e2e` verdes en `backend/` antes de tocar nada; la lista en `verification/1.1-punto-de-partida.txt`.

## 2. Dominio: clasificadores puros (D1, D3)

- [x] 2.1 `backend/src/modules/analytics/domain/view-kind.ts`: tipo `ViewKind = 'HUMAN' | 'OWNER' | 'BOT'` y la constante `VIEW_KINDS` con ese orden. Verificar: `npm run typecheck` y el test de arquitectura (`architecture.spec.ts`) verdes.
- [x] 2.2 `domain/services/classify-user-agent.ts`: `BOT_USER_AGENT_PATTERNS_VERSION = 1`, `BOT_USER_AGENT_PATTERNS` (la tabla de D3, agrupada y comentada por grupo) y `classifyUserAgent`. UA ausente, vacío o solo espacios → `BOT`. Verificar: tests de 2.4.
- [x] 2.3 `domain/services/classify-visit.ts`: `classifyVisit({ adminSession, userAgent })` con la precedencia OWNER > BOT > HUMAN. Verificar: tests de 2.4.
- [x] 2.4 Tests unitarios (`classify-user-agent.spec.ts`, `classify-visit.spec.ts`):
  - Un UA real por cada token de la lista (tabla parametrizada) → `BOT`.
  - Chrome, Firefox y Safari de escritorio; Chrome Android y Safari iOS → `HUMAN`.
  - `TestUA`, `example-seed`, `BackgroundViewsE2E`, un Android Cubot y un UA con `robot` dentro de una palabra → `HUMAN`.
  - `undefined`, `''` y `'   '` → `BOT`; mayúsculas mezcladas (`HEADLESSCHROME`) → `BOT`.
  - Un test que compara el `sha256` de la lista con el registrado para la versión 1, con un mensaje que pide subir la versión.
  - `classifyVisit`: las seis combinaciones de sesión (sí/no) × UA (navegador, bot, vacío).

  Verificar: `npm test` verde, y que el test del hash falla si se agrega un token sin cambiar la versión (probarlo y revertir).

## 3. Persistencia y migración (D1, D4, D6, D7)

- [x] 3.1 `backend/prisma/schema.prisma`: `enum ViewKind { HUMAN OWNER BOT }` y `kind ViewKind @default(HUMAN)` en `ProfileView`, con un comentario que remita a este change. Migración nueva `<timestamp>_classify_profile_views` generada con `prisma migrate dev --create-only` **contra una base descartable** (no `portfolio`), revisada a mano: solo `CREATE TYPE` y `ALTER TABLE … ADD COLUMN … NOT NULL DEFAULT 'HUMAN'`, sin `UPDATE`. Verificar: el SQL en `verification/3.1-migracion.sql`, y `npm run prisma:generate` + `npm run typecheck` verdes.
- [x] 3.2 `domain/repositories/profile-view.repository.ts`: `kind: ViewKind` obligatorio en `NewProfileView`; `aggregate` y `countByReferrer` documentan que cuentan solo `HUMAN`; nuevo `countByKind(range): Promise<{ kind: ViewKind; views: number }[]>`. Verificar: `npm run typecheck`.
- [x] 3.3 `infrastructure/persistence/prisma-profile-view.repository.ts`:
  - `record`: crea con `kind`; la `$transaction` incluye el `increment` solo si `kind === 'HUMAN'`.
  - `aggregate` (los dos `groupBy`, el `count` y el `$queryRaw` por día) y `countByReferrer` filtran `kind = 'HUMAN'`.
  - `countByKind` agrupa por `kind` todas las filas del rango.

  Verificar: e2e de 4.6 y 5.4.

## 4. Sesión y registro de la visita (D2, D6)

- [x] 4.1 `backend/src/shared/application/admin-session-verifier.ts`: `ADMIN_SESSION_VERIFIER` y `AdminSessionVerifier { isAdminSession(token: string): Promise<boolean> }`, sin imports de Nest ni Prisma. Verificar: test de arquitectura verde.
- [x] 4.2 `modules/auth/infrastructure/security/`:
  - `extractAdminToken(req)`: `ExtractJwt.fromAuthHeaderAsBearerToken()` y, si no, `extractJwtFromSessionCookie`, el mismo orden que `JwtStrategy`. `JwtStrategy` pasa a usarlo, para que no puedan divergir.
  - `JwtAdminSessionVerifier`: `JwtService.verifyAsync(token, { algorithms: ['HS256'] })` + `GetCurrentAdminUseCase`; cualquier error → `false`, sin loguear el token.
  - `AuthModule` lo provee bajo `ADMIN_SESSION_VERIFIER` y lo exporta.

  Verificar: tests unitarios del verificador (token válido, vencido, firmado con otro secreto, `alg: none`, `sub` de un administrador inexistente, error del caso de uso) y del extractor (solo header, solo cookie, los dos: gana el header, ninguno); `jwt.strategy.spec.ts` sigue verde.
- [x] 4.3 Ajustar los e2e listados en 1.1 que piden el perfil sin `User-Agent` y esperan `views + 1` o crecimiento del agregado: mandan un UA de navegador desde una constante compartida en `test/e2e-helpers.ts` (`BROWSER_UA`). Los que solo cuentan filas no cambian. Verificar: revisión del diff y el grupo verde al terminar 4.6.
- [x] 4.4 `ResolveCuratedProfileUseCase` y `ViewContext`:
  - `ViewContext` suma `sessionToken?: string`.
  - Inyecta `ADMIN_SESSION_VERIFIER`. `recordView`, dentro de la tarea, resuelve `adminSession` (sin token → `false`; rechazo → `false` con un `warn` que no incluye el token), clasifica con `classifyVisit` y llama a `record` con `kind`.
  - El controller público agrega `sessionToken: extractAdminToken(req) ?? undefined` y no valida nada. `CuratedProfileModule` importa `AuthModule`.

  Verificar: tests de 4.5.
- [x] 4.5 Tests unitarios del caso de uso (con `FakeBackgroundTasks` y repositorios simulados):
  - Sin token y UA de navegador → `record` con `HUMAN`; sin token y UA de bot → `BOT`; token válido → `OWNER` aunque el UA sea de bot.
  - `execute()` resuelve antes de que el verificador responda (promesa pendiente) y con el mismo resultado que sin token.
  - El verificador rechaza → `record` con la clasificación por UA, un `warn` sin el token y ningún rechazo sin manejar.
  - Sin `viewContext` no se llama ni al verificador ni a `record`.

  Verificar: `npm test` verde.
- [x] 4.6 E2e de registro (`admin.e2e-spec.ts` o un archivo nuevo `view-kind.e2e-spec.ts`), siempre con `settleBackgroundTasks(app)` antes de leer:
  - Con la cookie de `loginCookie(...)` → 200, fila `OWNER`, `views` igual.
  - Con `Authorization: Bearer` de admin → fila `OWNER`.
  - Con una cookie vencida y con una firmada con otro secreto (generadas en el test con `jsonwebtoken`/`JwtService`) y UA de navegador → 200, mismo cuerpo que sin cookie, fila `HUMAN`, `views` +1.
  - Con UA `Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) … (compatible; Googlebot/2.1; +http://www.google.com/bot.html)` y con uno de `HeadlessChrome` → fila `BOT`, `views` igual.
  - Sin `User-Agent` → fila `BOT`.
  - Con `User-Agent: TestUA` → fila `HUMAN` y `views` +1 (escenario *Visita registrada*).
  - Ninguna columna de la fila `OWNER` contiene el token.

  Verificar: `npm run test:e2e` verde; salida en `verification/4.6-e2e.txt`.

## 5. Agregado y contrato (D7, D9)

- [x] 5.1 `AggregateProfileViewsUseCase`: pide `countByKind` en el mismo `Promise.all` y devuelve `byKind` con los tres tipos en el orden de `VIEW_KINDS`, completando con 0. Verificar: tests unitarios (rango vacío → tres ceros; solo `BOT` → `total` 0 y `byKind` con el `BOT`; orden fijo aunque el repositorio devuelva otro).
- [x] 5.2 `admin-analytics.controller.ts`: `CountByKind` con `kind` como enum (`enumName: 'ViewKind'`), `byKind` en `ProfileViewsResponse`, descripciones de `total`, `byProfile` y `byReferrer` que dicen «solo visitas de personas (`HUMAN`)» y la descripción de la operación actualizada. Verificar: `npm run openapi:export` y diff de `backend/openapi.json` con solo esos cambios.
- [x] 5.3 `frontend`: `npm run api:types`. Verificar: diff de `src/shared/types/api.d.ts` y el test de deriva del contrato verde.
- [x] 5.4 E2e del agregado: en una ventana de tiempo propia del test (`from`/`to` con instantes), 2 visitas con UA de navegador, 1 con la cookie de admin y 1 con UA de Googlebot → `total` 2, suma de `byProfile` 2, suma de `byReferrer` 2 y `byKind` exactamente `[HUMAN 2, OWNER 1, BOT 1]`. El test vigente *agrega por perfil, idioma y día* manda `BROWSER_UA`. Verificar: `npm run test:e2e` verde; salida en `verification/5.4-agregado.txt`.

## 6. Reclasificación (D4, D5)

- [x] 6.1 `backend/scripts/lib/reclassify-views.ts`: `planReclassification(rows, profiles)` puro (filas esperadas por tipo, cambios `HUMAN↔BOT`, `views` esperado por perfil, `OWNER` intactas), `formatReclassificationReport(plan, target, version)` y `applyReclassification(prisma, plan)` (una `$transaction`, `updateMany` por lotes de `id` y un `update` de `views` por perfil con diferencias). `backend/scripts/reclassify-views.ts`: parseo de `--apply` (otro argumento → código 1), destino sin credenciales, lectura en lotes, informe, y el `pg_dump` sugerido antes de `--apply` (reutilizando `describePgDumpCommand` de `seed-guard.ts`). `backend/package.json`: `"views:reclassify": "tsx scripts/reclassify-views.ts"`. Verificar: tests de 6.2.
- [x] 6.2 `backend/test/reclassify-views.spec.ts` (sin base): el escenario *Reclasificar bots viejos* (5 `HUMAN`, 2 `HeadlessChrome` → 2 `BOT`, `views` 3); `OWNER` con UA de navegador intacta; una fila `BOT` cuyo UA ya no está en la lista vuelve a `HUMAN`; un plan sobre datos ya reclasificados no tiene cambios (idempotencia); el informe completo para una entrada fija; argumento desconocido → código 1; el informe no contiene la contraseña de la URL. Verificar: `npm test` verde.
- [x] 6.3 Corrida sobre `portfolio_views_check`, creada con `createdb` y llevada a la versión de `main` **sin** la migración nueva (`prisma:deploy` y `seed:example` con `SEED_DISPOSABLE_DB=1` desde un worktree de `main`): insertar por SQL 3 filas con UA `HeadlessChrome`, 1 sin UA y 1 con UA de Chrome en `ejemplo-backend` y sumar 5 a su `views`; aplicar la migración nueva con `prisma:deploy` desde esta rama (todas `HUMAN`, conteos y `views` iguales: escenario *Filas previas a la migración*); `views:reclassify` sin `--apply` (informa 4 → `BOT`, `views` −4, la base no cambia); con `--apply`; y otra vez con `--apply` (sin cambios). Las 105 sintéticas siguen `HUMAN`. Verificar: `npm run prisma:status` mostrando `portfolio_views_check` y las tres salidas en `verification/6.3-reclasificacion.txt`.

## 7. Dashboard (D8)

- [x] 7.1 `frontend/src/features/backoffice/dashboard/DashboardPage.tsx`: tabla **Por tipo** después de **Por origen** (`<h2 id="por-tipo">`), filas *Personas*, *Tus visitas* y *Bots* desde `byKind` con un mapeo exhaustivo sobre `ViewKind`, la línea explicativa de D8 y la descripción nueva de la página. Con `total: 0` y algún tipo > 0: estado vacío y debajo **Por tipo**; con los tres en cero, solo el estado vacío. Verificar: tests de 7.2.
- [x] 7.2 `DashboardPage.test.tsx`: los escenarios *Los tres tipos* (orden y conteos), *Sin ninguna visita* (sin tabla con ceros), *Solo visitas propias o de bots* (estado vacío + tabla) y *El rango se aplica* (la petición con el rango nuevo recalcula **Por tipo**). Verificar: `npm run test`, `npm run lint` y `npm run typecheck` verdes en `frontend/`.

## 8. Verificación en la app real (D10, D11)

- [x] 8.1 UA de los scripts de calidad: con la API apuntando a `portfolio_views_check` (puerto 3310) y la imagen o el dev server del frontend, correr `print:check` (`PRINT_CHECK_DISPOSABLE_DB=1`), un perfil de `a11y:check` y de `perf:check` (`A11Y_CHECK_DISPOSABLE_DB=1`, `PERF_CHECK_RUNS=1`) y leer por SQL el `userAgent` y el `kind` de las filas nuevas. Si alguna quedó `HUMAN`, aplicar el token `PortfolioCheck` de D10 a ese script y repetir. Verificar: la tabla UA → `kind` por script en `verification/8.1-ua-scripts.txt`, todas `BOT` (u `OWNER` si `a11y:check` recorrió con la sesión).
- [x] 8.2 Recorrido de D11 en el navegador: con sesión en `/admin`, abrir `/` (fila `OWNER`); en una ventana privada, `/` y `/ejemplo-backend` (una fila `HUMAN` por carga, `views` +1); `curl` con UA de Googlebot y sin UA (filas `BOT`); el dashboard con 30 días muestra 105 + 2 personas en el total y **Por tipo** con *Tus visitas* ≥ 1 y *Bots* ≥ 2. Verificar: consultas SQL y captura del dashboard en `verification/8.2-app-real/`; al terminar, `dropdb portfolio_views_check`.

## 9. Documentación y manual

- [x] 9.1 `docs/MANUAL.md`: **TC-39 — Las visitas propias y de bots no suman** (precondición: base de ejemplo; pasos: abrir un perfil con la sesión del panel, en una ventana privada y con `curl` y UA de bot; resultado: el total de personas sube solo con la ventana privada, **Por tipo** muestra las tres filas y la columna de visitas de `/admin/perfiles` coincide con las de personas). Actualizar el concepto de visita (§ conceptos, «Cada carga de una ruta pública registra una visita…»), el recorrido del dashboard (totales y **Por tipo**), **B2 — Dashboard** (tabla nueva, línea explicativa, estado vacío con visitas propias o de bots), la tabla de la suite (§ 6) y el glosario (*tipo de visita*). Sin citar el número de bots. Verificar: revisión del diff.
- [x] 9.2 `docs/manual/index.html`: el mismo TC-39 (`<article class="case" id="tc39">`, índice lateral y lede de la sección), B2 y el concepto, alineados con el Markdown. Regenerar `tc18-dashboard.jpg` con `npm run manual:capture -- <base>` contra la API de ejemplo (`MANUAL_CAPTURE_DISPOSABLE_DB=1`). Verificar: `npm run manual:check` verde (ids, títulos, estados, imágenes y topes de tamaño); salida en `verification/9.2-manual-check.txt`.
- [x] 9.3 `CLAUDE.md`: el paso 6 del núcleo dice que la visita se guarda con su `kind` y que `views` suma solo `HUMAN`; el comando `npm run views:reclassify` en la lista de comandos; la entrada del change en el roadmap al archivar. `backend/README.md` (comando), `docs/DEPLOY.md` § 7 y `docs/DEPLOY-RAILWAY.md` (cuándo correr la reclasificación en producción, primero sin `--apply`), `docs/DATA-POPULATION.md` si menciona el contador de visitas, y `docs/CHANGELOG.md`. Verificar: `Select-String` de `views:reclassify` en esos archivos y revisión del diff.

## 10. Cierre

- [x] 10.1 Backend: `npm run lint`, `npm run typecheck`, `npm test` y `npm run test:e2e`; frontend: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run perf:budget` y `npm run manual:check`. Verificar: salidas en `verification/10.1-cierre.txt`, todo verde.
- [x] 10.2 `npx -y @fission-ai/openspec@1.14.1 validate classify-profile-views --strict` y `validate --all --strict`, sin avisos *Archive would refuse* para este change; las fallas de specs ya archivadas por requisitos de más de 500 caracteres, si siguen, se reportan aparte sin tocarlas. Verificar: salida en `verification/10.2-validacion.txt`.
- [x] 10.3 Confirmar que ninguna tarea tocó la base `portfolio` (`prisma:status` del owner sin la migración nueva aplicada por este trabajo, salvo que él la haya corrido) y dejar en el PR las instrucciones del *Migration Plan* paso 3 para el owner. Verificar: nota en `verification/10.3-base-del-owner.txt`.
