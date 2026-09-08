## ADDED Requirements

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
