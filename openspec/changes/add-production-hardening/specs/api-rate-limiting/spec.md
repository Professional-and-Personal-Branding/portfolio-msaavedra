## Purpose

Impide que un solo cliente agote la API o pruebe contraseñas por fuerza bruta, sin estorbar el uso normal de la vista pública ni del panel.

## ADDED Requirements

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
