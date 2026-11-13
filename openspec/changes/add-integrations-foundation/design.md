# Design — add-integrations-foundation

## Context

Ver `proposal.md`. Estado verificado el 12 de noviembre de 2026 sobre `main` (`164e4ba`, sin changes activos):

- **Proceso de la API.** Un solo proceso Node 22 (`node dist/main`), una réplica en Railway, `drainingSeconds: 10` y `enableShutdownHooks()`. `PrismaService.onModuleDestroy` drena `BackgroundTasks` hasta 5 s (`SHUTDOWN_DRAIN_MS`) y después desconecta. El pool de Prisma usa el tamaño por defecto (`num_cpus * 2 + 1`); `DEPLOY.md` recomienda `?connection_limit=5` si algún día hay réplicas.
- **Tareas en segundo plano.** `BackgroundTasks` (`shared/application`) lanza promesas sin esperarlas y las drena al apagar; hoy solo registra visitas. No hay scheduler ni cola.
- **Config.** `env.validation.ts` valida con `class-validator` y suma reglas de producción que nombran la variable sin imprimir el valor. No hay reglas condicionales entre variables.
- **Logs.** `nestjs-pino` con `REDACTED_PATHS` y un serializador de `req` que no incluye el cuerpo. Fuera de una petición, los `Logger` de Nest no llevan contexto propio.
- **Errores.** `toHttpException` mapea `NotFoundError` → 404, `ValidationError` → 400, `ConflictError` → 409 y `RuleViolationError` → 422.
- **Panel.** `NAV` de `AdminShell.tsx` tiene nueve ítems; las páginas usan `PageHeader`, `EmptyState`/`ErrorPanel`/`LoadingRows`, `notifySuccess`/`notifyError` y TanStack Query.
- **Dependencias.** `@nestjs/schedule` no está instalado. En npm, la línea **6.1.x** declara `peerDependencies` `@nestjs/common` y `@nestjs/core` `^10 || ^11` (6.1.3, publicada el 2026-04-15, depende de `cron` 4.4.0); la línea 12.x acepta `^11 || ^12` y es la de Nest 12.
- **Railway.** Un deploy nuevo arranca, pasa el healthcheck y recién entonces el viejo recibe SIGTERM y tiene 10 s de drenaje: durante ese lapso **conviven dos procesos** con el mismo código y la misma base.

## Goals / Non-Goals

**Goals:** una base reutilizable para hablar con terceros que (1) nunca corra en el camino de una petición ni la demore, (2) ejecute cada trabajo una vez aunque convivan dos procesos, (3) reintente sin martillar y deje de intentar cuando el error es definitivo, (4) no deje un token en claro ni en la base ni en el log, y (5) le muestre al owner en el panel si algo dejó de sincronizar.

**Non-Goals:** ver `proposal.md` § Non-goals.

## Decisions

### D1 — Módulo `integrations` con un puerto por proveedor

```
modules/integrations/
├── domain/
│   ├── entities/            integration-job.entity.ts, integration-setting.entity.ts
│   ├── services/            next-retry-delay.ts, classify-http-failure.ts,
│   │                        classify-anthropic-error.ts, provider-health.ts
│   ├── provider-failure.ts  (unión discriminada, D9)
│   ├── errors/              unknown-provider, provider-disabled, credential-unreadable
│   └── repositories/        integration-job.repository.ts, integration-setting.repository.ts,
│                            sync-run.repository.ts, snapshot.repository.ts,
│                            credential.repository.ts, runner-lease.repository.ts
├── application/
│   ├── ports/               connector.port.ts, secret-cipher.port.ts, credential-resolver.port.ts
│   ├── use-cases/           list-integrations, enqueue-sync, set-integration-enabled,
│   │                        save-credential, delete-credential, plan-due-syncs, run-due-jobs
│   └── dto/
├── infrastructure/
│   ├── persistence/         adaptadores Prisma (cola con SQL crudo, D4 y D7)
│   ├── crypto/              aes-gcm-secret-cipher.ts, keyring.ts
│   ├── scheduler/           integrations-scheduler.ts (D2), integrations-shutdown.ts (D6)
│   ├── providers/fake/      fake.connector.ts (D11)
│   ├── providers/registry.ts
│   └── controllers/         admin-integrations.controller.ts y DTOs
└── integrations.module.ts
```

- `ConnectorPort` (application): `{ id: ProviderId; secretEnv: string | null; sync(ctx: SyncContext, signal: AbortSignal): Promise<Result<SyncOutcome, ProviderFailure>> }`. `SyncContext` trae el `payload` del trabajo, el secreto resuelto (D14), el `SnapshotStore` (D15) y un logger con contexto (D16). El conector **devuelve** el fallo clasificado; si lanza, el ejecutor lo trata como `Transient` con el mensaje redactado.
- El registro (`providers/registry.ts`) arma la lista de conectores **habilitados** a partir de `INTEGRATIONS_ENABLED`; un id que no está en el catálogo hace fallar el arranque (D11).
- `RunDueJobsUseCase` es el corazón: no conoce Nest ni Prisma; recibe los repositorios, el reloj, el registro y un `Yield` (D5) por token.
- Ningún módulo de la ruta pública importa `integrations`. Un caso nuevo en `test/architecture.spec.ts` lo verifica: nada bajo `modules/curated-profile`, `modules/profile` ni el composer importa de `modules/integrations`.

Alternativas descartadas:
- **Un módulo por proveedor con su propia cola.** Es lo que este change evita: tres formas de reintentar y de guardar tokens.
- **Meter la cola en `shared/`.** La cola tiene reglas de dominio (estados, reintentos, pausa por proveedor); `shared/` es para piezas sin dueño.

### D2 — `@nestjs/schedule` ~6.1.3, registrado a mano y apagado por defecto

