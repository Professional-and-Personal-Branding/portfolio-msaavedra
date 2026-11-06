# Tasks — add-admin-password-change

> Referencias: `proposal.md`, `design.md` (D1–D12) y los deltas de `specs/` (`admin-authentication`, `api-rate-limiting`, `api-observability`, `admin-backoffice-shell`, `platform-manual`). La evidencia va en `verification/`, como en `add-certification-verification`.
>
> **Rama apilada:** `feat/admin-password-change` sale de `feat/profile-structured-data` (PR #47). Si #47 se fusiona antes, rebasar sobre `main` y abrir el PR contra `main`; si no, el PR va contra `feat/profile-structured-data` y se verifica con `git merge-base` que termine en `main`.
>
> **Orden:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10. Cada grupo de código va en el mismo commit que sus tests. El 9 (docs) puede escribirse en paralelo con el 7, salvo la captura, que necesita el 8.
>
> **Bases:**
> - `portfolio` (la del owner, `localhost:5434`): **ninguna** tarea le aplica la migración ni le escribe.
> - Los e2e corren contra la base de e2e de siempre (migrada y sembrada), nunca contra `portfolio`.
> - `portfolio_pwd_check`: base descartable **nueva** en el mismo contenedor, para generar la migración (3.1) y para la app real (8), sembrada con el ejemplo; borrada al terminar el 8.
>
> **Credenciales:** toda contraseña de prueba fuera de los tests se genera aleatoria en la misma terminal (`node -e "process.stdout.write(require('crypto').randomBytes(18).toString('base64url'))"` a una variable) y **nunca se imprime** ni se escribe en `verification/`.
>
> Antes de cada comando que escriba en una base, correr `npm run prisma:status` y confirmar el destino. `backend/.env` apunta a `portfolio`: la variable de la terminal tiene que estar definida en la misma sesión.

## 1. Punto de partida

- [x] 1.1 Confirmar en la rama: `AdminUser` sin `sessionVersion`; el JWT trae `sub`, `email`, `name`, `iat` y `exp`; no existe `POST /api/auth/password`; `REDACTED_PATHS` sin `currentPassword`/`newPassword`; `docs/DEPLOY-RAILWAY.md` dice que el panel no tiene pantalla para cambiar la contraseña. Verificar: `npm test`, `npm run test:e2e` y `npm run lint` en `backend/` y `npm test` en `frontend/` verdes antes de tocar nada; conteos en `verification/1.1-punto-de-partida.txt`.

## 2. Dominio (D2, D3, D5, D6)

- [x] 2.1 `domain/entities/admin-user.entity.ts`: `sessionVersion: number` en `AdminUserProps` con su getter y `acceptsSession(sv: number | undefined): boolean` (`undefined` cuenta como `0`; un valor que no es entero ≥ 0 da `false`). Verificar: tests de 2.4.
- [x] 2.2 `domain/services/validate-new-password.ts`: `PASSWORD_MIN = 12`, `PASSWORD_MAX = 256` y `validateNewPassword(newPassword, currentPassword)` → `Result<void, ValidationError>`, contando puntos de código, sin recortar. Verificar: tests de 2.4 y el test de arquitectura (sin Nest ni Prisma en `domain/`).
- [x] 2.3 `domain/errors/`: `InvalidCurrentPasswordError` (motivo `credenciales incorrectas`) y `SessionRevokedError` (motivo `sesión inválida`), ambos `AccessDeniedError`. `AdminUserRepository.changePassword(id, passwordHash, expectedVersion): Promise<AdminUser | null>`. `TokenClaims.sessionVersion: number`. Verificar: `npm run typecheck`.
- [x] 2.4 Tests unitarios: `acceptsSession` con versión 0 y `undefined` (sí), 0 y `1` (no), 3 y `3` (sí), 3 y `-1`, `1.5` o `"3"` (no); `validateNewPassword` rechaza 11 caracteres, 257, y la igual a la actual; acepta 12 y 256; cuenta `"ñ".repeat(12)` y 12 emojis como 12; no recorta (`" " + 11 letras` vale 12). Verificar: `npm test` verde.

## 3. Persistencia y migración (D3, D5, D12)

- [x] 3.1 `backend/prisma/schema.prisma`: `sessionVersion Int @default(0)` en `AdminUser`. Migración `<timestamp>_add_admin_session_version` con `prisma migrate dev --create-only` **contra `portfolio_pwd_check`**, revisada a mano: un solo `ADD COLUMN ... NOT NULL DEFAULT 0`, sin `UPDATE` ni `DROP`. Verificar: el SQL en `verification/3.1-migracion.sql`; `npm run prisma:generate` y `npm run typecheck` verdes; `prisma migrate diff --from-url <portfolio_pwd_check> --to-schema-datamodel prisma/schema.prisma --exit-code` sin diferencias.
- [x] 3.2 `infrastructure/persistence/prisma-admin-user.repository.ts`: `toAdminUserEntity` lee `sessionVersion`; `changePassword` hace `updateMany({ where: { id, sessionVersion: expectedVersion }, data: { passwordHash, sessionVersion: { increment: 1 } } })` y relee; devuelve `null` si `count === 0`. `upsert` no toca la versión. Verificar: test de integración del repositorio en el e2e de 6.1 (versión esperada → actualiza y devuelve `+1`; versión vieja → `null` sin cambios).

## 4. Aplicación y token (D3, D4, D5)

- [x] 4.1 `JwtTokenSigner` firma `sv` además de `email` y `name`; `LoginUseCase` pasa `admin.sessionVersion`. Verificar: `auth.use-cases.spec.ts` (el firmante simulado recibe `sessionVersion`) y un test del firmante que decodifica `sv`.
- [x] 4.2 `GetCurrentAdminUseCase.execute({ id, sessionVersion })` → `SessionRevokedError` si no existe o `!acceptsSession`; devuelve `AuthenticatedAdmin { id, email, name, sessionVersion }` (en `application/dto/auth.output.ts`). Verificar: tests con repositorio simulado: versión igual, distinta, `undefined` con 0 y administrador inexistente.
- [x] 4.3 `ChangeAdminPasswordUseCase` (D5) en `application/use-cases/`, registrado en `auth.module.ts`. Verificar: `change-admin-password.use-case.spec.ts` con repositorio, hasher y firmante simulados: (a) éxito → `changePassword` con el hash nuevo y la versión esperada, firma con la versión `+1`, devuelve `LoginOutput`; (b) versión distinta → `SessionRevokedError` sin llamar a `verify`; (c) actual incorrecta → `InvalidCurrentPasswordError` sin `hash` ni `changePassword`; (d) nueva corta o igual → `ValidationError` sin `hash` ni `changePassword`; (e) `changePassword` devuelve `null` → `SessionRevokedError` sin firmar; (f) no llama a `touchLastLogin`.
- [x] 4.4 `JwtStrategy.validate` y `JwtAdminSessionVerifier.isAdminSession` pasan `payload.sv`; el `@CurrentAdmin()` de `me` mapea a `{ id, email, name }`. Verificar: `jwt.strategy.spec.ts` y `jwt-admin-session-verifier.spec.ts` ampliados (`sv` distinto → 401 / `false`; sin `sv` con versión 0 → válido).

## 5. Controller, límite y redacción (D1, D6, D7, D8, D9)

- [x] 5.1 `infrastructure/controllers/dto/change-password.dto.ts` (D2) y `POST /api/auth/password` en `AuthController`: `@HttpCode(200)`, `@UseGuards(JwtAuthGuard, PasswordChangeRateLimitGuard)`, emite la cookie con `buildSessionCookieOptions` y devuelve `LoginOutput`; Swagger con `LoginResponse`, 400, 401 y 429. Verificar: `npm run typecheck` y los e2e de 6.
- [x] 5.2 Extraer la ventana del límite a una clase común (`credential-attempt-limiter.ts`) y crear `PasswordChangeRateLimitGuard` con contador propio y el mensaje de D8; `LoginRateLimitGuard` la usa sin cambiar su comportamiento. Verificar: `login-rate-limit.guard.spec.ts` sigue verde sin cambios de expectativas; `password-change-rate-limit.guard.spec.ts` nuevo (sexto intento → 429 con `Retry-After`; contadores de login y cambio independientes).
- [x] 5.3 `logger.options.ts`: `req.body.currentPassword`, `req.body.newPassword`, `currentPassword` y `newPassword` en `REDACTED_PATHS`. Verificar: `logger-redaction.spec.ts` ampliado (un objeto con los dos campos sale `[Redacted]`).

## 6. E2e (`backend/test/admin-password.e2e-spec.ts`)

> Usa un administrador **propio** (email `password-e2e@example.com`, contraseña generada en el test) creado en `beforeAll` y borrado en `afterAll`, para no revocar la sesión de `E2E_ADMIN` que usan los demás archivos. Cada bloque que agota el límite levanta su propia app (`createTestApp`) para tener el contador limpio.

- [x] 6.1 Flujo completo e invalidación: login A (cookie) y login B (Bearer); A cambia la contraseña → 200 con `Set-Cookie` y `accessToken` nuevos; `GET /api/auth/me` con la cookie vieja de A → 401, con la cookie nueva → 200 sin `sessionVersion`; B con su Bearer viejo en `GET /api/admin/experiences` → 401; login con la vieja → 401, con la nueva → 200; `sessionVersion` en la base pasó de 0 a 1; un JWT firmado a mano sin `sv` → 401 tras el cambio y 200 en un administrador con versión 0. Verificar: `npm run test:e2e` verde.
- [x] 6.2 Errores: actual incorrecta → 401 sin `Set-Cookie` y sin cambios en la base; nueva de 11 → 400; nueva igual a la actual → 400 y versión sin cambios; sin sesión → 401; campo desconocido → 400. Verificar: `npm run test:e2e` verde.
- [x] 6.3 Límite: 5 intentos con la actual incorrecta → 401 y el sexto → 429 con `Retry-After`; 6 anónimos → 401 y luego uno válido → 200; agotar el login y después cambiar → 200. Verificar: `npm run test:e2e` verde.
- [x] 6.4 Visitas y logs: con la cookie revocada, una visita a `GET /api/curated-profiles/all` no queda `OWNER` (como `view-kind.e2e-spec.ts`); un logger capturado durante 6.1 y 6.2 no contiene ninguna de las contraseñas ni los JWT. Verificar: `npm run test:e2e` verde; salida completa del archivo en `verification/6-e2e.txt`.
- [x] 6.5 `scripts/bootstrap-admin.ts` (D10): el `update` suma `sessionVersion: { increment: 1 }`. Verificar: test del script o e2e que corre la función de upsert dos veces y comprueba la versión `+1` y que un token emitido antes recibe 401.

## 7. Contrato y panel (D11)

- [x] 7.1 `npm run openapi:export` y, en `frontend/`, `npm run api:types`: aparece `POST /api/auth/password` con `ChangePasswordDto` y respuesta `LoginResponse`; `AdminResponse` no cambia. Verificar: el test de deriva del frontend verde y `git diff --exit-code` tras un segundo export.
- [x] 7.2 `features/backoffice/account/password-form.ts`: schema Zod con las reglas y los mensajes literales de D11 (puntos de código, igual a la repetición, distinta de la actual). Verificar: `password-form.spec.ts` (11 → «Usá al menos 12 caracteres»; 257 → «Usá como máximo 256 caracteres»; repetición distinta → «Las contraseñas no coinciden»; igual a la actual → «La nueva contraseña tiene que ser distinta de la actual»; vacía → «Escribí tu contraseña actual»; 12 emojis válida).
- [x] 7.3 `useChangePassword()` en `auth/use-session.ts`, `account/AccountPage.tsx` (RHF + `zodResolver`, campos con `autocomplete` de D11, mensajes de la API por status), ruta `cuenta` en `BackofficeApp.tsx` y botón **Cuenta** (`UserCog`) en `AdminLayout`. Verificar: `AccountPage.test.tsx` con la API simulada: éxito → toast literal, campos vacíos, sin navegación; 401 con `/me` 200 → «La contraseña actual no es correcta»; 401 con `/me` 401 → va a `/admin/login`; 429 → mensaje literal; 400 → «La API rechazó la contraseña nueva. Revisá las reglas.»; repetición distinta no llama a la API; `localStorage` y `sessionStorage` vacíos tras el éxito; el botón **Cuenta** de la barra lleva a `/admin/cuenta`.
- [x] 7.4 `npm run lint`, `npm run typecheck`, `npm run build` y `npm run perf:budget` en `frontend/`: el código va en el chunk del panel y el arranque público no cambia. Verificar: tamaño del arranque en `verification/7.4-perf-budget.txt` (igual al de 1.1).

## 8. App real

- [x] 8.1 Sobre `portfolio_pwd_check` migrada y sembrada con el ejemplo: API de la rama y la imagen de `frontend/Dockerfile`; administrador creado con `admin:bootstrap` y una contraseña aleatoria de la terminal (ver § Credenciales). Verificar: `npm run prisma:status` contra esa base antes de escribir; nota en `verification/8.1-entorno.txt` sin credenciales.
- [x] 8.2 TC-45 completo según `verification.md`: pasos de la API por `fetch`/`curl` con dos frascos de cookies y pasos del panel en Chrome. Verificar: transcripción de status y cabeceras (con `Set-Cookie` y tokens redactados) en `verification/8.2-tc45.txt`; ningún valor de contraseña en el archivo (`grep` de las variables → 0). **Nota:** los pasos del panel que escriben contraseñas reales no se tipearon en el navegador; el caso queda en 🔍 (ver `verification.md`).
- [x] 8.3 `npm run a11y:check` sobre la pantalla Cuenta (con `A11Y_CHECK_DISPOSABLE_DB=1` y las credenciales de la terminal; sumar `/admin/cuenta` a las rutas del panel del script si no las recorre todas). Verificar: 0 violaciones; salida en `verification/8.3-a11y.txt`.
- [x] 8.4 Logs de la API durante 8.2: buscar los valores de las dos contraseñas (desde las variables, sin imprimirlos) → 0 coincidencias. Verificar: el conteo en `verification/8.2-tc45.txt`.

## 9. Docs

- [x] 9.1 `docs/MANUAL.md` e `index.html`: **TC-45** (texto de `verification.md`) en la sección 3 y en la tabla de la suite (§ 6); pantalla **B14 — Cuenta** con la tabla de campos y la columna *Mensaje* de D11; B1 y § 0 *Sesión para los `curl`* aclaran que tras un cambio de contraseña el `TOKEN` viejo da 401; glosario: *Versión de sesión*. Verificar: `npm run manual:check` verde.
- [x] 9.2 Captura `bo-cuenta.jpg` (formulario con «Las contraseñas no coinciden», sin enviar nada) agregada al manifiesto de `capture-manual.mjs` y generada con `manual:capture` sobre la base de ejemplo. Verificar: `manual:check` (inventario y tope de 150 KB) verde.
- [x] 9.3 `docs/DEPLOY.md` § 3 y `docs/DEPLOY-RAILWAY.md` (paso 1 y paso 4): la rotación de rutina va por **Cuenta** en el panel; `admin:bootstrap` queda como recuperación y cierra todas las sesiones. Verificar: `grep -n "No hay pantalla\|no tiene pantalla" docs/` sin resultados.
- [x] 9.4 `docs/CHANGELOG.md`: entrada del change (endpoint, `sessionVersion`, pantalla Cuenta, migración aditiva). Verificar: diff revisado.
- [ ] 9.5 Al archivar: la línea del roadmap en `CLAUDE.md` (`add-admin-password-change` — cambio de contraseña desde **Cuenta**, `sessionVersion` en el JWT que revoca las demás sesiones, límite propio y `admin:bootstrap` como recuperación) y, en *Decisiones tomadas* (Backoffice), que el guard compara `sv`. Verificar: diff revisado en el PR de archivado.

## 10. Cierre

- [x] 10.1 Todo verde: `npm test`, `npm run test:e2e`, `npm run lint` y `npm run typecheck` en `backend/`; `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run perf:budget` y `npm run manual:check` en `frontend/`. Verificar: conteos en `verification/10.1-cierre.txt`.
- [x] 10.2 `npx -y @fission-ai/openspec@1.14.1 validate --all --strict` sin fallos nuevos y sin avisos «Archive would refuse» para este change. Verificar: salida en `verification/10.2-validacion.txt`.
- [ ] 10.3 Borrar `portfolio_pwd_check` y confirmar que `portfolio` no tiene la migración (`prisma migrate status` contra ella muestra la migración pendiente). Verificar: `verification/10.3-base-del-owner.txt`. **Nota:** bases descartables borradas; la consulta a `portfolio` no se hizo (permiso denegado), la confirma el owner.
