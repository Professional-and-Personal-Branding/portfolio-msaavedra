# add-integrations-foundation — Base de integraciones: cola, scheduler, cifrado, flags y snapshots

> Change de la **Fase 1.3** de `docs/PROPUESTA-FEATURES.md` (§ 4, épica E7, ítems **7.1** y **7.2**; § 5.1, § 5.3; § 6.2, fila `add-integrations-foundation`). Respeta la decisión del owner del 2026-11-07 sobre la pregunta 3 (§ 9): el scheduler es **`@nestjs/schedule`** dentro del proceso de la API, no un 4.º servicio cron de Railway, con la condición explícita de **no generar cuellos de botella en los procesos de la app**. No trae ningún proveedor real: GitHub llega en `add-github-code-evidence`.

## Why

Los changes que vienen (`add-github-code-evidence`, `add-job-posting-intake`, el radar y la IA de 2.0) necesitan lo mismo: hablar con un tercero fuera del camino de las peticiones, reintentar sin martillar su API, guardar tokens sin dejarlos en claro, cachear lo que trajeron y mostrar en el panel si algo dejó de sincronizar. Si cada change lo resuelve por su cuenta, hay tres colas, tres formas de reintentar y tres lugares por donde se puede filtrar un token.

La propuesta (§ 5.3) asumía un servicio `sync` aparte que arrancaba por cron y terminaba solo. El owner eligió `@nestjs/schedule`: un servicio menos que configurar y pagar, a cambio de que los trabajos convivan con la API. Este change diseña esa convivencia para que una sincronización lenta o rota no demore ni una petición, y para que un deploy solapado o una réplica futura no ejecuten dos veces el mismo trabajo.

## What Changes

- **Módulo nuevo `integrations`** (D1) con Clean Architecture completa: puerto `ConnectorPort` por proveedor, registro de proveedores, casos de uso con repositorios por token y adaptadores Prisma. Solo trae el proveedor **`fake`**, que existe para los tests y está prohibido en producción (D11).
- **Scheduler con `@nestjs/schedule` ~6.1.3** (D2), registrado de forma dinámica y **apagado por defecto** (`INTEGRATIONS_SCHEDULER_ENABLED`, D2 y D11). Un planificador diario encola (D3) y un ejecutor con tick de 60 s procesa (D3). **Ninguna petición HTTP ejecuta un trabajo**: «Sincronizar ahora» solo encola y responde 202.
- **Una sola instancia ejecutora** (D4): una fila de arriendo (`IntegrationRunnerLease`) tomada con un `UPDATE` condicional, más el reclamo de cada trabajo con `FOR UPDATE SKIP LOCKED` como segunda barrera. Cubre el deploy solapado de Railway (drenaje de 10 s) y réplicas futuras sin retener una conexión del pool.
- **Presupuesto del ejecutor** (D5): concurrencia 1, timeout por trabajo (`AbortSignal`) y por corrida, tope de trabajos por corrida, cesión del event loop entre trabajos, transacciones cortas y tope de tamaño de los snapshots. Apagado ordenado dentro del drenaje (D6).
- **Cola `IntegrationJob`** (D7) con `idempotencyKey` única y los estados `PENDING`, `RUNNING`, `DONE`, `FAILED` y `DEAD`; liberación de locks vencidos; `nextRetryDelay` con jitter completo, base 30 s y tope 6 h (D8).
- **Clasificación de errores** (D9) en `RetryAfter`, `ResetAt`, `Transient`, `Permanent` y `BudgetExhausted`, con un clasificador HTTP genérico y la tabla de Anthropic que mapea a `BudgetExhausted` las dos formas del spend limit (test). **Pausa por proveedor y circuit breaker** persistidos en `IntegrationSetting` (D10).
- **Flags** (D11): `INTEGRATIONS_ENABLED` lista los proveedores; el secreto de un proveedor se exige **solo si está habilitado**; `IntegrationSetting.enabled` es el kill switch por proveedor desde el panel, y `INTEGRATIONS_SCHEDULER_ENABLED` el global por proceso.
- **`SecretCipher`** (D12) AES-256-GCM con keyring (`INTEGRATIONS_KEYS`, `INTEGRATIONS_ACTIVE_KEY`) y **`npm run integrations:rekey`** idempotente (D13). Credenciales por variable de entorno o, cifradas, en `IntegrationCredential` vía una API de solo escritura (D14).
- **`ExternalSnapshot`** (D15) con `etag` y `contentHash`: un 304 solo actualiza `fetchedAt`.
- **Observabilidad** (D16, D17): una fila `SyncRun` por intento, `syncRunId` en el contexto del log, redacción de secretos en los mensajes de error de los proveedores y un aviso si un proveedor habilitado pasa **más de 48 h** sin una corrida exitosa.
- **API del panel** (D18) bajo `/api/admin/integrations` y **pantalla Integraciones** (`/admin/integraciones`, D19) con estado por proveedor, «Sincronizar ahora» (encola), Pausar/Reanudar y la credencial de solo escritura.
- **CLI manual opcional** `npm run integrations:sync` (D20): una corrida con el mismo arriendo, para diagnosticar; no es un servicio de Railway.
- **Medición del impacto** (D22): un e2e mide la latencia de `/health/live` y el retraso del event loop mientras corre un trabajo lento simulado.
- **Migración solo aditiva** (D21) y **retención** de trabajos y corridas (D23). Única dependencia nueva: `@nestjs/schedule`.
- **Contrato y docs:** `openapi.json` y `api.d.ts` regenerados; `docs/DEPLOY-RAILWAY.md` y `docs/DEPLOY.md` (variables nuevas), `backend/.env.example`, `docs/ARCHITECTURE.md`, `docs/MANUAL.md` e `index.html` (**TC-49**, pantalla Integraciones, glosario), `docs/CHANGELOG.md` y la línea del roadmap en `CLAUDE.md` al archivar.