- Se agrega `@nestjs/schedule@~6.1.3` a `dependencies` (misma convención `~` que el resto de `@nestjs/*`). Es la línea cuyo `peerDependencies` declara Nest 11 como versión propia; la 12.x es la línea de Nest 12 y la adopta el change que suba Nest.
- `ScheduleModule.forRoot()` se importa en `IntegrationsModule`, pero **no se usan los decoradores** `@Cron`/`@Interval`: registran siempre. `IntegrationsScheduler.onApplicationBootstrap()` agrega el `CronJob` del planificador y el intervalo del ejecutor con `SchedulerRegistry` **solo si** `INTEGRATIONS_SCHEDULER_ENABLED=true`. Con `false` (default) no hay timers: los tests, el desarrollo local y una réplica futura sin el flag no ejecutan nada.
- Se registra en `onApplicationBootstrap`, que corre después de que Prisma conectó y antes de `listen`; el primer tick llega a los 60 s, cuando el healthcheck ya pasó.
- El log de arranque dice `Integraciones: scheduler encendido (proveedores: fake)` o `Integraciones: scheduler apagado`.

Alternativas descartadas:
- **4.º servicio cron de Railway (`sync`).** Descartado por el owner (pregunta 3 = B, 2026-11-07).
- **Decoradores `@Cron`/`@Interval`.** No se pueden apagar por env sin un guard dentro del callback; el timer existiría igual en tests.
- **`setInterval` propio sin `@nestjs/schedule`.** Funciona, pero el owner eligió la librería y `SchedulerRegistry` da un punto único para detener todo al apagar.

### D3 — Planificador y ejecutor separados; HTTP solo encola

- **Planificador** (`PlanDueSyncsUseCase`): `CronJob` con `INTEGRATIONS_SYNC_CRON` (default `0 10 * * *`, **UTC**, 06:00 en Bolivia; ver P2). Por cada proveedor habilitado por env y por `IntegrationSetting.enabled`, encola `sync:<provider>:daily:<AAAA-MM-DD>` con `INSERT … ON CONFLICT ("idempotencyKey") DO NOTHING`. Si dos procesos disparan el cron a la vez, se crea un solo trabajo. Después aplica la retención (D23) y emite el aviso de 48 h (D17).
- **Ejecutor** (`RunDueJobsUseCase`): intervalo de `INTEGRATIONS_TICK_SECONDS` (default 60). Cada tick, si no hay una corrida en curso **en este proceso**, lanza una (D4, D5) y **no la espera**: el callback del timer termina en microsegundos y la corrida queda registrada en `BackgroundTasks` (D6).
- **«Sincronizar ahora»** (`EnqueueSyncUseCase`): si el proveedor ya tiene un trabajo `PENDING`, `RUNNING` o `FAILED`, devuelve ese con `alreadyQueued: true`; si no, encola `sync:<provider>:manual:<AAAA-MM-DDTHH:MM>` (dos clics en el mismo minuto chocan en la clave). Responde **202** con `{ jobId, status, runAt, alreadyQueued }`. El trabajo corre en el próximo tick (≤ 60 s). La petición hace dos consultas cortas y nunca llama al conector.

Alternativa descartada: **ejecutar «Sincronizar ahora» en la petición o despertar al ejecutor desde ella.** Ata la latencia de la petición a la del tercero y saltea el arriendo de D4.

### D4 — Ejecutor único: arriendo en una fila más `SKIP LOCKED` en cada reclamo

**Arriendo de la corrida.** Tabla `IntegrationRunnerLease { id = 'runner', holder, expiresAt }` con una sola fila (la crea la migración). Al empezar una corrida:

```sql
UPDATE "IntegrationRunnerLease"
   SET holder = $1, "expiresAt" = now() + $2::interval
 WHERE id = 'runner' AND ("expiresAt" < now() OR holder = $1)
RETURNING holder;
```

- Sin fila devuelta, otra instancia tiene el arriendo: este tick no hace nada (log `debug`). `holder` es `<hostname>:<pid>:<uuid del arranque>`.
- TTL del arriendo = `INTEGRATIONS_RUN_MAX_MS` + 60 s. Se **renueva** con el mismo `UPDATE` antes de reclamar cada trabajo; si la renovación falla, la corrida termina sin reclamar más.
- Al terminar (o al apagar, D6) se libera: `UPDATE … SET "expiresAt" = now() WHERE id = 'runner' AND holder = $1`.
- Si el proceso muere sin liberar, el arriendo vence solo y el siguiente tick de cualquier instancia lo toma.

**Reclamo de cada trabajo**, en una transacción corta:

```sql
UPDATE "IntegrationJob" SET status = 'RUNNING', "lockedBy" = $1,
       "lockedUntil" = now() + $2::interval, attempts = attempts + 1, "updatedAt" = now()
 WHERE id = (SELECT id FROM "IntegrationJob"
              WHERE status IN ('PENDING','FAILED') AND "runAt" <= now()
                AND provider = ANY($3)
              ORDER BY "runAt", "createdAt"
              FOR UPDATE SKIP LOCKED LIMIT 1)
RETURNING *;
```

`$3` son los proveedores habilitados y no pausados (D10). `lockedUntil` = timeout del trabajo + 30 s de gracia.

**Por qué no un advisory lock.** `pg_try_advisory_lock` es de sesión: queda atado a una conexión física, y Prisma entrega una conexión del pool distinta en cada consulta, así que el `unlock` puede ir a otra conexión y fallar en silencio. `pg_try_advisory_xact_lock` exige mantener **una transacción abierta toda la corrida**: retiene una conexión del pool que las peticiones necesitan (con el pool por defecto de un contenedor chico son pocas) y una transacción larga frena el vacuum. El arriendo en una fila usa una conexión unos milisegundos por consulta, sobrevive a un `kill -9` (vence solo) y es visible para diagnosticar (`SELECT * FROM "IntegrationRunnerLease"`).

**Por qué además `SKIP LOCKED`.** Es la segunda barrera: aunque el arriendo fallara (reloj, bug), dos procesos no pueden reclamar la misma fila. Y deja el camino abierto a concurrencia mayor que 1 sin rediseñar.

**Deploy solapado.** El proceso viejo, en drenaje, conserva el arriendo hasta liberarlo (D6) o hasta que venza; el nuevo saltea sus ticks mientras tanto. Con réplicas, la que tenga el arriendo ejecuta y las demás no.

