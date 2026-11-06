# admin-authentication Specification

## Purpose
Permite que el administrador del portafolio se autentique y que solo él pueda usar los endpoints de escritura, guardando las contraseñas de forma irrecuperable y emitiendo tokens con caducidad.

## Requirements

### Requirement: Login con credenciales
`POST /api/auth/login` con `{ email, password }` SHALL responder 200 con `{ accessToken, tokenType: "Bearer", expiresIn, user: { id, email, name } }` cuando las credenciales son válidas, y MUST responder 401 con el formato de error de `api-platform` cuando el email no existe o la contraseña no coincide, sin distinguir ambos casos en el mensaje. El cuerpo MUST validarse (email con formato, password no vacía) respondiendo 400 si es inválido.

#### Scenario: Credenciales válidas
- **WHEN** el administrador envía su email y contraseña correctos
- **THEN** recibe 200 con un `accessToken` JWT, `tokenType: "Bearer"`, `expiresIn` en segundos y sus datos sin `passwordHash`

#### Scenario: Contraseña incorrecta
- **WHEN** envía un email existente con contraseña incorrecta
- **THEN** recibe 401 con `error: "Unauthorized"`

#### Scenario: Email inexistente
- **WHEN** envía un email que no corresponde a ningún administrador
- **THEN** recibe 401 con el mismo mensaje que el caso de contraseña incorrecta

#### Scenario: Cuerpo inválido
- **WHEN** envía `{ email: "no-es-email" }` sin password
- **THEN** recibe 400

#### Scenario: Registro del último acceso
- **WHEN** el login es exitoso
- **THEN** `lastLoginAt` del administrador se actualiza a la fecha actual

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

### Requirement: Rutas de administración protegidas
Toda ruta bajo `/api/admin/` SHALL exigir un `Authorization: Bearer <JWT>` válido y MUST responder 401 en su ausencia o invalidez, para cualquier método (GET, POST, PATCH, DELETE). Las rutas públicas SHALL seguir respondiendo sin token.

#### Scenario: Escritura sin token
- **WHEN** un cliente hace `POST /api/admin/experiences` sin `Authorization`
- **THEN** recibe 401 y no se crea nada

#### Scenario: Lectura admin sin token
- **WHEN** un cliente hace `GET /api/admin/experiences` sin token
- **THEN** recibe 401

#### Scenario: Con token válido
- **WHEN** hace `GET /api/admin/experiences` con un Bearer válido
- **THEN** recibe 200

#### Scenario: Públicas siguen abiertas
- **WHEN** hace `GET /api/profile`, `GET /api/experiences` o `GET /api/curated-profiles/all` sin token
- **THEN** recibe 200

### Requirement: Contraseñas almacenadas con hash argon2id
Las contraseñas MUST guardarse únicamente como hash argon2id (con sal); nunca en texto plano ni con hash reversible. La verificación MUST hacerse comparando contra el hash.

#### Scenario: Hash en la base
- **WHEN** se crea o actualiza el administrador
- **THEN** la columna `passwordHash` comienza con `$argon2id$` y no contiene la contraseña

#### Scenario: Verificación
- **WHEN** se verifica una contraseña contra su hash
- **THEN** la correcta devuelve verdadero y una distinta devuelve falso

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

### Requirement: Sesión del backoffice por cookie httpOnly
`POST /api/auth/login`, además de devolver el JWT en el cuerpo, SHALL emitir una cookie `portfolio_session` con `httpOnly`, `sameSite=lax`, `path=/`, `secure` cuando `NODE_ENV=production` y `maxAge` igual a `JWT_EXPIRES_IN`. La cookie MUST NOT ser legible desde JavaScript.

#### Scenario: Login emite la cookie
- **WHEN** se hace `POST /api/auth/login` con credenciales válidas
- **THEN** la respuesta incluye `Set-Cookie: portfolio_session=<jwt>` con los atributos `HttpOnly`, `SameSite=Lax` y `Path=/`, y el cuerpo sigue trayendo `accessToken`

#### Scenario: Credenciales inválidas no emiten cookie
- **WHEN** se hace `POST /api/auth/login` con contraseña incorrecta
- **THEN** la respuesta es 401 y no incluye `Set-Cookie`

### Requirement: Autenticación por cookie o por header
El guard de `/api/admin/*` y `GET /api/auth/me` SHALL aceptar el JWT tomado de la cookie `portfolio_session` **o** del header `Authorization: Bearer`. Si ambos vienen, el header tiene prioridad. Sin ninguno de los dos, la respuesta SHALL ser 401.

#### Scenario: Petición autenticada por cookie
- **WHEN** se pide `GET /api/auth/me` enviando solo la cookie `portfolio_session` válida
- **THEN** responde 200 con el administrador autenticado

#### Scenario: Petición autenticada por header
- **WHEN** se pide `GET /api/admin/experiences` con `Authorization: Bearer <jwt>` y sin cookie
- **THEN** responde 200

#### Scenario: Cookie inválida
- **WHEN** se pide `GET /api/admin/experiences` con una cookie `portfolio_session` con firma inválida
- **THEN** responde 401

### Requirement: Cierre de sesión
`POST /api/auth/logout` SHALL borrar la cookie `portfolio_session` y responder 204. No requiere que la sesión sea válida (cerrar sesión dos veces no falla).

#### Scenario: Logout borra la cookie
- **WHEN** se hace `POST /api/auth/logout` con una sesión activa
- **THEN** responde 204 con `Set-Cookie` que expira `portfolio_session`, y una petición posterior a `GET /api/auth/me` con esa cookie responde 401

### Requirement: CORS con credenciales
La configuración de CORS SHALL permitir el envío de credenciales (`credentials: true`) para el origen del frontend, de modo que el navegador acepte y reenvíe la cookie de sesión.

#### Scenario: Preflight con credenciales
- **WHEN** llega un `OPTIONS` desde el origen permitido
- **THEN** la respuesta incluye `Access-Control-Allow-Credentials: true` y `Access-Control-Allow-Origin` con ese origen exacto (nunca `*`)

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
