## ADDED Requirements

### Requirement: Cambio de la contraseña del administrador
`POST /api/auth/password` con `{ currentPassword, newPassword }` y una sesión válida (cookie o Bearer) SHALL verificar la actual, guardar el hash argon2id de la nueva, incrementar `sessionVersion` y responder 200 con el cuerpo del login y una cookie `portfolio_session` nueva. La nueva MUST tener de 12 a 256 caracteres y ser distinta de la actual (400). Una actual incorrecta MUST responder 401 con un mensaje genérico, sin cambiar nada.

#### Scenario: Cambio correcto
- **WHEN** el administrador autenticado envía su contraseña actual y una nueva de 20 caracteres
- **THEN** recibe 200 con `accessToken`, `tokenType: "Bearer"`, `expiresIn` y `user`, y un `Set-Cookie: portfolio_session=<jwt>` con `HttpOnly` y `Path=/`

#### Scenario: El login usa la nueva contraseña
- **WHEN** después del cambio se hace `POST /api/auth/login` con la contraseña anterior y luego con la nueva
- **THEN** el primero responde 401 y el segundo 200

#### Scenario: Contraseña actual incorrecta
- **WHEN** se envía una `currentPassword` que no coincide
- **THEN** recibe 401 con `error: "Unauthorized"`, sin `Set-Cookie`, y `passwordHash` y `sessionVersion` no cambian

#### Scenario: Nueva demasiado corta
- **WHEN** se envía una `newPassword` de 11 caracteres
- **THEN** recibe 400 y la contraseña no cambia

#### Scenario: Nueva igual a la actual
- **WHEN** se envía como `newPassword` la misma contraseña actual, que es correcta
- **THEN** recibe 400 y `sessionVersion` no cambia

#### Scenario: Sin sesión
- **WHEN** se hace `POST /api/auth/password` sin cookie ni `Authorization`
- **THEN** recibe 401 y no se verifica ninguna contraseña

#### Scenario: Campo desconocido
- **WHEN** el cuerpo incluye además `{ "email": "otro@example.com" }`
- **THEN** recibe 400 y nada cambia

### Requirement: Revocación de sesiones por versión
Cada JWT del panel SHALL llevar el claim `sv` con la `sessionVersion` del administrador al emitirse. El guard de `/api/admin/*`, `GET /api/auth/me`, `POST /api/auth/password` y el reconocimiento de visitas propias MUST rechazar un token cuyo `sv` difiera de la versión vigente. Un token sin `sv` SHALL valer como versión 0. `GET /api/auth/me` MUST NOT exponer la versión.

#### Scenario: Una sesión anterior queda afuera
- **WHEN** la sesión A cambia la contraseña y la sesión B, abierta antes en otro navegador, pide `GET /api/auth/me` con su cookie
- **THEN** B recibe 401

#### Scenario: Un Bearer anterior queda afuera
- **WHEN** después del cambio se pide `GET /api/admin/experiences` con el `accessToken` emitido antes del cambio
- **THEN** responde 401

#### Scenario: La sesión que cambió sigue
- **WHEN** después del cambio se pide `GET /api/auth/me` con la cookie o el `accessToken` de la respuesta del cambio
- **THEN** responde 200 con `{ id, email, name }` y sin `sessionVersion`

#### Scenario: Token anterior al deploy
- **WHEN** un administrador con `sessionVersion` 0 presenta un JWT válido sin claim `sv`
- **THEN** la petición se acepta

#### Scenario: Visita con un token revocado
- **WHEN** se abre un perfil público con una cookie `portfolio_session` revocada por un cambio de contraseña
- **THEN** la visita no se registra como `OWNER`

## MODIFIED Requirements

### Requirement: Token JWT con caducidad
El `accessToken` SHALL ser un JWT firmado con `JWT_SECRET` (HS256) con claims `sub` (id), `email`, `sv` (versión de sesión) y `exp` según `JWT_EXPIRES_IN`. Un token expirado, mal firmado o malformado MUST rechazarse.

#### Scenario: Token válido identifica al administrador
- **WHEN** un cliente hace `GET /api/auth/me` con `Authorization: Bearer <accessToken>` válido
- **THEN** recibe 200 con `{ id, email, name }`

#### Scenario: Token con firma inválida
- **WHEN** presenta un token firmado con otro secreto
- **THEN** recibe 401

#### Scenario: Token expirado
- **WHEN** presenta un token cuyo `exp` ya pasó
- **THEN** recibe 401

#### Scenario: Claim de versión
- **WHEN** se decodifica el `accessToken` de un login exitoso
- **THEN** su claim `sv` es igual a la `sessionVersion` del administrador

### Requirement: Bootstrap del administrador
`npm run admin:bootstrap` SHALL crear el administrador a partir de `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_NAME` (o actualizar nombre y contraseña si ya existe, incrementando `sessionVersion` para cerrar las sesiones abiertas) y MUST fallar con mensaje claro si falta email o contraseña. El seed de datos MUST NOT borrar administradores. Sigue siendo la vía de recuperación si se pierde la contraseña.

#### Scenario: Primer arranque
- **WHEN** no existe administrador y se ejecuta el bootstrap con las variables definidas
- **THEN** existe un `AdminUser` con ese email, nombre y hash argon2id, y el login funciona

#### Scenario: Re-ejecución actualiza
- **WHEN** ya existe el administrador y se ejecuta con otra `ADMIN_PASSWORD`
- **THEN** el login funciona con la nueva contraseña y no se duplica el usuario

#### Scenario: La re-ejecución cierra las sesiones
- **WHEN** hay una sesión abierta en el panel y se vuelve a ejecutar el bootstrap
- **THEN** `sessionVersion` aumenta en 1 y esa sesión recibe 401 en su próxima petición

#### Scenario: Faltan variables
- **WHEN** se ejecuta sin `ADMIN_PASSWORD`
- **THEN** el proceso termina con código distinto de 0 y menciona la variable

#### Scenario: Seed preserva administradores
- **WHEN** se ejecuta `npm run seed` con un administrador existente
- **THEN** el administrador sigue existiendo