**En el mismo proceso** un flag `running` evita solapar corridas: un tick que llega con una corrida en curso se descarta.

Alternativas descartadas:
- **Advisory lock de sesión o de transacción.** Ver arriba.
- **Solo `SKIP LOCKED`, sin arriendo.** Permite que dos instancias ejecuten trabajos distintos del mismo proveedor a la vez (dos clientes contra GitHub en paralelo), que es lo que la propuesta pide evitar («a GitHub se le pega en serie»).

### D5 — Presupuesto del ejecutor: nada que compita con las peticiones

| Límite | Valor | Variable |
|---|---|---|
| Concurrencia | 1 trabajo a la vez por proceso (y global, por D4) | fija |
| Timeout por trabajo | 120 s | `INTEGRATIONS_JOB_TIMEOUT_MS` (5 000 a 600 000) |
| Duración máxima de una corrida | 300 s: después no se reclaman más trabajos | `INTEGRATIONS_RUN_MAX_MS` (10 000 a 1 800 000) |
| Trabajos por corrida | 20 | fija |
| Tamaño de un snapshot | 1 MiB del cuerpo serializado | fija (D15) |
| Tick del ejecutor | 60 s | `INTEGRATIONS_TICK_SECONDS` (10 a 3 600) |

- **Timeout por trabajo:** el ejecutor crea un `AbortController`, pasa la señal al conector y corre `Promise.race` contra un temporizador. Al vencer aborta y registra `Transient` con `timeout`. Si el conector ignora la señal, su promesa queda huérfana: el ejecutor no la espera, el trabajo ya quedó cerrado y su `lockedUntil` evita que otro lo reclame mientras tanto. Los conectores reales (`fetch`) **tienen** que pasar la señal: lo exige la suite de contrato de cada uno.
- **El event loop no se bloquea:** todo es I/O asíncrono (Prisma, `fetch`). Entre un trabajo y el siguiente el ejecutor cede con `await new Promise(setImmediate)` (puerto `Yield`, inyectable en tests). Lo único sincrónico es `sha256` del snapshot (≤ 1 MiB, unos milisegundos) y el cifrado AES-GCM de una credencial (bytes). Nada de `JSON.parse` de cuerpos sin tope: el conector rechaza antes un cuerpo mayor que el tope (`Permanent`).
- **El pool de conexiones:** el ejecutor hace consultas sueltas y transacciones de una sola sentencia; nunca retiene una conexión mientras espera al tercero. En el peor caso usa **una** conexión a la vez.
- **Los timers no retienen el proceso** al apagar: se detienen en D6.

Alternativa descartada: **`worker_threads` para los trabajos.** Aísla CPU que no hay: el trabajo es I/O. Suma serialización, otro pool de Prisma y otro lugar donde puede vivir un secreto.

### D6 — Apagado ordenado dentro del drenaje de 10 s

- `IntegrationsShutdown` implementa `onModuleDestroy`: detiene el cron y el intervalo (`SchedulerRegistry`), marca `stopping` para que la corrida no reclame más y aborta la señal del trabajo en curso.
- La corrida está registrada en `BackgroundTasks` (`background.run('integrations-run', …)`). Como `PrismaService.onModuleDestroy` drena `BackgroundTasks` antes de desconectar, la corrida **siempre** termina de escribir antes de que se cierre la base, sea cual sea el orden en que Nest llame a los hooks.
- Un trabajo interrumpido por el apagado vuelve a `PENDING` con `runAt = now()`, sin consumir el intento (`attempts - 1`), `SyncRun.outcome = INTERRUPTED`, y el arriendo se libera. Si el conector no reacciona a la señal en 3 s, el ejecutor hace eso mismo sin esperarlo.
- Presupuesto: 3 s del trabajo + escrituras cortas, dentro de los 5 s del drenaje de `BackgroundTasks`, dentro de los 10 s de Railway.

Alternativa descartada: **esperar a que el trabajo termine.** Un trabajo de hasta 120 s no entra en 10 s; Railway mataría el proceso con el trabajo en `RUNNING` y habría que esperar a que venza su lock.

### D7 — `IntegrationJob`: estados, intentos e idempotencia

| Campo | Tipo | Regla |
|---|---|---|
| `id` | cuid | |
| `provider` | texto | id del catálogo (D11) |
| `kind` | texto | `sync` en este change |
| `idempotencyKey` | texto `@unique` | D3 |
| `payload` | Json | ≤ 8 KiB; sin secretos (lo valida el caso de uso) |
| `status` | `IntegrationJobStatus` | ver tabla |
| `attempts` / `maxAttempts` | entero | 0 / 8 |
| `runAt` | instante | cuándo puede reclamarse |
| `lockedBy`, `lockedUntil` | texto, instante | solo en `RUNNING` |
| `lastErrorClass`, `lastError` | texto | redactado y ≤ 500 caracteres (D16) |
| `createdAt`, `updatedAt`, `finishedAt` | instantes | |

Índices: `(status, runAt)`, `(provider, status)`.

| Desde | Hacia | Cuándo |
|---|---|---|
| `PENDING` | `RUNNING` | reclamo (D4) |
| `FAILED` | `RUNNING` | reclamo con `runAt` vencido |
| `RUNNING` | `DONE` | éxito |
| `RUNNING` | `FAILED` | `RetryAfter`, `ResetAt` o `Transient` con intentos disponibles; `runAt` = D8 |
| `RUNNING` | `DEAD` | `Permanent`, `BudgetExhausted` o intentos agotados |
| `RUNNING` | `PENDING` | apagado (D6) |
| `RUNNING` (lock vencido) | `FAILED` o `DEAD` | recuperación al inicio de cada corrida |

- **Lock vencido:** al tomar el arriendo, la corrida ejecuta `UPDATE … WHERE status = 'RUNNING' AND "lockedUntil" < now()` y pasa esas filas a `FAILED` (`lastErrorClass = 'Transient'`, `lastError = 'lock vencido'`, `runAt` = D8) o a `DEAD` si `attempts >= maxAttempts`. Como el intento se cuenta al reclamar, un trabajo que tira el proceso abajo una y otra vez termina en `DEAD`.
- La tabla de transiciones vive en el dominio (`IntegrationJob.complete`, `fail`, `release`) y se prueba entera.

