## ADDED Requirements

### Requirement: Límite reforzado en la importación de vacantes
`POST /api/admin/job-postings` SHALL tener un límite propio de 10 importaciones por minuto y por IP, con un contador independiente del global y del login. Alcanzarlo SHALL responder 429 con `Retry-After` y el cuerpo de error estándar, sin ninguna petición saliente. Las demás rutas de vacantes SHALL seguir con el límite global.

#### Scenario: Ráfaga de importaciones
- **WHEN** una sesión válida hace 11 importaciones en un minuto desde la misma IP
- **THEN** las diez primeras se procesan y la undécima responde 429 con `Retry-After`, sin llegar al transporte HTTP

#### Scenario: Lectura no limitada por la importación
- **WHEN** se agotó el cupo de importaciones y la misma sesión pide `GET /api/admin/job-postings`
- **THEN** la respuesta es 200
