# Verificación — classify-profile-views

Ejecutada el 28 de octubre de 2026 sobre la rama `feat/classify-profile-views` (cortada de `main` en `f833bbf`). Evidencia cruda en `verification/`. Todas las escrituras fueron contra bases descartables del mismo contenedor (`portfolio_views_e2e` para los e2e y `portfolio_views_check` para la app real); la base `portfolio` del owner no se tocó (`verification/10.3-base-del-owner.txt`).

## Resultado por tarea

| Tarea | Resultado | Evidencia |
|---|---|---|
| 1.1 Punto de partida | `npm test` 81 suites / 660 tests y `npm run test:e2e` 10 suites / 174 tests verdes antes de tocar nada; lista de los e2e que piden el perfil sin `User-Agent` | `verification/1.1-punto-de-partida.txt` |
| 2.1–2.4 Clasificadores | `classifyUserAgent` (lista v1, 51 tokens) y `classifyVisit`; un UA real por token, navegadores reales, falsos positivos y hash de la lista. El test del hash falla si se agrega un token sin subir la versión (probado con un token de prueba y revertido) | `classify-user-agent.spec.ts`, `classify-visit.spec.ts` |
| 3.1 Esquema y migración | `20261029021458_classify_profile_views`: solo `CREATE TYPE` y `ADD COLUMN … DEFAULT 'HUMAN'`, sin `UPDATE`. `prisma migrate diff --from-migrations --to-schema-datamodel --exit-code` sin diferencias | `verification/3.1-migracion.sql` |
| 3.2–3.3 Repositorio | `kind` obligatorio en `NewProfileView`; `views` solo con `HUMAN`; `aggregate` (incluido el `$queryRaw` por día) y `countByReferrer` solo `HUMAN`; `countByKind` | e2e de 4.6 y 5.4 |
| 4.1–4.2 Sesión | Puerto `ADMIN_SESSION_VERIFIER` en `shared/application`, `JwtAdminSessionVerifier` y `extractAdminToken` (compartido con `JwtStrategy`); tests del verificador (válido, vencido, otro secreto, `alg: none`, basura, sin `sub`, admin inexistente, el caso de uso lanza) y del extractor | `jwt-admin-session-verifier.spec.ts`, `extract-admin-token.spec.ts` |
| 4.3 e2e previos | Los que cuentan visitas de personas mandan `BROWSER_UA` (`test/e2e-helpers.ts`): `admin`, `curated-profile-lifecycle`; `background-views` ajustado al nuevo contrato del repositorio | diff |
| 4.4–4.5 Caso de uso | Clasifica dentro de la tarea; verificador pendiente no demora a `execute()`; verificador que falla → `warn` sin el token y clasificación por UA; sin contexto no se llama a nada | `curated-profile.use-cases.spec.ts` |
| 4.6 e2e de registro | **14 tests en `view-kind.e2e-spec.ts`:** cookie → `OWNER`; Bearer → `OWNER`; sesión gana a `HeadlessChrome`; el token no está en ninguna columna; cookie vencida y cookie forjada → 200 con el mismo cuerpo, `HUMAN`, `views` +1; Googlebot → `BOT`; HeadlessChrome → `BOT`; sin `User-Agent` (header ausente, `userAgent` null) → `BOT`; `TestUA` → `HUMAN`; `views` = filas `HUMAN` | `verification/4.6-e2e.txt` |
| 5.1–5.3 Agregado y contrato | `byKind` con los tres tipos en orden fijo; OpenAPI con `CountByKind` y el enum `ViewKind`; `openapi.json` y `api.d.ts` regenerados (el export es idempotente y `git diff --exit-code` da 0) | tests del caso de uso, `10.1-cierre.txt` |
| 5.4 e2e del agregado | En una ventana propia: 2 `HUMAN` + 1 `OWNER` + 1 `BOT` → `total` 2, sumas de `byProfile`/`byLocale`/`byDay`/`byReferrer` = 2 y `byKind` exactamente `[HUMAN 2, OWNER 1, BOT 1]`; rango sin visitas → tres ceros | `view-kind.e2e-spec.ts` |
| 6.1–6.2 Script | `scripts/lib/reclassify-views.ts` (plan puro, informe, aplicar) y `scripts/reclassify-views.ts`; 11 tests sin base (5 HUMAN con 2 `HeadlessChrome` → 2 `BOT` y `views` 3; `OWNER` intacta; `BOT` que vuelve a `HUMAN`; idempotencia; informe fijo; sin contraseña; `--aplicar` → error de uso) | `test/reclassify-views.spec.ts` |
| 6.3 Base descartable | Ver abajo | `verification/6.3-reclasificacion.txt` |
| 7.1–7.2 Dashboard | Tabla **Por tipo** y descripción nueva; tests de los tres tipos, ceros (sin tabla), solo propias/bots (vacío + tabla) y rango | `DashboardPage.test.tsx` |
| 8.1 UA de los scripts | `print:check` ya era `BOT`; **`a11y:check` mandaba `node` y `perf:check` el UA de Lighthouse sin marca: ambos sumaban como `HUMAN`**. Corregidos con el token `PortfolioCheck` (D10) y repetidos: todas `BOT` | `verification/8.1-ua-scripts.txt` |
| 8.2 App real | Ver abajo | `verification/8.2-app-real/` |
| 9.1–9.3 Docs | TC-39, C8, R9, B2, glosario, `tc18-dashboard.jpg` regenerada (88 KB), `CLAUDE.md`, `backend/README.md`, `DEPLOY.md`, `DEPLOY-RAILWAY.md`, `DATA-POPULATION.md` y `CHANGELOG.md`; `manual:check`: 39 casos alineados, 44 imágenes, `index.html` 214 KB | `10.1-cierre.txt` |
| 10.1 Cierre | Todo en verde (ver abajo) | `verification/10.1-cierre.txt` |
| 10.2 Validación | `validate classify-profile-views --strict` válido; `validate --all --strict`: 38 passed, 0 failed; sin «Archive would refuse» | `verification/10.2-validacion.txt` |
| 10.3 Base del owner | `portfolio` sin la migración nueva y sin la columna `kind` | `verification/10.3-base-del-owner.txt` |