### D8 — `nextRetryDelay`: jitter completo, base 30 s, tope 6 h

```
nextRetryDelay(attempt, random) = floor(random() * min(6 h, 30 s * 2^(attempt - 1)))
```

- Función pura del dominio; `random` es inyectable (tests deterministas) y por defecto `Math.random`. `attempt` empieza en 1. Para evitar `0`, el mínimo efectivo es 1 s.
- `RetryAfter { seconds }` y `ResetAt { at }` **ignoran el jitter**: `runAt = now + seconds` o `runAt = at` (más un margen de 1 a 5 s al azar para no llegar todos al mismo instante), sin tope de 6 h: el tercero sabe cuándo vuelve.

Alternativa descartada: **jitter «igual» o decorrelacionado.** Con un solo proceso y pocos trabajos no hay manada; el jitter completo es el más simple y el que pide la propuesta.

### D9 — Clasificación de errores en el dominio

`ProviderFailure` es una unión discriminada (dominio, sin dependencias):

| Clase | Campos | Efecto |
|---|---|---|
| `RetryAfter` | `seconds`, `message` | `FAILED`; `runAt` por la pista; pausa el proveedor (D10) |
| `ResetAt` | `at`, `message` | igual, hasta `at` |
| `Transient` | `message` | `FAILED`; `runAt` por D8; suma al breaker (D10) |
| `Permanent` | `message` | `DEAD` |
| `BudgetExhausted` | `resetAt?`, `message` | `DEAD`; pausa el proveedor hasta `resetAt` si viene |

**`classifyHttpFailure({ status, headers, body?, networkError? })`**, genérico, para los adaptadores HTTP:
- error de red, timeout, 408, 425, 500, 502, 503, 504 → `Transient`;
- 429 con `Retry-After` en segundos o fecha HTTP → `RetryAfter`; 429 o 403 con `X-RateLimit-Remaining: 0` y `X-RateLimit-Reset` (epoch) → `ResetAt`; 429 sin pistas → `Transient`;
- 400, 401, 403 (sin las cabeceras anteriores), 404, 410, 422 → `Permanent`;
- un campo `backoff` en el cuerpo (Stack Exchange) → `RetryAfter`.

**`classifyAnthropicError({ status, body })`**, para 2.0 (criterio de la propuesta):
- **429** con `error.type = "rate_limit_error"` y `error.details.error_code = "enforced_spend_limit_reached"` → `BudgetExhausted` con `resetAt` = día 1 del mes siguiente a las 00:00 UTC;
- **400** con `error.type = "invalid_request_error"` cuyo `message` coincide con `/spend limit|usage limit/i` → `BudgetExhausted` sin `resetAt` (el tope lo levanta el owner en la Console);
- **402** `billing_error` → `BudgetExhausted` sin `resetAt`;
- cualquier otro **400** → `Permanent` (request mal formada: reintentar no la arregla);
- otro 429 → `RetryAfter` con `retry-after` si viene, si no `Transient`; 500, 529 y errores de red → `Transient`.

La forma exacta del texto del 400 de la Console **no está confirmada** en la documentación que se pudo consultar (P4): el test fija las dos formas con fixtures marcados «forma supuesta, reconfirmar en `add-ai-foundation`», y un 400 con otro texto queda como `Permanent`, que tampoco se reintenta. El riesgo de equivocarse es solo la etiqueta, no un reintento.

Alternativa descartada: **clasificar por status solo.** Mezcla el corte de presupuesto con un 400 genérico, que es justo el riesgo que nombra la propuesta (§ 8).

### D10 — Pausa por proveedor y circuit breaker, persistidos

`IntegrationSetting { provider @id, enabled (default true), pausedUntil?, pauseReason?, consecutiveFailures (0), lastSuccessAt?, enabledSince, updatedAt }`, una fila por proveedor, creada al primer uso (upsert).

- `RetryAfter`/`ResetAt`/`BudgetExhausted` con fecha → `pausedUntil` = esa fecha, `pauseReason` = la clase. El límite de un tercero es del proveedor, no del trabajo: los demás trabajos del mismo proveedor esperan.
- **Breaker:** 5 `Transient` seguidos del mismo proveedor → `pausedUntil = now + nextRetryDelay(5)` (abierto). Vencida la pausa, el siguiente trabajo pasa (semiabierto): si sale bien, `consecutiveFailures = 0` (cerrado); si falla, vuelve a abrir con el intento siguiente (tope 6 h).
- El reclamo (D4) excluye los proveedores con `enabled = false` o `pausedUntil > now()`.
- Persistido en la base y no en memoria, para que lo vean todas las instancias y sobreviva a un deploy.

Alternativa descartada: **breaker en memoria (p. ej. `opossum`).** Dependencia nueva y estado que se pierde en cada deploy y no comparten las réplicas.

### D11 — Flags: catálogo, `INTEGRATIONS_ENABLED`, kill switches

- **Catálogo** (constante del dominio): por ahora solo `fake`. Cada change de proveedor suma su id y su `secretEnv` (variable opcional del secreto).
- **`INTEGRATIONS_ENABLED`**: lista separada por comas de ids (default vacío). Un id fuera del catálogo hace fallar el arranque nombrando la variable. **El secreto de un proveedor NO se exige al arrancar** (enmienda del 2026-11-12, abajo): `fake` declara `secretEnv: 'FAKE_PROVIDER_TOKEN'`, una variable opcional.
- **`fake` está prohibido con `NODE_ENV=production`**: el arranque falla nombrando `INTEGRATIONS_ENABLED`.
- **`INTEGRATIONS_KEYS` e `INTEGRATIONS_ACTIVE_KEY`** se exigen solo si `INTEGRATIONS_ENABLED` no está vacía (D12).
- **Kill switch global por proceso:** `INTEGRATIONS_SCHEDULER_ENABLED` (`true`/`false`, default `false`, P1). Apagado, no hay timers; la API del panel sigue respondiendo y «Sincronizar ahora» encola (el trabajo espera a que algún proceso con el scheduler encendido lo tome; el panel lo dice).
- **Kill switch por proveedor sin redeploy:** `IntegrationSetting.enabled`, desde el panel (Pausar/Reanudar). Pausar no cancela un trabajo en curso; impide reclamar los siguientes y que el planificador encole.
- **Apagado total:** `INTEGRATIONS_ENABLED` vacía (no hay conectores) o `INTEGRATIONS_SCHEDULER_ENABLED=false` (no hay ejecución).

