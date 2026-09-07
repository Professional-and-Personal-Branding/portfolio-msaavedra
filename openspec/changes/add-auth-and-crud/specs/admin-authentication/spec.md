## Purpose

Permite que el administrador del portafolio se autentique y que solo él pueda usar los endpoints de escritura, guardando las contraseñas de forma irrecuperable y emitiendo tokens con caducidad.

## ADDED Requirements

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
El `accessToken` SHALL ser un JWT firmado con `JWT_SECRET` (HS256) con claims `sub` (id), `email` y `exp` según `JWT_EXPIRES_IN`. Un token expirado, mal firmado o malformado MUST rechazarse.

#### Scenario: Token válido identifica al administrador
- **WHEN** un cliente hace `GET /api/auth/me` con `Authorization: Bearer <accessToken>` válido
- **THEN** recibe 200 con `{ id, email, name }`

#### Scenario: Token con firma inválida
- **WHEN** presenta un token firmado con otro secreto
- **THEN** recibe 401

#### Scenario: Token expirado
- **WHEN** presenta un token cuyo `exp` ya pasó
- **THEN** recibe 401

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
`npm run admin:bootstrap` SHALL crear el administrador a partir de `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_NAME` (o actualizar nombre y contraseña si ya existe) y MUST fallar con mensaje claro si falta email o contraseña. El seed de datos MUST NOT borrar administradores.

#### Scenario: Primer arranque
- **WHEN** no existe administrador y se ejecuta el bootstrap con las variables definidas
- **THEN** existe un `AdminUser` con ese email, nombre y hash argon2id, y el login funciona

#### Scenario: Re-ejecución actualiza
- **WHEN** ya existe el administrador y se ejecuta con otra `ADMIN_PASSWORD`
- **THEN** el login funciona con la nueva contraseña y no se duplica el usuario

#### Scenario: Faltan variables
- **WHEN** se ejecuta sin `ADMIN_PASSWORD`
- **THEN** el proceso termina con código distinto de 0 y menciona la variable

#### Scenario: Seed preserva administradores
- **WHEN** se ejecuta `npm run seed` con un administrador existente
- **THEN** el administrador sigue existiendo