## Non-goals

- **Proveedores reales** (GitHub, ATS, agregadores, LinkedIn, Anthropic): cada uno es su change. El clasificador de Anthropic se entrega como función pura con su test porque la propuesta lo pide como criterio, pero nada llama a Anthropic.
- **Un 4.º servicio `sync` y `railway.sync.json`**: descartados por la decisión del owner (pregunta 3 = B). El CLI de D20 queda como herramienta manual.
- **OAuth** (LinkedIn) y el aviso de 50 días: llegan con `add-linkedin-share-api`, si se abre.
- **`NotificationSender`** y avisos por email: `add-open-notifications`, después del deploy (P12 diferida). El aviso de 48 h vive en el panel y en el log.
- **Cola genérica para otros módulos** (registro de visitas, IA): la visita sigue con `BackgroundTasks` en proceso. La cola es para trabajos contra terceros.
- **Reintentar a mano un trabajo `DEAD`**: «Sincronizar ahora» encola uno nuevo; no hay botón por trabajo.
- **Historial completo de corridas en el panel**: solo la última corrida, la última exitosa y los conteos por estado.
- **Cambios en `/health`**: el healthcheck no depende de las integraciones (spec `api-health` sin cambios).
- **Réplicas de `api`**: el diseño las tolera, pero no se activan; seguir con una réplica es una decisión de `DEPLOY-ARCHITECTURE.md`.

## Capabilities

### New Capabilities

- `integration-connectors`: registro de proveedores y sus flags, secretos exigidos solo si el proveedor está habilitado, cifrado de credenciales con keyring y rekey, credencial de solo escritura, snapshots con `etag` y `contentHash`, clasificación de errores (incluidas las dos formas de Anthropic) y redacción de secretos en los errores.
- `integration-sync`: scheduler opcional por proceso, planificador idempotente, ejecutor único con arriendo y `SKIP LOCKED`, locks vencidos, reintentos con jitter, `DEAD`, pausa y circuit breaker por proveedor, presupuesto (timeouts, concurrencia, cesión del event loop), apagado ordenado, `SyncRun`, aviso de 48 h, API del panel, CLI manual y retención.

### Modified Capabilities

- `api-platform`: ADDED *Variables de las integraciones validadas al arranque*. No se reescribe *Configuración por variables de entorno validada al arranque*.
- `api-observability`: ADDED *Contexto y redacción en los trabajos de integración*. No se reescribe *Redacción de datos sensibles*.
- `admin-backoffice-shell`: ADDED *Pantalla Integraciones*. No se reescribe *Estructura del panel*.
- `platform-manual`: MODIFIED *Manual del backoffice por pantalla* (suma la pantalla Integraciones).

## Impact

- **Base (`backend/prisma/`):** enums `IntegrationJobStatus` y `SyncRunOutcome`; modelos `IntegrationSetting`, `IntegrationCredential`, `IntegrationJob`, `SyncRun`, `ExternalSnapshot` e `IntegrationRunnerLease`. Una migración nueva, aditiva: no toca tablas existentes.
- **Backend:**
  - `modules/integrations/` nuevo: `domain/` (entidades, `nextRetryDelay`, clasificadores, errores, puertos), `application/` (casos de uso, `SecretCipher` y `CredentialResolver` como puertos, DTOs), `infrastructure/` (cola y repositorios Prisma, `AesGcmSecretCipher`, scheduler, proveedor `fake`, controller) e `integrations.module.ts`.
  - `config/env.validation.ts` y `config/configuration.ts`: variables nuevas y reglas condicionales.
  - `shared/infrastructure/http/logger.options.ts`: rutas de redacción nuevas; `shared/domain/redact-secrets.ts` (nuevo, puro).
  - `app.module.ts`: importa `IntegrationsModule`.
  - `scripts/integrations-rekey.ts` y `scripts/integrations-sync.ts`; `package.json`: `@nestjs/schedule` ~6.1.3 y los scripts `integrations:rekey` e `integrations:sync`.
- **Frontend (`frontend/src/features/backoffice/`):** `integrations/` (página, hooks, formulario de credencial), ítem en `NAV` de `shared/AdminShell.tsx`, ruta en `BackofficeApp.tsx`; `api.d.ts` regenerado.
- **Scripts del frontend:** `check-a11y.mjs` (ruta `/admin/integraciones`) y `capture-manual.mjs` (captura `bo-integraciones`, contra la base de ejemplo con el proveedor `fake`).
- **Docs:** `docs/DEPLOY-RAILWAY.md`, `docs/DEPLOY.md`, `docs/ARCHITECTURE.md`, `docs/MANUAL.md`, `docs/manual/index.html`, `docs/manual/bo-integraciones.jpg`, `docs/CHANGELOG.md`, `backend/.env.example`, `CLAUDE.md`.
- **Sin cambios** en la ruta pública, el composer, el seed, Caddy, la CSP, CORS, la cookie ni `/health`. El arranque público no cambia: la pantalla nueva va en el chunk del panel.