**Enmienda a D11 (2026-11-12, decisión de la sesión principal).** `requiredEnv` pasa a `secretEnv`: la variable del secreto de un proveedor habilitado es **opcional** y ya no se exige al arrancar. Siguen siendo obligatorias `INTEGRATIONS_KEYS` e `INTEGRATIONS_ACTIVE_KEY` cuando la lista no está vacía (sin ellas no se puede cifrar la credencial de la base), y siguen fallando el arranque un id desconocido y `fake` en producción. D14 no cambia (variable primero, base después, si no hay ninguna el trabajo termina `DEAD` «falta la credencial»; con la variable definida el `PUT` da 422); el panel muestra «Falta la credencial» con el formulario a la vista. **Motivo:** el formulario del panel es utilizable en un arranque normal y no se fuerzan secretos en las variables de Railway; los proveedores reales (GitHub) siguen el mismo modelo. Reemplaza el desvío 1 de `verification/verification.md`.

Alternativa descartada: **una variable `*_ENABLED` por proveedor.** Con la lista, la regla «secreto solo si está habilitado» es una sola función y un id mal escrito falla al arrancar.

### D12 — `SecretCipher`: AES-256-GCM con keyring

- Puerto en `application/ports/secret-cipher.port.ts`: `encrypt(plain: string, aad: string): string` y `decrypt(payload: string, aad: string): Result<string, CredentialUnreadableError>`, más `activeKeyId` y `needsRekey(payload)`.
- Implementación `AesGcmSecretCipher` (infraestructura, `node:crypto`): IV de 12 bytes aleatorio por cifrado, tag de 16 bytes, formato `v1.<kid>.<iv b64url>.<tag b64url>.<ct b64url>`. **AAD = `integration-credential:<provider>`**: una credencial copiada a la fila de otro proveedor no descifra.
- **Keyring:** `INTEGRATIONS_KEYS="k1:<base64 de 32 bytes>,k2:<…>"`; `kid` con `^[a-z0-9]{1,16}$`; cada clave exactamente 32 bytes; ids sin repetir. `INTEGRATIONS_ACTIVE_KEY` tiene que estar en el keyring. Se cifra siempre con la activa y se descifra con la que nombra el payload.
- En producción, además, ninguna clave puede ser la del `.env.example` ni repetir el `JWT_SECRET`. Los mensajes nombran la variable y nunca imprimen el valor.
- Una clave que falta en el keyring o un tag inválido → `CredentialUnreadableError`; el trabajo pasa a `DEAD` con `Permanent` («credencial ilegible: reingresala o corré integrations:rekey») y nunca se imprime el payload.

Alternativa descartada: **`pgcrypto` en la base.** La clave viajaría en cada consulta y quedaría en los logs de Postgres.

### D13 — `npm run integrations:rekey`, idempotente

- Script `backend/scripts/integrations-rekey.ts` con la misma convención que `views:reclassify`: **simulación por defecto** (lista cuántas filas están con otra clave, por `kid`), `-- --apply` escribe.
- Con `--apply`, cada fila se descifra con su clave y se cifra con la activa en un `UPDATE … WHERE id = $1 AND ciphertext = $old` (si alguien la cambió en el medio, se saltea y se cuenta). Correrlo dos veces: la segunda dice `0 filas para recifrar` y sale con 0.
- Salida 2 si alguna fila nombra un `kid` que no está en el keyring (no la toca) o si falta la configuración. Nunca imprime secretos.
- Procedimiento de rotación en `DEPLOY-RAILWAY.md`: agregar `k2` al keyring → `INTEGRATIONS_ACTIVE_KEY=k2` → redeploy → `integrations:rekey -- --apply` desde la terminal → quitar `k1`.

### D14 — Credenciales: variable de entorno primero, base cifrada después, API de solo escritura

- `CredentialResolver.resolve(provider)`: si el proveedor declara una variable de secreto y está definida, usa esa (`source: 'env'`); si no, descifra `IntegrationCredential` (`source: 'db'`); si no hay ninguna, el trabajo termina en `DEAD` con `Permanent` («falta la credencial»).
- `IntegrationCredential { provider @id, ciphertext, keyId, createdAt, updatedAt }`. Nunca se devuelve el `ciphertext` ni el secreto por la API: el estado expone solo `{ source, keyId, updatedAt }`.
- `PUT /api/admin/integrations/:provider/credential` `{ secret }` (1 a 4 096 caracteres, sin espacios al borde) → 204; `DELETE` → 204. Con una variable de entorno definida para ese proveedor, el `PUT` responde 422 («la credencial de este proveedor viene de una variable de entorno»), para no tener dos fuentes que diverjan.
- `secret` se agrega a la redacción del log (D16) y la respuesta lleva `Cache-Control: no-store`.

Alternativa descartada: **solo variables de entorno** (sin tabla). Los tokens emitidos por OAuth (LinkedIn) no pueden vivir en una variable; la tabla y el cifrado son la base que la propuesta pide (§ 5.3). La tabla se estrena con `fake` y sus tests.

### D15 — `ExternalSnapshot` y `SnapshotStore`

