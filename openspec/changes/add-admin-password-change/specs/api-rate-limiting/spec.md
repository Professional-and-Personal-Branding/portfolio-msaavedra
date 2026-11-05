## ADDED Requirements

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
