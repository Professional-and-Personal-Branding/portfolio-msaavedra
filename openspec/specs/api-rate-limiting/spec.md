# api-rate-limiting Specification

## Purpose
Impide que un solo cliente agote la API o pruebe contraseñas por fuerza bruta, sin estorbar el uso normal de la vista pública ni del panel.

## Requirements

### Requirement: Límite global de peticiones
La API SHALL aplicar un límite global por IP configurable (`THROTTLE_TTL`, `THROTTLE_LIMIT`, por defecto 120 peticiones por minuto). Superarlo SHALL responder 429 con la cabecera `Retry-After`.

#### Scenario: Uso normal
- **WHEN** un visitante hace 20 peticiones a la vista pública en un minuto
- **THEN** todas responden normalmente

#### Scenario: Exceso
- **WHEN** un cliente supera el límite configurado en la ventana
- **THEN** la siguiente petición responde 429 con `Retry-After` y el cuerpo de error estándar

#### Scenario: El healthcheck no se limita
- **WHEN** el orquestador consulta `GET /health` con frecuencia
- **THEN** nunca recibe 429

### Requirement: Límite reforzado en el login
`POST /api/auth/login` SHALL tener un límite propio y mucho más estricto (por defecto 5 intentos por minuto y por IP), independiente del global. Alcanzarlo SHALL responder 429 sin revelar si el email existe.

#### Scenario: Fuerza bruta
- **WHEN** se hacen 6 intentos de login fallidos seguidos desde la misma IP en un minuto
- **THEN** el sexto responde 429, y el cuerpo no distingue entre email inexistente y contraseña incorrecta

#### Scenario: El límite no bloquea al administrador legítimo
- **WHEN** un administrador se equivoca dos veces y acierta a la tercera
- **THEN** el login exitoso responde 200 normalmente

### Requirement: Límite reforzado en el cambio de contraseña
`POST /api/auth/password` SHALL tener un límite propio por IP con los mismos valores que el login (`THROTTLE_LOGIN_LIMIT` intentos por `THROTTLE_TTL`; 5 por minuto por defecto), con un contador independiente del login y aplicado después de validar la sesión. Alcanzarlo SHALL responder 429 con `Retry-After` y el cuerpo de error estándar.

#### Scenario: Fuerza bruta sobre la contraseña actual
- **WHEN** una sesión válida hace 6 intentos de cambio con una contraseña actual incorrecta en un minuto desde la misma IP
- **THEN** los cinco primeros responden 401 y el sexto 429 con `Retry-After`

#### Scenario: Contador independiente del login
- **WHEN** desde una IP se agotan los 5 intentos de `POST /api/auth/login` y luego una sesión válida desde esa IP cambia la contraseña
- **THEN** el cambio responde 200

#### Scenario: Una petición anónima no consume el cupo
- **WHEN** se hacen 6 `POST /api/auth/password` sin sesión y después uno con sesión válida y la contraseña actual correcta
- **THEN** los seis primeros responden 401 y el último 200

### Requirement: Límite reforzado en la importación de vacantes
`POST /api/admin/job-postings` SHALL tener un límite propio de 10 importaciones por minuto y por IP, con un contador independiente del global y del login. Alcanzarlo SHALL responder 429 con `Retry-After` y el cuerpo de error estándar, sin ninguna petición saliente. Las demás rutas de vacantes SHALL seguir con el límite global.

#### Scenario: Ráfaga de importaciones
- **WHEN** una sesión válida hace 11 importaciones en un minuto desde la misma IP
- **THEN** las diez primeras se procesan y la undécima responde 429 con `Retry-After`, sin llegar al transporte HTTP

#### Scenario: Lectura no limitada por la importación
- **WHEN** se agotó el cupo de importaciones y la misma sesión pide `GET /api/admin/job-postings`
- **THEN** la respuesta es 200
