# integration-connectors Specification

## Purpose
Las próximas integraciones (GitHub y otras) necesitan hablar con terceros con credenciales propias. Un catálogo cerrado de proveedores habilitados por variable de entorno, credenciales cifradas con AES-256-GCM y un keyring rotable, y una API del panel de solo escritura para el secreto, dan una base común sin dejar tokens en claro ni en los logs.

## Requirements

### Requirement: Catálogo de proveedores y habilitación por entorno
La API SHALL registrar solo los proveedores listados en `INTEGRATIONS_ENABLED` (ids separados por comas, vacía por defecto). Un id fuera del catálogo MUST impedir el arranque nombrando la variable. El proveedor `fake` MUST NOT poder habilitarse con `NODE_ENV=production`.

#### Scenario: Sin proveedores
- **WHEN** la API arranca sin `INTEGRATIONS_ENABLED`
- **THEN** arranca normalmente y `GET /api/admin/integrations` devuelve `providers` vacío

#### Scenario: Id desconocido
- **WHEN** la API arranca con `INTEGRATIONS_ENABLED=fake,gitlab`
- **THEN** el proceso termina con código distinto de 0 y el error nombra `INTEGRATIONS_ENABLED`

#### Scenario: Proveedor de prueba en producción
- **WHEN** la API arranca con `NODE_ENV=production` e `INTEGRATIONS_ENABLED=fake`
- **THEN** el arranque falla nombrando `INTEGRATIONS_ENABLED`

### Requirement: Secreto opcional por variable de entorno
Cada proveedor SHALL declarar una variable de entorno opcional para su secreto. La API MUST NOT exigirla al arrancar: sin ella el secreto sale de la base y, si tampoco hay, el estado muestra que falta la credencial.

#### Scenario: Proveedor desactivado sin su variable
- **WHEN** la API arranca sin `FAKE_PROVIDER_TOKEN` y con `INTEGRATIONS_ENABLED` vacía
- **THEN** la API arranca normalmente

#### Scenario: Proveedor habilitado sin su variable
- **WHEN** la API arranca con `INTEGRATIONS_ENABLED=fake` (con keyring) y sin `FAKE_PROVIDER_TOKEN`
- **THEN** arranca normalmente y el estado de `fake` muestra `credential.source: null` (falta la credencial)

### Requirement: Cifrado de credenciales con keyring
Las credenciales guardadas en la base SHALL cifrarse con AES-256-GCM, IV aleatorio por cifrado y como dato asociado el proveedor, con la clave `INTEGRATIONS_ACTIVE_KEY` del keyring `INTEGRATIONS_KEYS` (ids con claves de 32 bytes). Se descifra con la clave que nombra el payload. Las dos variables MUST exigirse si hay algún proveedor habilitado.

#### Scenario: Ida y vuelta
- **WHEN** se cifra una credencial del proveedor `fake` y se descifra con el mismo keyring
- **THEN** se obtiene el texto original y el payload guardado no lo contiene

#### Scenario: Payload movido a otro proveedor
- **WHEN** se intenta descifrar el payload de `fake` como si fuera de otro proveedor
- **THEN** el descifrado falla con un error de credencial ilegible y no lanza excepción

#### Scenario: Clave activa ausente del keyring
- **WHEN** la API arranca con `INTEGRATIONS_ENABLED=fake` e `INTEGRATIONS_ACTIVE_KEY=k2` con un keyring que solo tiene `k1`
- **THEN** el arranque falla nombrando `INTEGRATIONS_ACTIVE_KEY` sin imprimir ninguna clave

### Requirement: Rotación de claves idempotente
`npm run integrations:rekey` SHALL simular por defecto y, con `--apply`, recifrar con la clave activa cada credencial guardada con otra clave. Una segunda corrida MUST no cambiar nada. Una credencial con una clave ausente del keyring MUST quedar intacta y el comando MUST salir con código 2. Nunca imprime secretos.

#### Scenario: Rotación
- **WHEN** hay dos credenciales con `k1`, la activa es `k2` y se corre `integrations:rekey -- --apply`
- **THEN** las dos quedan con `k2`, siguen descifrando al mismo texto y el comando sale con 0

#### Scenario: Segunda corrida
- **WHEN** se vuelve a correr `integrations:rekey -- --apply`
- **THEN** informa 0 credenciales para recifrar, no escribe y sale con 0

#### Scenario: Clave retirada antes de tiempo
- **WHEN** una credencial nombra `k0`, que no está en el keyring
- **THEN** esa fila no se toca y el comando sale con 2