- `ExternalSnapshot { id, provider, resourceKey, etag?, contentHash, body Json, fetchedAt, changedAt }`, `@@unique([provider, resourceKey])`.
- `SnapshotStore` (puerto en `application`): `get(provider, resourceKey)` (para mandar `If-None-Match`), `recordNotModified(provider, resourceKey, fetchedAt)` (un 304: **solo** `fetchedAt`) y `record(provider, resourceKey, { etag, body })` → `{ changed: boolean }`. `contentHash` = `sha256` hex del JSON canónico (claves ordenadas); si coincide con el guardado, solo se actualizan `fetchedAt` y `etag`, y `changed = false`.
- Cuerpo serializado > 1 MiB → `Permanent` («snapshot demasiado grande»), sin escribir.
- Los snapshots no los lee la ruta pública: los changes de proveedor los proyectan a sus propias tablas. El test de arquitectura de D1 lo cubre.

### D16 — `SyncRun`, contexto del log y redacción

- `SyncRun { id, jobId, provider, startedAt, finishedAt?, outcome (SUCCESS | FAILED | DEAD | INTERRUPTED | TIMEOUT), errorClass?, errorMessage?, itemsChanged (0), durationMs? }`, una por intento, índice `(provider, startedAt desc)`.
- El ejecutor crea un logger hijo de pino con `{ syncRunId, jobId, provider }` (vía `PinoLogger` de `nestjs-pino`, en infraestructura) y lo pasa al conector en `SyncContext`. Todas las líneas del trabajo lo llevan.
- **`redactSecrets(text, knownSecrets)`** (puro, `shared/domain/redact-secrets.ts`): reemplaza por `[Redacted]` los valores exactos de `knownSecrets` (el secreto resuelto del trabajo y, si existe, su forma en base64) y los patrones `ghp_…`, `gho_…`, `github_pat_…`, `sk-ant-…`, `Bearer <…>` y `token=<…>`. Se aplica a todo `message` de un `ProviderFailure`, a lo que el conector lanza y a `lastError`/`errorMessage` antes de guardarlos; después se trunca a 500 caracteres.
- `REDACTED_PATHS` suma `secret`, `req.body.secret`, `ciphertext`, `credential` y `token`.
- Un test recorre `backend/test/fixtures` y `docs/fixtures` y falla si encuentra `ghp_`, `github_pat_` o `sk-ant-` seguidos de 20 o más caracteres válidos (riesgo «Se filtra un token» de la propuesta).

### D17 — Aviso de más de 48 h sin una corrida exitosa

- `isProviderStale(setting, now)` (puro): habilitado por env y por `IntegrationSetting.enabled`, y (`lastSuccessAt` es nulo y `enabledSince` tiene más de 48 h) o `lastSuccessAt` tiene más de 48 h. El umbral es una constante (`STALE_AFTER_HOURS = 48`), no una variable.
- Se muestra en el panel (D19) como «Sin sincronizar hace más de 48 h» y en la API como `stale: true`.
- El planificador emite un `warn` por proveedor atrasado en cada corrida diaria (`{ provider, lastSuccessAt }`), sin secretos.
- Un proveedor pausado a mano no se marca como atrasado (la pausa es intencional); uno pausado por el breaker sí.

### D18 — API del panel bajo `/api/admin/integrations`

Con `JwtAuthGuard` y `adminValidationPipe`, `Cache-Control: no-store` en todas:

| Método y ruta | Respuesta |
|---|---|
| `GET /api/admin/integrations` | `{ schedulerEnabled, providers: IntegrationStatus[] }` |
| `POST /api/admin/integrations/:provider/sync` | 202 `{ jobId, status, runAt, alreadyQueued }` |
| `PATCH /api/admin/integrations/:provider` `{ enabled }` | 200 `IntegrationStatus` |
| `PUT /api/admin/integrations/:provider/credential` `{ secret }` | 204 |
| `DELETE /api/admin/integrations/:provider/credential` | 204 |

`IntegrationStatus`: `{ provider, enabled, pausedUntil, pauseReason, stale, lastSuccessAt, lastRun: { outcome, startedAt, finishedAt, errorClass, errorMessage } | null, jobs: { pending, running, failed, dead }, lastDeadError: string | null, credential: { source: 'env' | 'db' | null, keyId, updatedAt } }`. Solo aparecen los proveedores de `INTEGRATIONS_ENABLED`.

Errores: proveedor fuera de `INTEGRATIONS_ENABLED` → 404; «Sincronizar ahora» con el proveedor pausado a mano → 422 (`RuleViolationError`); campo desconocido → 400; sin sesión → 401. El conteo por estado es un solo `groupBy`.

### D19 — Pantalla Integraciones (`/admin/integraciones`)