## 6.3 — Reclasificación sobre `portfolio_views_check`

Base creada con `createdb`, llevada a la versión de `main` (`prisma:deploy` antes de existir la migración nueva) y sembrada con `seed:example` (105 filas). Se insertaron por SQL 5 filas en `ejemplo-backend` (3 `HeadlessChrome`, 1 sin UA, 1 Chrome) y se sumó 5 a su `views` (31).

| Paso | Resultado |
|---|---|
| Migración nueva desde esta rama | 110 filas, todas `HUMAN`; filas y `views` de cada perfil iguales (escenario *Filas previas a la migración*) |
| `views:reclassify` sin `--apply` | informa `HUMAN 110 → HUMAN 106 · BOT 4` y `ejemplo-backend: 31 → 27`; la base no cambia |
| `--apply` | `HUMAN 106`, `BOT 4`; `ejemplo-backend` `views` 27; las 105 sintéticas (`example-seed`) siguen `HUMAN` |
| `--apply` otra vez | «Sin cambios: la base ya está reclasificada.» |
| `--aplicar` | error de uso, código 1 |

Se confirma que son **4** las filas que pasan a `BOT` (3 `HeadlessChrome` y 1 sin UA), como anticipaba la tarea.

## 8.2 — App real

API en el 3310 (`NODE_ENV` de desarrollo) y frontend por `vite`/`vite preview`, contra `portfolio_views_check`. Un navegador real abrió `/` y `/ejemplo-backend` (una fila `HUMAN` por carga, `views` +1); la sesión del panel se inició por `POST /api/auth/login` con curl (credenciales aleatorias que no se imprimieron ni se versionan) y su cookie produjo filas `OWNER`; curl con UA de Googlebot, sin UA y con el UA por defecto produjo filas `BOT`; `print:check` produjo 4 filas `BOT` por perfil/idioma. El agregado de la API cerró `total` = filas `HUMAN` y `views` de cada perfil = sus filas `HUMAN`. Con la base de ejemplo regenerada, `manual:capture` produjo el dashboard con **Por tipo** (Personas 105, Tus visitas 0, Bots 0), ya guardado como `docs/manual/tc18-dashboard.jpg`.

## 10.1 — Suites

| Comando | Resultado |
|---|---|
| backend `prisma:generate`, `lint`, `typecheck`, `build` | verdes |
| backend `npm test` | **86 suites, 769 tests** verdes (antes: 81 / 660) |
| backend `openapi:export` + `git diff --exit-code -- openapi.json` | sin diferencias |
| backend `test:e2e` | **11 suites, 188 tests** verdes (antes: 10 / 174), contra `portfolio_views_e2e` migrada y sembrada |
| frontend `lint`, `typecheck`, `build` | verdes |
| frontend `npm test` | **56 archivos, 632 tests** verdes (la deriva de `api.d.ts` incluida) |
| frontend `perf:budget` | 148,9 KB gzip de 155 KB |
| frontend `manual:check` | 39 casos alineados |

## Desvíos y pendientes

- **Sesión del panel en un navegador.** La fila `OWNER` se comprobó con la cookie emitida por el login real vía curl y no tecleando la contraseña en un navegador, como se pidió; el e2e cubre la cookie y el Bearer.
- **`a11y:check` contra los datos de ejemplo** (perfil `ejemplo-backend`) da 12 nodos `color-contrast` serious (`.border-emerald-500/30`); con la siembra por defecto, como el CI, da 0. No viene de este change (no toca el sitio público); queda para revisar aparte.
- **Un test del frontend** falló 3 de 632 en una corrida bajo carga de CPU y pasó en las 4 corridas siguientes; sin detalle conservado. Posible falta de robustez ajena a este change.
- **Reclasificación de la base del owner** (Migration Plan, paso 3): la corre él, primero sin `--apply`; ver `verification/10.3-base-del-owner.txt`.
