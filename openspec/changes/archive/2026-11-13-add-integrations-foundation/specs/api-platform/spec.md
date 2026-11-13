## ADDED Requirements

### Requirement: Variables de las integraciones validadas al arranque
La validación de entorno SHALL aceptar `INTEGRATIONS_ENABLED`, `INTEGRATIONS_SCHEDULER_ENABLED` (`true`/`false`), `INTEGRATIONS_SYNC_CRON`, `INTEGRATIONS_TICK_SECONDS` (10 a 3600), `INTEGRATIONS_JOB_TIMEOUT_MS`, `INTEGRATIONS_RUN_MAX_MS`, `INTEGRATIONS_KEYS` e `INTEGRATIONS_ACTIVE_KEY`, con defaults que dejan todo apagado. Un valor inválido MUST impedir el arranque nombrando la variable sin imprimir su valor.

#### Scenario: Defaults
- **WHEN** la API arranca sin ninguna variable `INTEGRATIONS_*`
- **THEN** arranca normalmente, sin proveedores y con el scheduler apagado

#### Scenario: Cron inválido
- **WHEN** la API arranca con `INTEGRATIONS_SYNC_CRON="todos los días"`
- **THEN** el proceso termina con código distinto de 0 y el error nombra `INTEGRATIONS_SYNC_CRON`

#### Scenario: Clave corta
- **WHEN** `INTEGRATIONS_ENABLED=fake` y una clave de `INTEGRATIONS_KEYS` decodifica a 16 bytes
- **THEN** el arranque falla nombrando `INTEGRATIONS_KEYS` y el mensaje no contiene la clave

#### Scenario: Clave de ejemplo en producción
- **WHEN** `NODE_ENV=production` y `INTEGRATIONS_KEYS` contiene la clave del `.env.example`
- **THEN** el arranque falla nombrando `INTEGRATIONS_KEYS`

#### Scenario: Claves sin clave activa
- **WHEN** `INTEGRATIONS_KEYS` tiene claves, `INTEGRATIONS_ACTIVE_KEY` falta y `INTEGRATIONS_ENABLED` está vacía
- **THEN** el arranque falla nombrando `INTEGRATIONS_ACTIVE_KEY`

#### Scenario: Timeout mayor que la corrida
- **WHEN** `INTEGRATIONS_JOB_TIMEOUT_MS` supera a `INTEGRATIONS_RUN_MAX_MS`
- **THEN** el arranque falla nombrando `INTEGRATIONS_JOB_TIMEOUT_MS`