- **Sin ítem en `NAV`** (D25). Ruta `/admin/integraciones` en `BackofficeApp.tsx`, protegida igual que las demás, en el chunk del panel; se llega desde **Cuenta** y desde el aviso del Dashboard.
- Aviso arriba si `schedulerEnabled = false`: «El scheduler está apagado en este servidor: lo que encoles queda en espera.»
- Una tarjeta por proveedor: estado por **texto e insignia** (Activo, En pausa hasta …, Pausado, Sin sincronizar hace más de 48 h), última corrida, última exitosa, conteos de la cola, último error de un trabajo `DEAD`, origen de la credencial.
- Botones: **Sincronizar ahora** (POST; aviso «Encolado: corre en el próximo minuto.» o «Ya había una sincronización en cola.»), **Pausar**/**Reanudar** (PATCH) y, si la credencial no viene de una variable de entorno, un campo de contraseña **Credencial** con **Guardar** y **Borrar** (con `ConfirmDialog`). El campo nunca se rellena con el valor guardado.
- Sin proveedores: «No hay integraciones habilitadas. Se activan con la variable `INTEGRATIONS_ENABLED` del servidor.»
- Refresco: `refetchInterval` de 15 s solo mientras haya trabajos `pending` o `running`.
- Mensajes de validación del formulario (Zod): vacío → «Ingresá la credencial.»; más de 4 096 → «La credencial no puede superar 4096 caracteres.»

### D20 — CLI manual `npm run integrations:sync`, sin servicio de Railway

- `backend/scripts/integrations-sync.ts` arranca un contexto de aplicación de Nest **sin HTTP** (`NestFactory.createApplicationContext`) con `INTEGRATIONS_SCHEDULER_ENABLED` ignorado, ejecuta **una** corrida de `RunDueJobsUseCase` (mismo arriendo de D4) y termina.
- Opciones: `--provider <id>` encola antes un trabajo manual de ese proveedor; `--plan` corre antes el planificador.
- Salida 0 si la corrida terminó (aunque algún trabajo haya fallado y quede `FAILED`), 1 si algún trabajo quedó `DEAD` en esta corrida, 2 si la configuración es inválida o el arriendo lo tiene otra instancia.
- Reemplaza el criterio «`sync` termina con código 0» de la propuesta, que asumía el servicio aparte. No hay `railway.sync.json`.

Alternativa descartada: **no tener CLI.** Diagnosticar un proveedor real exigiría esperar al tick con el scheduler encendido en el entorno.

### D21 — Migración aditiva

`<timestamp>_add_integrations_foundation`: `CREATE TYPE` de los dos enums, `CREATE TABLE` de las seis tablas, sus índices y el `INSERT` de la fila `runner` en `IntegrationRunnerLease` con `expiresAt` en el pasado. Sin `ALTER` ni `DROP` sobre tablas existentes, sin FK hacia ellas. `SyncRun.jobId` es FK a `IntegrationJob` con `ON DELETE CASCADE` (la retención borra en cascada).

### D22 — Medir que una petición no se demora mientras corre un trabajo

- **E2e `test/integrations-latency.e2e-spec.ts`** con la app completa, el scheduler encendido con un tick corto (10 s, mínimo permitido; el test llama a la corrida directamente para no esperar) y el conector `fake` en el escenario `slow`: 3 s en 30 pasos de `setTimeout(100)` y, en cada paso, 5 ms de trabajo sincrónico (simula parsear una página de respuesta).
  1. Línea de base: 40 `GET /health/live` secuenciales sin trabajo.
  2. Con el trabajo corriendo: otras 40.
  3. Se exige **p95 ≤ línea de base + 25 ms** y **máximo ≤ 150 ms**, y `monitorEventLoopDelay` (resolución 10 ms) con **p99 ≤ 50 ms** durante el trabajo.
- **Unitario del tick:** el callback del intervalo vuelve en menos de 5 ms aunque la corrida tarde 2 s (no la espera) y un segundo tick con la corrida en curso no lanza otra.
- **Unitario del ejecutor:** entre dos trabajos se llama a `Yield` una vez; con `INTEGRATIONS_RUN_MAX_MS` vencido no se reclama otro.
- **E2e de «Sincronizar ahora»:** responde 202 y el conector **no** fue llamado (contador del `fake` en 0) hasta la corrida siguiente.
- Los umbrales son holgados para el runner del CI; si el p95 fallara por ruido, se sube la cantidad de muestras, no el umbral.

### D23 — Retención

En cada corrida del planificador: borrar `IntegrationJob` en `DONE` con `finishedAt` de más de 30 días (sus `SyncRun` caen en cascada) y `SyncRun` de más de 90 días de cualquier trabajo. `DEAD` se conserva 90 días para que el owner lo vea. Una sola sentencia por tabla.

### D24 — El proveedor `fake`

- `FakeConnector` (`infrastructure/providers/fake/`), con `secretEnv: 'FAKE_PROVIDER_TOKEN'` (opcional). Lee `payload.scenario`: `ok` (default; escribe un snapshot `fake:items` con un contador), `not-modified`, `slow`, `transient`, `permanent`, `retry-after`, `reset-at`, `budget`, `throw` (lanza en vez de devolver), `leak-secret` (falla con un mensaje que contiene el token) y `ignore-abort` (no escucha la señal).
- Expone, solo para tests, un contador de llamadas por escenario.
- Lo usan los e2e, `manual:capture` sobre la base de ejemplo y el TC-49. En producción no puede habilitarse (D11).

### D25 — La pantalla no suma un ítem a la navegación del panel

Ajuste de la sesión principal (2026-11-12). `NAV` ya tiene nueve ítems, otros changes en paralelo agregan secciones y a 1280 px no entra uno más.

- `NAV` de `AdminShell.tsx` **no cambia**. La ruta `/admin/integraciones` existe y exige sesión exactamente igual que el resto del panel.
- **Desde Cuenta** (`/admin/cuenta`): un bloque propio «Integraciones» con un enlace «Integraciones» a la pantalla.
- **Desde el Dashboard:** un aviso con enlace a la pantalla, visible solo si algún proveedor tiene `stale: true` o `jobs.dead > 0` («Hay integraciones que requieren atención»). El Dashboard consulta `GET /api/admin/integrations` (una consulta corta, sin conectores); si falla o no hay proveedores, no muestra nada.
- La pantalla lleva un enlace «Volver a Cuenta».

Alternativa descartada: **décimo ítem en `NAV`.** Ver arriba.

## Risks / Trade-offs

- **[Los trabajos viven en el proceso de la API]** → D4, D5 y D6 acotan qué puede ocupar: una conexión a la vez, sin CPU sincrónica relevante, con timeouts. D22 lo mide. Si un proveedor futuro necesitara CPU (p. ej. parsear un ZIP grande), ese change tiene que justificarlo o moverlo a un proceso aparte; queda escrito en `ARCHITECTURE.md`.
- **[Un conector que ignora la señal de aborto]** → su promesa sigue viva hasta que el tercero responda; el trabajo ya quedó cerrado. La suite de contrato de cada proveedor real exige que `fetch` reciba la señal (escenario `ignore-abort` del `fake` prueba que el ejecutor no se cuelga).
- **[Reloj de la base contra reloj del proceso]** → el arriendo y los locks usan `now()` de Postgres; `runAt` lo calcula el dominio con el reloj del proceso. Una deriva de segundos solo adelanta o atrasa un reintento.
- **[Tick cada 60 s con nada que hacer]** → dos sentencias indexadas por minuto (el arriendo y el reclamo vacío). Despreciable frente al tráfico; con el scheduler apagado, cero.
- **[Pérdida del keyring]** → las credenciales en la base quedan ilegibles (`DEAD` con mensaje claro); se reingresan desde el panel. Las de variables de entorno no dependen del keyring. `DEPLOY-RAILWAY.md` pide guardar las claves en el gestor.
- **[Barra del panel saturada]** → D25: la pantalla no suma un ítem a `NAV`; se llega desde Cuenta y desde el aviso del Dashboard. `a11y:check` recorre la ruta nueva.
- **[El texto del 400 de la Console es una suposición]** → P4; el error de etiqueta solo cambia `BudgetExhausted` por `Permanent`, y ninguno de los dos se reintenta.
- **[Changes en paralelo]** → TC-49 es de este change; el número de pantalla del backoffice (B17) puede chocar en `docs/MANUAL.md`: se toma el siguiente libre al implementar y se resuelve en el merge.

### Revisión de seguridad y su resolución (2026-11-12)

Una revisión independiente no halló hallazgos críticos ni altos. Se corrigieron:

- **M1.** `INTEGRATIONS_KEYS` con claves y sin `INTEGRATIONS_ACTIVE_KEY` tiraba la API al instanciar el cifrador. Ahora la clave activa se exige siempre que haya claves (o proveedores) y, como defensa, sin proveedores habilitados el keyring se arma vacío.
- **M2.** Pistas del tercero sin tope (NaN, años de pausa). `sanitizeFailure` (dominio) las normaliza antes de usarlas: no finito o fecha inválida pasa a `Transient`; `RetryAfter` ≤ 24 h; `ResetAt`/`BudgetExhausted` ≤ 7 días; fecha pasada = ahora. Los clasificadores no devuelven fechas inválidas y reanudar un proveedor ya habilitado limpia pausa y breaker.
- **M3.** El ejecutor dejaba un listener anónimo por trabajo en la señal de apagado del proceso (retenía el secreto). Hay un handler con nombre, quitado en el `finally`.
- **M4.** Podía haber varios trabajos activos por proveedor. Se agregó, en la propia migración (aún sin fusionar), el índice único parcial `IntegrationJob(provider, kind) WHERE status IN ('PENDING','RUNNING','FAILED')`; `enqueue` usa `ON CONFLICT DO NOTHING` sin objetivo y devuelve el existente (`alreadyQueued: true`), y el planificador lo respeta. `kind` hoy es siempre `sync` (manual y diario conviven bajo la misma regla: a lo sumo uno activo); un tipo futuro podrá tener el suyo. Prisma no modela índices parciales: `migrate diff` da sin diferencias.
- **B1.** `save` es condicional (`id`, `RUNNING` y `lockedBy`) y devuelve si escribió; si no, el resultado se descarta, se loguea y el intento queda `INTERRUPTED`.
- **B2.** `INTEGRATIONS_JOB_TIMEOUT_MS` ≤ `INTEGRATIONS_RUN_MAX_MS` se valida al arrancar.
- **B3.** La mutación de la credencial usa `gcTime: 0` y `reset()` al terminar; el campo lleva `autoComplete="new-password"`.
- **B4.** El logger de cada trabajo redacta el secreto del mensaje y de los textos de `data` (el secreto se resuelve antes de crearlo).

## Migration Plan

1. **Migración** `<timestamp>_add_integrations_foundation`, generada con `--create-only` contra una base descartable (`portfolio_integrations_check`) y revisada a mano (D21).
2. **Deploy:** corre en el `preDeployCommand`. Sin backfill. Con las variables por defecto (`INTEGRATIONS_ENABLED` vacía, scheduler apagado), la API se comporta igual que hoy; la pantalla muestra «No hay integraciones habilitadas».
3. **Encender en Railway** (cuando llegue un proveedor real): generar `INTEGRATIONS_KEYS` y `INTEGRATIONS_ACTIVE_KEY`, definir `INTEGRATIONS_ENABLED` con el proveedor y su secreto, y `INTEGRATIONS_SCHEDULER_ENABLED=true` **en el servicio `api` y en una sola réplica** (D4 tolera más, pero no hace falta).
4. **Base local del owner (`portfolio`, 5434):** la migra él con `npm run prisma:migrate`; ninguna tarea la toca.
5. **Rollback:** revertir el código deja las tablas sin uso; quitarlas exige una migración inversa con `DROP TABLE` y `DROP TYPE` (pierde credenciales cifradas y snapshots). Apagar sin revertir: `INTEGRATIONS_SCHEDULER_ENABLED=false`.

## Open Questions

Ninguna bloquea la implementación. Por indicación del owner (2026-11-12), cada pregunta no bloqueante se resuelve con la recomendación y queda registrada:

- **P1 — Default del scheduler.** A) apagado por defecto en todos los entornos, se enciende en Railway cuando llegue un proveedor real; B) encendido por defecto salvo en `test`. **Resuelta: A.** **[no bloqueante]** Un default apagado no ejecuta nada por sorpresa en tests, en local ni en una réplica nueva, y hoy no hay proveedor real que sincronizar.
- **P2 — Hora del planificador diario.** A) `0 10 * * *` UTC (06:00 en Bolivia, la de la propuesta); B) otra. **Resuelta: A**, configurable con `INTEGRATIONS_SYNC_CRON`. **[no bloqueante]**
- **P3 — Credenciales desde el panel.** A) API y campo de solo escritura (D14); B) solo variables de entorno. **Resuelta: A.** **[no bloqueante]** Los tokens de OAuth no pueden vivir en una variable; el campo es chico y se estrena con `fake`. GitHub (`add-github-code-evidence`) puede seguir con el PAT en una variable, que tiene prioridad.
- **P4 — Texto del 400 por spend limit de la Console.** A) heurística `/spend limit|usage limit/i` sobre `invalid_request_error` con fixtures marcados como supuestos y reconfirmación obligatoria en `add-ai-foundation`; B) tratar todo 400 de Anthropic como `Permanent` hasta confirmarlo. **Resuelta: A.** **[no bloqueante]** Cumple el criterio de la propuesta y un error de etiqueta no causa reintentos.
- **P5 — Servicio `sync` de la propuesta.** Queda reemplazado por el CLI manual de D20, por la decisión del owner sobre la pregunta 3. **Resuelta.** **[no bloqueante]**
