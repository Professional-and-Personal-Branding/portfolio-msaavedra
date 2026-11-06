# Design — add-admin-password-change

## Context

Ver `proposal.md`. Estado verificado el 4 de noviembre de 2026 sobre `feat/profile-structured-data` (`a7a4317`, PR #47 abierto; no toca autenticación):

- **Modelo.** `AdminUser { id, email @unique, passwordHash, name, createdAt, lastLoginAt? }`. La entidad de dominio es inmutable y no tiene versión de sesión.
- **Login.** `LoginUseCase` busca por email, verifica con `PasswordHasher` (argon2id en `Argon2PasswordHasher`), toca `lastLoginAt` y firma con `TokenSigner`. `InvalidCredentialsError` (un `AccessDeniedError`) da 401 con el mismo mensaje para email inexistente y contraseña incorrecta. El controller emite `portfolio_session` con `buildSessionCookieOptions(expiresIn, isProduction, sessionCookieSameSite)`.
- **Token.** `JwtTokenSigner` firma HS256 `{ email, name }` con `subject` y `expiresIn`. `JwtStrategy.validate` exige `sub` y llama a `GetCurrentAdminUseCase({ id })`: si el administrador existe, `req.user` es `AdminOutput { id, email, name }`. **No hay revocación**: un token vale hasta su `exp`.
- **Visitas propias.** `JwtAdminSessionVerifier.isAdminSession(token)` (change `classify-profile-views`, D2) repite firma, expiración y existencia para clasificar visitas como `OWNER`.
- **Límite del login.** `LoginRateLimitGuard`: mapa en memoria por `request.ip`, ventana `THROTTLE_TTL` y tope `THROTTLE_LOGIN_LIMIT` (5), 429 con `Retry-After`. Es un provider singleton: si se aplicara tal cual a otra ruta, compartiría contador con el login.
- **Logs.** `REDACTED_PATHS` cubre `req.body.password`, `req.body.accessToken`, `password` y `accessToken`; el serializador de `req` solo deja `id`, `method` y `url`, así que hoy el cuerpo no llega al log. `AllExceptionsFilter` registra los 4xx en una línea con el mensaje de la excepción; los mensajes de `class-validator` nombran la propiedad, no el valor.
- **Bootstrap.** `scripts/bootstrap-admin.ts` hace `upsert` por email con Prisma directo (mínimo 8 caracteres) y se corre a mano desde la máquina del owner, no en el `preDeployCommand`.
- **Panel.** `AdminLayout` tiene en la barra el nombre, «Ver portafolio» y «Cerrar sesión». `createQueryClient` invalida la consulta de sesión ante **cualquier** 401 de consultas o mutaciones; `RequireSession` solo muestra el esqueleto con `isPending`, así que una recarga de `/me` que vuelve 200 no desmonta la pantalla. RHF, `@hookform/resolvers`, Zod, sonner y lucide ya son dependencias.

## Goals / Non-Goals

**Goals:** que el administrador cambie su contraseña desde el panel sin abrir la base; que después del cambio ningún token anterior sirva (otros navegadores, Bearer copiados, cookies robadas), mientras la sesión que hizo el cambio sigue; que el endpoint no sea una vía de fuerza bruta ni deje contraseñas en los logs; que el deploy no cierre la sesión vigente.

**Non-Goals:** ver `proposal.md` § Non-goals.

## Decisions

### D1 — `POST /api/auth/password` en el módulo `auth`, con el cuerpo del login

- Ruta `POST /api/auth/password`, `@UseGuards(JwtAuthGuard, PasswordChangeRateLimitGuard)`, `adminValidationPipe` (rechaza campos desconocidos). Cuerpo `ChangePasswordDto { currentPassword: string; newPassword: string }`.
- Responde **200** con `LoginOutput` (`accessToken`, `tokenType: "Bearer"`, `expiresIn`, `user`) y `Set-Cookie: portfolio_session=<jwt nuevo>` con los mismos atributos que el login. En Swagger reusa `LoginResponse`.
- La confirmación («Repetí la nueva contraseña») es solo del panel: la API no la recibe.

Alternativas descartadas:
- **`204` sin cuerpo.** Un cliente Bearer (curl, Swagger, e2e) quedaría sin token válido después del cambio, porque el suyo se revoca (D3).
- **`PATCH /api/admin/account/password`.** Sacaría la credencial del módulo `auth`, donde viven el hasher, el firmante, el límite reforzado y la cookie.

### D2 — Política de la nueva: 12 a 256 caracteres, distinta de la actual, sin composición

- Servicio puro de dominio `validateNewPassword(newPassword, currentPassword): Result<void, ValidationError>` con `PASSWORD_MIN = 12` y `PASSWORD_MAX = 256`, contando **puntos de código** (`[...value].length`) para no penalizar acentos ni emojis.
- Sin recorte de espacios ni normalización: la contraseña se hashea tal como se escribió (igual que hoy en el login).
- `newPassword === currentPassword` → `ValidationError` (400). Se evalúa **después** de verificar la actual (D5), así que no revela nada.
- El DTO hace de primer filtro: `@IsString() @MinLength(12) @MaxLength(256)` en `newPassword` y `@IsString() @IsNotEmpty() @MaxLength(256)` en `currentPassword` (el mismo tope que `LoginDto`, que además acota el costo de argon2). El dominio manda: con caracteres fuera del plano básico, `MinLength` (UTF-16) puede aceptar lo que el dominio rechaza.
- El panel repite las reglas con Zod (D11).

Alternativas descartadas:
- **Mínimo de 8, como `admin:bootstrap`.** Es el piso de NIST SP 800-63B; con un único administrador que usa gestor de contraseñas, 12 cuesta nada y rinde más. El bootstrap queda en 8 (D10).
- **Reglas de composición** (mayúscula, número, símbolo). NIST las desaconseja: empujan a patrones previsibles sin sumar entropía real.
- **Lista de contraseñas filtradas.** Exige un archivo grande versionado o un servicio externo (non-goal).

### D3 — `sessionVersion` en `AdminUser` y claim `sv` en el JWT

```prisma
model AdminUser {
  // … campos actuales …
  sessionVersion Int @default(0)
}
```

- `TokenClaims` suma `sessionVersion`; `JwtTokenSigner` lo firma como `sv`. Login y cambio de contraseña firman con la versión vigente.
- Un token es válido solo si `sv` coincide con `AdminUser.sessionVersion`. **Un token sin `sv` cuenta como `0`**: los emitidos antes del deploy siguen valiendo mientras la versión sea `0`, y caen con el primer cambio. Un `sv` que no es entero no negativo se rechaza.
- Cambiar la contraseña incrementa la versión en 1 en la misma escritura que el hash (D5).
- La regla vive en el dominio: `AdminUser.acceptsSession(sv: number | undefined): boolean`.

Alternativas descartadas:
- **`passwordChangedAt` contra `iat`.** `iat` tiene precisión de segundos: el token reemitido en el mismo segundo del cambio es indistinguible de uno anterior, y depende del reloj del servidor. Un entero compara exacto.
- **Tabla de sesiones o lista de tokens revocados.** Más estado, una tabla y una limpieza periódica para un único administrador; queda para cuando se quiera listar sesiones (non-goal).
- **Rotar `JWT_SECRET`.** Revoca todo, pide redeploy y no se puede hacer desde el panel.

### D4 — Una sola verificación de sesión para el guard, `/me` y las visitas propias

- `GetCurrentAdminUseCase.execute({ id, sessionVersion })` devuelve `fail(SessionRevokedError)` si el administrador no existe o `!admin.acceptsSession(sessionVersion)`. `JwtStrategy.validate` y `JwtAdminSessionVerifier.isAdminSession` le pasan `payload.sv`.
- `JwtStrategy` deja en `req.user` un `AuthenticatedAdmin { id, email, name, sessionVersion }` (tipo de `application/dto`). `GET /api/auth/me` sigue devolviendo exactamente `{ id, email, name }`: el controller mapea, no expone la versión.
- Así una visita con un token revocado vuelve a clasificarse `HUMAN` o `BOT`, no `OWNER`.

Alternativa descartada: **comparar `sv` solo en el guard.** `JwtAdminSessionVerifier` seguiría aceptando la cookie robada y la analítica contaría esas visitas como propias.

### D5 — `ChangeAdminPasswordUseCase` con actualización condicional por versión

`execute({ adminId, sessionVersion, currentPassword, newPassword }): Promise<Result<LoginOutput, SessionRevokedError | InvalidCurrentPasswordError | ValidationError>>`, en este orden:

1. `findById(adminId)`; si no existe o no acepta `sessionVersion` → `SessionRevokedError`.
2. `hasher.verify(admin.passwordHash, currentPassword)`; si es falso → `InvalidCurrentPasswordError`.
3. `validateNewPassword(newPassword, currentPassword)` → `ValidationError`.
4. `hasher.hash(newPassword)` (argon2id).
5. `admins.changePassword(adminId, hash, sessionVersion)`: actualiza `passwordHash` e incrementa `sessionVersion` **solo si** la versión sigue siendo la esperada (`updateMany where { id, sessionVersion }` y relectura). Si no actualizó ninguna fila → `SessionRevokedError`: otra petición cambió la contraseña en el medio.
6. Firma con la versión nueva y devuelve `LoginOutput`.

No toca `lastLoginAt`. No necesita transacción: la escritura condicional es atómica en Postgres.

Alternativa descartada: **`update` sin condición.** Dos cambios simultáneos desde dos sesiones dejarían como válida la última en escribir, con una contraseña que la otra cree haber puesto.

### D6 — Contraseña actual incorrecta: 401 con mensaje genérico

- `InvalidCurrentPasswordError extends AccessDeniedError` con el motivo `credenciales incorrectas`; `SessionRevokedError` usa `sesión inválida`. Los dos pasan por `toHttpException` → 401 con el formato de `api-platform`, sin stack ni detalle del hash.
- El panel ya invalida la sesión ante cualquier 401 (`createQueryClient`): `GET /api/auth/me` se recarga; si vuelve 200, la pantalla sigue y muestra «La contraseña actual no es correcta»; si vuelve 401 (sesión revocada o vencida), `RequireSession` manda al login. No hace falta tocar el manejo global.
- Ningún intento fallido cambia nada en la base.

Alternativas descartadas:
- **403 o 400 para la actual incorrecta.** Rompería el mapeo uniforme `AccessDeniedError → 401` y el criterio de la ficha de la propuesta; la desambiguación ya la da la recarga de `/me`.
- **Cerrar la sesión tras N fallos.** El límite reforzado (D8) ya frena la fuerza bruta, y cerrar la sesión legítima sería un vector de molestia.

### D7 — Reemisión de la sesión actual; las demás quedan afuera

- El controller emite la cookie nueva con `buildSessionCookieOptions(expiresIn, isProduction, sessionCookieSameSite)` y devuelve el token nuevo en el cuerpo.
- El token con el que se hizo la petición también queda revocado: en el navegador lo reemplaza la cookie nueva; un cliente Bearer usa el `accessToken` de la respuesta.
- Otras pestañas del **mismo** navegador comparten la cookie y siguen; otros navegadores o dispositivos reciben 401 en su próxima petición y vuelven al login.
- El vencimiento se reinicia (`JWT_EXPIRES_IN` desde el cambio).

Alternativa descartada: **cerrar también la sesión actual y mandar al login.** Obliga a escribir la contraseña recién creada sin ganar seguridad: quien la cambió ya probó conocer la anterior.

### D8 — Límite reforzado propio, después del guard de sesión

- `PasswordChangeRateLimitGuard`: mismo algoritmo que `LoginRateLimitGuard` (ventana fija en memoria por `request.ip`, `THROTTLE_TTL`, tope `THROTTLE_LOGIN_LIMIT`), con **contador propio**. La lógica de la ventana se extrae a una clase común de `auth/infrastructure/security` que los dos guards instancian; `LoginRateLimitGuard` no cambia de comportamiento.
- Cuenta todos los intentos que pasan la autenticación (también los exitosos y los 400). Se aplica después de `JwtAuthGuard`: una petición anónima da 401 sin consumir el cupo.
- Superarlo: 429 con `Retry-After` y el mensaje `Demasiados intentos de cambio de contraseña. Probá de nuevo en unos minutos.`
- Sin variables de entorno nuevas.

Alternativas descartadas:
- **Compartir el contador del login.** Un par de logins fallidos restaría intentos al cambio y viceversa, y los tests de cada uno dependerían del otro.
- **`THROTTLE_PASSWORD_LIMIT` nuevo.** Una variable más sin un caso que la pida; el riesgo es el mismo que el del login.

### D9 — `currentPassword` y `newPassword` redactados

- `REDACTED_PATHS` suma `req.body.currentPassword`, `req.body.newPassword`, `currentPassword` y `newPassword`. Es defensivo: el serializador de `req` ya no incluye el cuerpo, pero la spec de redacción tiene que nombrar los campos.
- Ningún `logger` del caso de uso ni del controller recibe el DTO. Los mensajes 400 de `class-validator` nombran la propiedad sin el valor.
- El e2e (tarea 6.4) captura la salida del logger durante el flujo y comprueba que ninguna de las dos contraseñas aparece.

Alternativa descartada: **confiar solo en el serializador.** Un cambio futuro del serializador (por ejemplo, loguear el cuerpo de los 4xx) filtraría las contraseñas sin que ningún test lo note.

### D10 — `admin:bootstrap` sigue como recuperación e incrementa `sessionVersion`

- El `update` del `upsert` suma `sessionVersion: { increment: 1 }`; el `create` deja el `0` por defecto. Rotar por la terminal cierra las sesiones abiertas, igual que el panel.
- Mantiene sus reglas actuales (variables obligatorias, mínimo 8): es la vía para entrar cuando se perdió la contraseña o se sospecha que la sesión está tomada.
- `docs/DEPLOY.md` § 3 y `docs/DEPLOY-RAILWAY.md` pasan a decir: la rotación de rutina va por **Cuenta** en el panel; `admin:bootstrap` es la recuperación (contraseña olvidada) y también cierra todas las sesiones.

Alternativa descartada: **no tocar la versión en el bootstrap.** La vía de rescate ante una sesión robada no la sacaría: justo el caso en que más importa.

### D11 — Pantalla Cuenta en `/admin/cuenta`

- Ruta nueva dentro de `RequireSession`/`AdminLayout`. En la barra superior, botón **Cuenta** (ícono `UserCog` de lucide, con `aria-label` y la misma regla de etiqueta que «Cerrar sesión»), antes de «Cerrar sesión». No entra en `NAV`: no es una sección de contenido.
- La página muestra el nombre y el email del administrador (de `useSession`) y el formulario **Cambiar contraseña** con React Hook Form + Zod (`account/password-form.ts`):

| Campo | `autocomplete` | Reglas (Zod) |
|---|---|---|
| Contraseña actual | `current-password` | obligatoria, ≤ 256 |
| Nueva contraseña | `new-password` | 12 a 256 puntos de código; distinta de la actual |
| Repetí la nueva contraseña | `new-password` | igual a la nueva |

- Mensajes literales (los cita `docs/MANUAL.md` B14; `manual:check` los busca en `frontend/src`):
  - `Escribí tu contraseña actual`
  - `Usá al menos 12 caracteres`
  - `Usá como máximo 256 caracteres`
  - `La nueva contraseña tiene que ser distinta de la actual`
  - `Las contraseñas no coinciden`
  - 401: `La contraseña actual no es correcta`
  - 400 de la API: `La API rechazó la contraseña nueva. Revisá las reglas.`
  - 429: `Demasiados intentos. Probá de nuevo en unos minutos.`
  - otro error: `No pudimos contactar al servidor. Intentá de nuevo.` (el mismo del login)
  - éxito (toast): `Contraseña actualizada. Se cerraron las sesiones de otros dispositivos.`
- Botón **Cambiar contraseña** (`Guardando…` mientras tanto). Tras el éxito se vacían los tres campos; ninguna contraseña ni token toca `localStorage` o `sessionStorage`. Los campos de contraseña quedan fuera del aviso de cambios sin guardar (no hay borrador que proteger).
- Mutación `useChangePassword()` en `auth/use-session.ts`. No hace falta tocar la caché de `/me`: el servidor ya reemplazó la cookie y los datos del administrador no cambian.

Alternativas descartadas:
- **Diálogo en la barra.** Un formulario con tres contraseñas y mensajes de error pide espacio y una URL estable para el manual y `manual:capture`.
- **Ítem en `NAV`.** Mezcla una acción de cuenta con las secciones de contenido y ensancha una barra que ya solo cabe desde `xl`.

### D12 — Migración aditiva, sin dependencias nuevas

- `<timestamp>_add_admin_session_version`: `ALTER TABLE "AdminUser" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;` sin `UPDATE` ni `DROP`. Con el `DEFAULT`, las filas existentes quedan en `0` y las sesiones abiertas siguen valiendo (D3).
- Todo lo necesario ya está en `package.json` (argon2, `@nestjs/jwt`, class-validator, RHF, Zod, sonner, lucide).

Alternativa descartada: **columna nula con backfill.** Pide un `UPDATE` y un caso más (`null`) en la comparación, sin beneficio.

## Risks / Trade-offs

- **[Una consulta más por petición autenticada]** → ya existe: `GetCurrentAdminUseCase` lee el administrador en cada request; solo se agrega la comparación de un entero.
- **[Límite en memoria]** → con una instancia de `api` (el deploy de Railway) es correcto; varias instancias pedirían un almacén compartido, igual que el del login.
- **[CSRF]** → la cookie es `SameSite` (`lax` por defecto, `strict` en Railway) y el endpoint exige la contraseña actual: un sitio ajeno no puede cambiarla sin conocerla. El ítem 8.4 de la propuesta sigue siendo otro change.
- **[Bootstrap con 8 y panel con 12]** → una contraseña de 8 a 11 caracteres puesta por el bootstrap sirve para entrar, pero el panel no deja volver a ponerla. Es intencional: el panel sube el piso sin romper la recuperación.
- **[Contraseña olvidada sin acceso a la terminal]** → no hay otra vía (non-goal). La guía de deploy explica la recuperación con `admin:bootstrap`.
- **[Sesión cerrada en otro dispositivo sin aviso]** → la próxima petición de ese panel da 401 y vuelve al login; es el comportamiento buscado. El toast lo anticipa.
- **[Token Bearer en scripts del owner]** → los `curl` con un `TOKEN` viejo dejan de funcionar tras el cambio; el manual (§ 0) lo aclara.
- **[e2e que comparten administrador]** → el e2e nuevo usa un administrador propio (otro email) creado y borrado en el mismo archivo, para no revocar la sesión de `E2E_ADMIN` que usan los demás.

## Migration Plan

1. **Migración** `<timestamp>_add_admin_session_version`: generada con `--create-only` contra una base descartable (`portfolio_pwd_check`) y revisada a mano: un solo `ADD COLUMN`.
2. **Deploy:** corre en el `preDeployCommand`. Sin backfill. La sesión abierta del owner sigue valiendo (token sin `sv` = `0`).
3. **Base local del owner (`portfolio`, 5434):** la migra él con `npm run prisma:migrate` cuando actualice; ninguna tarea la toca.
4. **Primer uso:** el owner cambia la contraseña desde **Cuenta** después del deploy; las sesiones de otros dispositivos se cierran.
5. **Rollback:** revertir el código deja la columna sin uso; el código viejo no lee `sv` y vuelve a aceptar cualquier token vigente por firma y `exp`. La contraseña cambiada sigue siendo la válida. Quitar la columna exige una migración inversa con `DROP COLUMN`.

## Open Questions

Ninguna bloqueante. Las variantes que quedaron fuera (revocar en el logout, listar sesiones, TOTP, recuperación por email) están en `proposal.md` § Non-goals y no necesitan respuesta para implementar este change.
