# api-health Specification

## Purpose
Le da al orquestador (Railway/Render) una forma barata y honesta de saber si la API está viva y si puede atender tráfico, sin exponer nada útil para un atacante.

## Requirements

### Requirement: Estado de la API y de sus dependencias
`GET /health` SHALL responder sin autenticación, fuera del prefijo `/api`, con `{ status, uptime, checks: { database } }`. Con la base accesible el `status` SHALL ser `ok` y el código 200; si la base no responde dentro de un tiempo máximo, el `status` SHALL ser `error` y el código **503**. La comprobación SHALL ser una consulta trivial (`SELECT 1`), nunca una lectura de datos del portafolio.

#### Scenario: Base accesible
- **WHEN** se pide `GET /health` con Postgres arriba
- **THEN** responde 200 con `status: "ok"` y `checks.database.status: "up"`

#### Scenario: Base caída
- **WHEN** la base no responde
- **THEN** responde 503 con `status: "error"` y `checks.database.status: "down"`, sin incluir la cadena de conexión ni el mensaje crudo del driver

#### Scenario: Sin autenticación
- **WHEN** se pide `GET /health` sin cabeceras
- **THEN** responde (200 o 503) y nunca 401

### Requirement: Sonda de vida independiente de la base
`GET /health/live` SHALL responder 200 mientras el proceso esté vivo, sin consultar la base, para que el orquestador no reinicie la API por una caída temporal de Postgres.

#### Scenario: Vive aunque la base no
- **WHEN** la base está caída y se pide `GET /health/live`
- **THEN** responde 200

### Requirement: El healthcheck no revela información sensible
Las respuestas de `/health` MUST NOT incluir versiones de dependencias, variables de entorno, la URL de la base ni rutas internas.

#### Scenario: Respuesta sin fugas
- **WHEN** se inspecciona el cuerpo de `GET /health`
- **THEN** no contiene `postgresql://`, `DATABASE_URL`, `JWT`, ni rutas de archivos