### Requirement: Credencial de solo escritura
`PUT /api/admin/integrations/:provider/credential` SHALL guardar la credencial cifrada (204) y `DELETE` borrarla (204). Ninguna respuesta MUST incluir el secreto ni el payload cifrado: el estado expone solo origen, clave y fecha. Si el proveedor toma el secreto de una variable de entorno, el `PUT` SHALL responder 422. Una variable de entorno definida tiene prioridad sobre la base.

#### Scenario: Guardar y consultar
- **WHEN** el administrador guarda una credencial para `fake` y pide `GET /api/admin/integrations`
- **THEN** el proveedor muestra `credential.source: "db"` con `keyId` y `updatedAt`, y el cuerpo no contiene la credencial

#### Scenario: Credencial por variable de entorno
- **WHEN** `FAKE_PROVIDER_TOKEN` está definida y el administrador hace el `PUT`
- **THEN** recibe 422 y la base no cambia

### Requirement: Snapshots con etag y hash de contenido
`ExternalSnapshot` SHALL guardar por proveedor y recurso el cuerpo, el `etag` y el `sha256` del contenido canónico. Un 304 SHALL actualizar solo `fetchedAt`; un cuerpo con el mismo hash SHALL informar que no cambió. Un cuerpo de más de 1 MiB MUST rechazarse como error permanente sin escribir.

#### Scenario: No modificado
- **WHEN** el proveedor responde 304 para un recurso con snapshot
- **THEN** cambia `fetchedAt` y no cambian `body`, `contentHash` ni `changedAt`

#### Scenario: Mismo contenido con otro etag
- **WHEN** llega un cuerpo igual al guardado, con las claves en otro orden
- **THEN** el resultado informa `changed: false` y `changedAt` no cambia

### Requirement: Clasificación de los fallos de un proveedor
Cada fallo de un proveedor SHALL clasificarse en `RetryAfter`, `ResetAt`, `Transient`, `Permanent` o `BudgetExhausted`. El clasificador HTTP genérico SHALL usar `Retry-After`, `X-RateLimit-Reset` y el campo `backoff`; los errores de red, timeouts y 5xx son `Transient`; 400, 401, 404 y 422 son `Permanent`.

#### Scenario: Límite con pista
- **WHEN** un proveedor responde 429 con `Retry-After: 120`
- **THEN** el fallo es `RetryAfter` con 120 segundos

#### Scenario: Cuota agotada hasta una hora
- **WHEN** responde 403 con `X-RateLimit-Remaining: 0` y `X-RateLimit-Reset` en epoch
- **THEN** el fallo es `ResetAt` con esa fecha

#### Scenario: Error de red
- **WHEN** la conexión se corta antes de la respuesta
- **THEN** el fallo es `Transient`

### Requirement: Presupuesto agotado de Anthropic
El clasificador de Anthropic SHALL mapear a `BudgetExhausted` el 429 `rate_limit_error` con `error.details.error_code` `enforced_spend_limit_reached` (con reinicio el día 1 del mes siguiente a las 00:00 UTC), el 400 `invalid_request_error` del spend limit de la Console y el 402 `billing_error`. Cualquier otro 400 MUST ser `Permanent`.

#### Scenario: Tope del tier
- **WHEN** llega un 429 `rate_limit_error` con `enforced_spend_limit_reached` el 15 de marzo
- **THEN** el fallo es `BudgetExhausted` con reinicio el 1 de abril a las 00:00 UTC

#### Scenario: Spend limit de la Console
- **WHEN** llega un 400 `invalid_request_error` cuyo mensaje informa el spend limit alcanzado
- **THEN** el fallo es `BudgetExhausted` sin fecha de reinicio

#### Scenario: Request mal formada
- **WHEN** llega un 400 `invalid_request_error` por un parámetro inválido
- **THEN** el fallo es `Permanent`, no `BudgetExhausted`

### Requirement: Secretos fuera de los mensajes de error
Todo mensaje de error de un proveedor SHALL pasar por una redacción que reemplace por `[Redacted]` el secreto del trabajo y los patrones `ghp_`, `gho_`, `github_pat_`, `sk-ant-`, `Bearer` y `token=`, y se trunque a 500 caracteres, antes de guardarse o escribirse en el log.

#### Scenario: Error que repite el token
- **WHEN** el proveedor `fake` falla con un mensaje que contiene `FAKE_PROVIDER_TOKEN`
- **THEN** ni `SyncRun.errorMessage`, ni `IntegrationJob.lastError`, ni ninguna línea del log contienen el token

#### Scenario: Fixtures limpios
- **WHEN** corre la suite de tests
- **THEN** ningún archivo de `backend/test/fixtures` ni de `docs/fixtures` contiene un token con forma `ghp_`, `github_pat_` o `sk-ant-`
