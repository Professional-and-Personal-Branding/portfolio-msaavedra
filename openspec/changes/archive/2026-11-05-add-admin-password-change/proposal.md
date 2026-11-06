# add-admin-password-change — Cambiar la contraseña desde el panel e invalidar las demás sesiones

> Change de la **Fase 1.2** de `docs/PROPUESTA-FEATURES.md` (§ 4, ítem **8.1** «Cambio de contraseña y `sessionVersion` en el JWT»; § 6.2, fila `add-admin-password-change`). La ficha pide: «`POST /api/auth/password` tiene throttle. Después del cambio, un JWT anterior recibe 401 (`sessionVersion`)». Respeta las decisiones del owner del 2026-10-28 (§ 9): P1 = A (1.2 sin IA, sin OAuth y sin servicios nuevos). Se apila sobre `feat/profile-structured-data` (PR #47, `upgrade-profile-structured-data`), que no toca autenticación.

## Why

Hoy la única forma de cambiar la contraseña del administrador es volver a correr `npm run admin:bootstrap` desde una terminal con `DATABASE_URL` de producción y Public Access encendido (`docs/DEPLOY-RAILWAY.md` § 4: «el panel no tiene pantalla para cambiarla»). Es incómodo para una rotación de rutina y riesgoso como respuesta a una filtración: expone la base a internet mientras dura.

Peor: aunque se rote, **los JWT ya emitidos siguen valiendo** hasta su `exp` (`JWT_EXPIRES_IN`, por defecto `1d`). Ni el logout ni el bootstrap revocan nada: el guard solo comprueba firma, expiración y que el administrador exista (`JwtStrategy.validate`). Si alguien se llevó una cookie o un Bearer, cambiar la contraseña no lo saca.

## What Changes

- **`POST /api/auth/password`** (D1), autenticado con cookie o Bearer, cuerpo `{ currentPassword, newPassword }`. Exige la contraseña actual, valida la nueva, rehashea con argon2id y responde **200** con el mismo cuerpo que el login (`accessToken`, `tokenType`, `expiresIn`, `user`) y una cookie `portfolio_session` nueva.
- **Política de la contraseña nueva** (D2): de 12 a 256 caracteres (puntos de código), distinta de la actual, sin reglas de composición ni recorte de espacios.
- **Versión de sesión** (D3, D4): `AdminUser.sessionVersion` (entero, `0` por defecto) y el claim `sv` en el JWT. El guard del panel, `GET /api/auth/me` y el reconocimiento de visitas propias rechazan un token cuyo `sv` no coincide. Un token sin `sv` (emitido antes del deploy) vale como `0`, así que el deploy no cierra la sesión vigente.
- **Caso de uso `ChangeAdminPasswordUseCase`** (D5) con actualización condicional por versión: dos cambios simultáneos no dejan dos sesiones válidas.
- **Errores** (D6): contraseña actual incorrecta → **401** con mensaje genérico; nueva inválida o igual a la actual → **400**; sesión revocada → 401.
- **Reemisión de la sesión actual** (D7): quien hizo el cambio sigue adentro con la cookie nueva; los demás navegadores y los Bearer anteriores reciben 401.
- **Límite reforzado** (D8): contador propio por IP con el mismo `THROTTLE_LOGIN_LIMIT` y `THROTTLE_TTL` del login (5 por minuto por defecto); el sexto intento responde 429 con `Retry-After`.
- **Redacción** (D9): `currentPassword` y `newPassword` se suman a los campos redactados del log.
- **`admin:bootstrap` sigue** como vía de recuperación (D10) y ahora incrementa `sessionVersion` al actualizar: rotar por la terminal también cierra las sesiones abiertas.
- **Panel** (D11): pantalla **Cuenta** (`/admin/cuenta`), con acceso desde la barra superior, y el formulario **Cambiar contraseña** con React Hook Form + Zod (actual, nueva y confirmación) y mensajes literales que `manual:check` verifica.
- **Migración aditiva** (D12): `ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0`. Sin dependencias nuevas.
- **Contrato y docs:** `backend/openapi.json` y `frontend/src/shared/types/api.d.ts` regenerados; `docs/MANUAL.md` e `index.html` (**TC-45**, B1, B14 nueva, § 0), `docs/DEPLOY.md` § 3 y `docs/DEPLOY-RAILWAY.md` (rotación y recuperación), `docs/CHANGELOG.md`; la línea del roadmap en `CLAUDE.md` al archivar.

## Non-goals

- **Recuperar la contraseña por email** («olvidé mi contraseña»): exige un servicio de correo (la 1.2 no suma servicios). La recuperación sigue siendo `admin:bootstrap`.
- **Segundo factor (TOTP)**: es el ítem 8.2 de la propuesta, otro change.
- **Revocar la sesión en el logout** o un botón «Cerrar todas las sesiones» sin cambiar la contraseña. `sessionVersion` lo deja preparado, pero no entra acá.
- **Listar las sesiones abiertas** (dispositivo, IP, última actividad): pediría una tabla de sesiones (D3 la descarta).
- **Cambiar el email o el nombre** del administrador desde el panel.
- **Medidor de fortaleza, lista de contraseñas filtradas** o consulta a servicios externos (Have I Been Pwned): dependencia o servicio nuevo.
- **Endurecer `admin:bootstrap`** al mínimo de 12 caracteres: sigue en 8 para no romper la vía de recuperación (ver Risks en `design.md`).
- **Protección CSRF con token** (ítem 8.4 de la propuesta): el endpoint ya exige la contraseña actual y la cookie es `SameSite` (ver `design.md` § Risks).

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `admin-authentication`: ADDED *Cambio de la contraseña del administrador* y *Revocación de sesiones por versión*; MODIFIED *Token JWT con caducidad* (claim `sv`) y *Bootstrap del administrador* (incrementa `sessionVersion`).
- `api-rate-limiting`: ADDED *Límite reforzado en el cambio de contraseña*. No se reescribe *Límite reforzado en el login*, que no cambia.
- `api-observability`: MODIFIED *Redacción de datos sensibles* (`currentPassword` y `newPassword`).
- `admin-backoffice-shell`: ADDED *Pantalla Cuenta con cambio de contraseña*.
- `platform-manual`: MODIFIED *Manual del backoffice por pantalla* (suma la pantalla Cuenta).

## Impact

- **Base (`backend/prisma/`):** una columna `sessionVersion INTEGER NOT NULL DEFAULT 0` en `AdminUser` y una migración nueva, aditiva.
- **Backend (`backend/src/modules/auth/`):**
  - `domain/`: `AdminUser.sessionVersion` y `acceptsSession(sv)`; `validateNewPassword` (servicio puro) con `PASSWORD_MIN = 12` y `PASSWORD_MAX = 256`; errores `InvalidCurrentPasswordError` y `SessionRevokedError` (`AccessDeniedError`); `AdminUserRepository.changePassword(id, hash, expectedVersion)`; `TokenClaims.sessionVersion`.
  - `application/`: `ChangeAdminPasswordUseCase`; `GetCurrentAdminUseCase` recibe `sessionVersion`; `LoginUseCase` firma con `sv`.
  - `infrastructure/`: `ChangePasswordDto`; `POST /api/auth/password` en `AuthController`; `JwtTokenSigner` (claim `sv`), `JwtStrategy` y `JwtAdminSessionVerifier` (comparan `sv`); `PasswordChangeRateLimitGuard`; `PrismaAdminUserRepository.changePassword`.
  - `shared/infrastructure/http/logger.options.ts`: dos rutas más en `REDACTED_PATHS`.
- **Scripts:** `backend/scripts/bootstrap-admin.ts` (incrementa `sessionVersion` en el `update`).
- **Frontend (`frontend/src/features/backoffice/`):** `account/AccountPage.tsx`, `account/password-form.ts` (schema Zod), `use-session.ts` (`useChangePassword`), ruta en `BackofficeApp.tsx` y botón **Cuenta** en `shared/AdminShell.tsx`; `api.d.ts` regenerado.
- **Docs:** `docs/MANUAL.md`, `docs/manual/index.html` y la captura `bo-cuenta.jpg` (manifiesto de `capture-manual.mjs`), `docs/DEPLOY.md`, `docs/DEPLOY-RAILWAY.md`, `docs/CHANGELOG.md`, `CLAUDE.md`.
- **Sin cambios** en Caddy, la CSP, CORS, los atributos de la cookie, `JWT_EXPIRES_IN`, las variables de entorno ni las dependencias de `package.json`.
- **Operación:** la migración corre sola en el `preDeployCommand`. Las sesiones abiertas antes del deploy siguen valiendo (sin `sv` = versión 0) hasta el primer cambio de contraseña.
