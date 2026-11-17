# Design — add-ai-foundation

## Context

Ver `proposal.md`. Estado verificado el 17 de noviembre de 2026 sobre `main` (`5e7235d`):

- **Base de integraciones** (`backend/src/modules/integrations/`, archivada el 2026-11-13): `ProviderFailure` (`RetryAfter`, `ResetAt`, `Transient`, `Permanent`, `BudgetExhausted`) en `domain/provider-failure.ts`; `classifyAnthropicError` en `domain/services/` ya mapea a `BudgetExhausted` el 429 `rate_limit_error` + `enforced_spend_limit_reached` (reinicio el día 1 del mes siguiente, 00:00 UTC), el 402 `billing_error` y el 400 `invalid_request_error` cuyo mensaje contiene «spend limit» o «usage limit» (heurística: el texto no estaba confirmado); cualquier otro 400 es `Permanent`. `sanitizeFailure` acota las pistas del tercero. `redactSecrets` (`shared/domain`) cubre `sk-ant-`, `ghp_`, `github_pat_`, `Bearer` y `token=` y trunca a 500. `RunLogger` lleva contexto por corrida. Keyring AES-256-GCM (`INTEGRATIONS_KEYS`) para credenciales que se cargan desde el panel. `env.validation.ts` falla el arranque nombrando la variable sin imprimir el valor.
- **Test de arquitectura** (`backend/test/architecture.spec.ts`): reglas de dependencia, `curated-profile` sin imports de `integrations`, y escaneo de `ghp_`, `github_pat_` y `sk-ant-` (20+ caracteres) sobre `backend/test/fixtures` y `docs/fixtures`.
- **Pantalla `/admin/integraciones`** sin ítem en la barra, alcanzable desde Cuenta y desde un aviso del Dashboard.
- **Dependencias:** el backend no tiene `@anthropic-ai/sdk` ni `zod` (el frontend usa `zod` ^4.3). `ajv` está solo en `devDependencies`.
- **Documentación oficial consultada el 2026-11-17** (skill `claude-api` + páginas de `platform.claude.com`):
  - Precios: tabla de § Presupuesto. `count_tokens` es **gratis**, tiene límites propios (RPM) y devuelve una **estimación**; no usa la caché.
  - Spend limits: el tope del tier da 429 `rate_limit_error` con `error.details.error_code = "enforced_spend_limit_reached"`, **sin `retry-after`**, hasta el día 1 a las 00:00 UTC (los reintentos del SDK también fallan). El límite que fija el usuario en la Console da **400 `invalid_request_error`** con un mensaje que **empieza** por «You have reached your specified API usage limits» o «You have reached your specified workspace API usage limits». Un 429 con `error_code = "ramp_limit_exceeded"` es un límite de rampa, no de gasto.
  - Versión de API 2026-10-21: `temperature`, `top_p` y `top_k` dan 400 en todos los modelos. Sin prefill. `tool_choice` `any`/`tool` da 400 en Sonnet 5.5 (también en `count_tokens`). Salida estructurada con `output_config.format` o `client.messages.parse()` con `zodOutputFormat`.
  - Thinking: en **Haiku 5.5** es adaptativo por defecto (effort `medium`) y **acepta `{type: "disabled"}` con effort `high` o menor**; en **Sonnet 5.5** `disabled` da 400 y se apaga con `{type: "between_tools"}` (sin otros campos, effort ≤ `high`); el thinking cuenta dentro de `max_tokens`. Siempre revisar `stop_reason` (`refusal`, `max_tokens`) antes de leer `content`. Haiku 5.5 no tiene fallback del lado del servidor ante un rechazo.
  - Prompt caching: `cache_control: {type: "ephemeral"}` (5 min); mínimo cacheable 512 tokens en estos modelos; escritura 1,25×.
  - SDK TypeScript: reintenta por defecto 2 veces los 408, 409, 429, 5xx y errores de conexión; `timeout` en milisegundos; errores tipados (`Anthropic.APIError` con `status`, `.type`, cuerpo y cabeceras); `_request_id` en la respuesta.

## Goals / Non-Goals

**Goals:** (1) un único punto de salida hacia Anthropic, detrás de un puerto, con el SDK oficial; (2) un tope mensual de 10 USD que no se puede superar, ni con concurrencia ni con reintentos ni con caídas del proceso; (3) cada corrida auditable (modelo, tokens, costo, versión de prompt, resultado); (4) ningún dato prohibido sale del servidor, con un test que lo demuestre; (5) la ruta pública y el resto de la API no se enteran de que la IA existe; (6) evals reproducibles en el CI sin red ni clave; (7) con `AI_ENABLED=false`, cero cambios de comportamiento.

**Non-Goals:** ver `proposal.md` § Non-goals.

## Decisions

### D1 — Módulo `ai` y dónde vive cada pieza

```
backend/src/modules/ai/
├── domain/
│   ├── ai-run.entity.ts            # estados y transiciones (RESERVED → SUCCEEDED | REFUSED | FAILED | ABANDONED; CACHED y BLOCKED son terminales al crear)
│   ├── model-pricing.ts            # tabla de precios versionada (D19), puro
│   ├── estimate-cost.ts            # reserva y costo real a partir de tokens, en micro-USD enteros
│   ├── ai-cache-key.ts             # SHA-256 de la clave canónica (D11)
│   ├── data-boundary/              # lista negra de claves y patrones, redacción de texto libre (D13)
│   └── errors/                     # AiDisabledError, AiBudgetExhaustedError, AiBusyError, ForbiddenDataError, AiOutputError…
├── application/
│   ├── ports/llm.port.ts           # LlmPort (D5)
│   ├── ports/ai-run.repository.ts, ai-budget.repository.ts, clock.port.ts
│   ├── tasks/                      # AiTaskDefinition y registro de tareas (D4, D12)
│   ├── services/ai-task-runner.ts  # orquesta guardián → caché → conteo → reserva → llamada → conciliación
│   ├── services/budget-guard.ts    # D7, D8
│   └── use-cases/                  # GetAiUsageUseCase, RunAiSmokeTestUseCase
├── infrastructure/
│   ├── anthropic/anthropic-llm.adapter.ts   # ÚNICO archivo que importa @anthropic-ai/sdk (junto con su factory)
│   ├── fake/fake-llm.adapter.ts             # determinista, escenarios (D20)
│   ├── disabled/disabled-llm.adapter.ts     # AI_ENABLED=false: nunca construye el cliente
│   ├── cassette/cassette-llm.adapter.ts     # reproduce cassettes (tests y evals de CI)
│   ├── persistence/prisma-ai-run.repository.ts, prisma-ai-budget.repository.ts
│   ├── controllers/admin-ai.controller.ts
│   └── concurrency/semaphore.ts
├── prompts/<tarea>/v<n>.md        # D12
└── ai.module.ts
```

- `ProviderFailure`, `classifyAnthropicError` y `sanitizeFailure` se **mueven** (con sus specs) a `backend/src/shared/domain/provider-failure/`; `integrations` solo cambia sus imports. Son dominio puro y ahora los usan dos módulos.
- Los casos de uso de IA de cada feature vivirán en el módulo dueño del dato (propuesta § 5.1) y recibirán `AiTaskRunner` por token Symbol. En este change el único consumidor es `RunAiSmokeTestUseCase`.

Alternativa descartada: **importar el clasificador desde `modules/integrations/domain`.** Acopla `ai` a `integrations` por un archivo que no es de integraciones; el comentario del propio clasificador ya decía «para 2.0».
Alternativa descartada: **reusar la cola de integraciones (`IntegrationJob`) para las llamadas.** Las tareas de IA de 2.0 son acciones del owner que espera la respuesta en el panel (segundos), no sincronizaciones diarias; la cola sumaría latencia de minutos. Cuando una tarea sea masiva (traducción en Batch) se evaluará en su change.

### D2 — Variables de entorno

| Variable | Default | Regla |
|---|---|---|
| `AI_ENABLED` | `false` | `true`/`false`. |
| `AI_PROVIDER` | `anthropic` | `anthropic` o `fake`; `fake` con `NODE_ENV=production` hace fallar el arranque. |
| `ANTHROPIC_API_KEY` | — | Obligatoria si `AI_ENABLED=true` y `AI_PROVIDER=anthropic`; no vacía y sin espacios. **No se valida el prefijo** (puede cambiar). Nunca se imprime. |
| `AI_MONTHLY_BUDGET_USD` | `10` | Número entre 0 y 1000, hasta 2 decimales. `0` = encendida pero sin presupuesto (todo se bloquea; lo usa el TC-54). |
| `AI_REQUEST_TIMEOUT_MS` | `60000` | 5 000 a 120 000. |
| `AI_MAX_CONCURRENCY` | `2` | 1 a 4, por proceso. |
| `AI_MAX_INPUT_TOKENS` | `50000` | 1 000 a 100 000 (mantiene a Haiku 5.5 en la tarifa de hasta 100K). |
| `AI_FAKE_SCENARIO` | `ok` | Solo con `AI_PROVIDER=fake`; valores de D20. |

Las variables de las evals en vivo (`AI_EVAL_API_KEY`, `AI_EVAL_ALLOW_SPEND`, `AI_EVAL_MAX_USD`) las lee solo el script y no se validan al arrancar la API. **`AI_EVAL_API_KEY` no es `ANTHROPIC_API_KEY`**: es la clave del workspace de evals de la Console (P1 = A) y vive solo en la terminal del owner, nunca en Railway.

Con `AI_ENABLED=false` las demás variables se validan igual si están (un valor inválido sigue impidiendo el arranque), pero la clave no se exige.

### D3 — La clave solo del entorno, URL base fija

- `ANTHROPIC_API_KEY` se lee de la configuración validada y se pasa **explícita** al constructor (`new Anthropic({ apiKey, baseURL: 'https://api.anthropic.com', maxRetries: 0, timeout })`). Así el SDK no toma credenciales ambientales (`ANTHROPIC_AUTH_TOKEN`, perfiles de `ant auth login`, `ANTHROPIC_BASE_URL`) y un `ANTHROPIC_BASE_URL` en el entorno no puede desviar el tráfico (mismo criterio que la URL de GitHub en `add-github-code-evidence`).
- La URL base solo se puede inyectar por el constructor de la factory desde un test (servidor en `127.0.0.1`), nunca por variable.
- Con `AI_ENABLED=false` el cliente **no se construye** (`DisabledLlmAdapter`).
- No va al keyring: el criterio de aceptación exige que la API **no arranque** sin clave, y una credencial guardada en la base solo se puede verificar después de arrancar. El keyring sigue para las credenciales de integraciones que el owner carga desde el panel.

Alternativa descartada: **clave cifrada en la base, cargada desde Integraciones.** No permite el fail-fast del arranque y suma una superficie de escritura de secretos al panel. Queda como P5.

### D4 — Modelos y parámetros por tarea, en código

Cada tarea es un `AiTaskDefinition` versionado en el repo:

```ts
{ id: 'ai.smoke', promptVersion: 1, model: 'claude-haiku-5-5', effort: 'low', thinking: 'off',
  maxTokens: 256, cacheSystemPrompt: false, outputSchema /* Zod */, buildInput /* lista blanca, D13 */ }
```

- **Registro de modelos permitido:** `claude-haiku-5-5` y `claude-sonnet-5-5`, con sus IDs exactos. Un modelo fuera del registro no compila (tipo literal) y un test lo verifica. Opus 5.5 queda fuera hasta que una feature lo justifique con una Dn y su eval (P2).
- **Default: Haiku 5.5.** Extracción, clasificación y validación con schema van en Haiku. Sonnet 5.5 solo cuando la eval de la tarea muestre que Haiku no alcanza el umbral. Con el tope de 10 USD, la diferencia importa: una llamada de 20K de entrada y 2K de salida cuesta **0,003 USD en Haiku y 0,06 USD en Sonnet** (20×); y la reserva previa de Sonnet con `max_tokens` 16 000 es de 0,20 USD contra 0,01 en Haiku, lo que en Sonnet deja menos margen para llamadas concurrentes cerca del tope.
- **El modelo no se cambia por variable de entorno**: es parte de la clave de caché y de lo que la eval aprobó. Cambiarlo es un cambio de código con su eval.
- **Thinking:** `thinking: 'off'` → Haiku `{type: "disabled"}` (exige effort ≤ `high`; el registro lo valida); Sonnet `{type: "between_tools"}` (sin otros campos, effort ≤ `high`). `thinking: 'adaptive'` → `{type: "adaptive"}`. El effort se manda siempre explícito en `output_config.effort` (los defaults difieren: Haiku `medium`, Sonnet `high`).

Alternativa descartada: **un modelo único configurable por variable.** Rompe la reproducibilidad de las evals y la caché, y permitiría subir a Opus sin decisión.

### D5 — `LlmPort` y lo que el adaptador manda a la API

```ts
interface LlmPort {
  countInputTokens(req: LlmRequest, signal: AbortSignal): Promise<Result<number, LlmFailure>>;
  complete<T>(req: LlmRequest<T>, signal: AbortSignal): Promise<Result<LlmCompletion<T>, LlmFailure>>;
}
type LlmFailure = ProviderFailure
  | { kind: 'Refused'; category: string | null }
  | { kind: 'Truncated' }            // stop_reason max_tokens
  | { kind: 'InvalidOutput'; issues: string[] };
interface LlmCompletion<T> { output: T; usage: LlmUsage; stopReason: string; requestId: string | null; model: string }
```

- El puerto no expone tipos del SDK, ni `temperature`/`top_p`/`top_k` (dan 400 desde la versión de API 2026-10-21), ni prefill, ni `tool_choice`. Las evals miden **tasas** (D16), no salidas idénticas.
- El adaptador usa `client.messages.parse()` con `output_config: { format: zodOutputFormat(schema), effort }`. Si el helper no acepta la versión de Zod del proyecto, la alternativa documentada es `output_config.format` con `z.toJSONSchema(schema)` y `schema.safeParse` en el adaptador (tarea 3.2 lo decide con el SDK instalado).
- Orden de chequeo de la respuesta: `stop_reason === 'refusal'` → `Refused` (con `stop_details.category`); `max_tokens` → `Truncated`; `parsed_output` nulo o `safeParse` fallido → `InvalidOutput`; recién entonces `output`. En todos los casos el `usage` se devuelve para conciliar el costo (D8).
- La entrada del usuario va en un bloque de texto **delimitado como dato** (`<datos>…</datos>`) y el system prompt dice que su contenido nunca son instrucciones (riesgo de inyección de prompt de la propuesta § 8).
- Prompt caching: si la tarea declara `cacheSystemPrompt`, el system prompt va con `cache_control: {type: "ephemeral"}`. Nada volátil (fechas, ids) en el system prompt.

### D6 — `AiRun` y `AiBudgetMonth` (migración aditiva `add_ai_foundation`)

```prisma
enum AiRunStatus { RESERVED SUCCEEDED CACHED REFUSED FAILED ABANDONED BLOCKED }

model AiRun {
  id                 String      @id @default(cuid())
  task               String
  promptVersion      Int
  model              String
  inputHash          String      // SHA-256 de la entrada canónica; la entrada NO se guarda
  cacheKey           String
  status             AiRunStatus
  reservedMicroUsd   Int         @default(0)
  costMicroUsd       Int?        // real, desde usage; null mientras RESERVED
  inputTokens        Int?
  outputTokens       Int?
  cacheReadTokens    Int?
  cacheWriteTokens   Int?
  stopReason         String?
  failureKind        String?     // Transient, Permanent, BudgetExhausted, Refused, Truncated, InvalidOutput, ForbiddenData, Busy…
  failureMessage     String?     // ya pasado por redactSecrets
  output             Json?       // solo la salida validada
  requestId          String?
  durationMs         Int?
  budgetMonth        String      // 'AAAA-MM' en UTC
  reservationExpiresAt DateTime?
  createdAt          DateTime    @default(now())
  finishedAt         DateTime?
  @@index([cacheKey, status])
  @@index([budgetMonth, status])
  @@index([createdAt])
}

model AiBudgetMonth {
  month              String   @id          // 'AAAA-MM' UTC
  spentMicroUsd      Int      @default(0)
  reservedMicroUsd   Int      @default(0)
  providerBlockedUntil DateTime?
  providerBlockReason  String?
  updatedAt          DateTime @updatedAt
}
```

- Dinero en **micro-USD enteros** (10 USD = 10 000 000): sin errores de coma flotante; `Int` alcanza hasta ~2 147 USD, y el tope máximo validado es 1 000.
- `BLOCKED` registra los intentos cortados por el presupuesto o la frontera de datos, con costo 0, para que el panel los muestre.
- No se guarda el texto enviado ni la respuesta cruda: solo hash y salida validada. Así un `AiRun` nunca es una copia del texto de una vacante (que tiene su propia retención de 90 días).

Alternativa descartada: **sumar los `AiRun` del mes en cada reserva.** Necesita un lock global o aislamiento serializable para no pasarse con dos reservas simultáneas; el contador por mes con `UPDATE` condicional es una sola sentencia atómica (D8).

### D7 — Cuánto se reserva

Para una llamada:

```
entradaEstimada = ceil(count_tokens × 1,10) + 512           // margen: el conteo es estimación y no incluye lo que agrega el formato estructurado
precioEntrada   = cacheSystemPrompt ? precioEscritura5m : precioEntradaBase   // peor caso
reserva         = entradaEstimada × precioEntrada + maxTokens × precioSalida  // el thinking cuenta dentro de max_tokens
```

- `count_tokens` es gratis y tiene su propio límite de peticiones; si falla, **no se llama** a `messages` (falla cerrado como `Transient`).
- Si `entradaEstimada > AI_MAX_INPUT_TOKENS` la corrida termina `BLOCKED` sin llamar (protege también la tarifa de Haiku de más de 100K).
- Como `output_tokens ≤ max_tokens` y la entrada lleva margen, el costo real queda por debajo de la reserva salvo un desvío del conteo mayor al 10 % + 512 tokens; en ese caso el exceso se imputa igual (D8) y el próximo intento ya ve el gasto real.

### D8 — `BudgetGuard`: reservar, conciliar, sin pasarse

1. **Reservar** (una sentencia, en una transacción corta junto con el `INSERT` del `AiRun` en `RESERVED`):
   ```sql
   INSERT INTO "AiBudgetMonth"(month) VALUES ($m) ON CONFLICT DO NOTHING;
   UPDATE "AiBudgetMonth"
      SET "reservedMicroUsd" = "reservedMicroUsd" + $r
    WHERE month = $m
      AND ("providerBlockedUntil" IS NULL OR "providerBlockedUntil" <= now())
      AND "spentMicroUsd" + "reservedMicroUsd" + $r <= $cap
   RETURNING *;
   ```
   Si no devuelve fila: `AiBudgetExhaustedError` (o bloqueo del proveedor) y el `AiRun` queda `BLOCKED`. Postgres serializa los `UPDATE` sobre la misma fila: dos reservas simultáneas no pueden sumar más que el tope, **aunque vengan de dos instancias** (deploy con solapamiento).
2. **Conciliar** al terminar (éxito, rechazo, truncado o salida inválida, todos facturados): `reserved -= r`, `spent += costoReal` y el `AiRun` pasa a su estado final con tokens y costo, en la misma transacción.
3. **Fallo sin `usage`** (red, 5xx antes de la respuesta, presupuesto del proveedor): `reserved -= r`, `spent += 0`. **Timeout o aborto después de enviar**: no se sabe si Anthropic facturó, así que `spent += r` (se imputa la reserva entera). Conservador a propósito.
4. **Reservas huérfanas** (el proceso murió entre reservar y conciliar): cada `AiRun` `RESERVED` lleva `reservationExpiresAt = now + timeout + 60 s`. Antes de cada reserva, el guard pasa a `ABANDONED` las vencidas del mes e imputa su reserva entera como gasto (barrido perezoso, sin cron).
5. **"Corta al llegar al tope":** con `spent ≥ cap` el estado es `EXHAUSTED` y toda reserva se rechaza; también se rechaza una reserva que **haría** pasar el tope aunque todavía no se haya llegado.
6. **Mes calendario UTC** (`AAAA-MM`), igual que el reinicio de Anthropic.

Alternativa descartada: **contador en memoria.** No sobrevive a un reinicio ni a dos instancias.
Alternativa descartada: **`pg_advisory_xact_lock` + `SUM` de `AiRun`.** Funciona, pero serializa también lecturas y depende de que todos los caminos tomen el lock; el `UPDATE` condicional es autoexplicativo y testeable con concurrencia real en el e2e.

### D9 — Sin reintentos automáticos de la llamada facturable

- El cliente se construye con `maxRetries: 0`. `messages.parse()` se intenta **una vez**; un `Transient` o `RetryAfter` vuelve al owner con un mensaje («Anthropic no respondió; probá de nuevo en un rato») y su `AiRun` `FAILED`.
- `countTokens` (gratis) sí se reintenta: hasta 2 veces con la misma política del SDK, pasada por opción por petición (`{ maxRetries: 2 }`).
- Motivo: los reintentos del SDK multiplican el costo potencial de una llamada (un timeout puede facturarse) y no tienen contraparte en la reserva; el volumen de 2.0 es bajo y hay un humano esperando la respuesta.

Alternativa descartada: **reservar `(1 + reintentos) ×` y dejar los 2 reintentos del SDK.** Triplica la reserva de cada llamada y reintenta también el 429 del tope del tier, que el doc dice que «sigue fallando hasta que se reanude el acceso».

### D10 — Errores del proveedor y bloqueo por spend limit

- El adaptador traduce `Anthropic.APIError` a `{ status, body, retryAfter }` y llama a `classifyAnthropicError`; `APIConnectionError` y timeouts (sin `status`) dan `Transient`; un aborto por la señal da `Transient` «cancelado».
- **Ajuste del clasificador** (MODIFIED *Presupuesto agotado de Anthropic*): se reconoce el texto **confirmado** del 400 de la Console (`^You have reached your specified (workspace )?API usage limits`) además de la heurística vigente; un 429 con `error_code = "ramp_limit_exceeded"` sigue siendo `RetryAfter`/`Transient`, nunca `BudgetExhausted`. Un 400 por parámetros (p. ej. `"thinking.type.disabled" is not supported…`) sigue `Permanent`.
- `BudgetExhausted` **bloquea** el mes: `AiBudgetMonth.providerBlockedUntil = resetAt` (tope del tier: día 1 a las 00:00 UTC) o `now + 1 h` (Console, que no trae fecha confiable: se reintenta como mucho una vez por hora). Mientras dure, las reservas se rechazan sin llamar a la API y el panel lo muestra.
- **Rechazo:** `REFUSED` con su categoría y el costo facturado. **No se usa el fallback del servidor** en este change: las tareas son Haiku (sin fallback del servidor) y para Sonnet cambiaría el modelo efectivo, la clave de caché y el precio sin pasar por la eval (P3).
- Un `401`/`403` es `Permanent` con el mensaje «Anthropic rechazó la clave»; no bloquea el mes.

### D11 — Caché por hash

- `cacheKey = SHA-256(JSON canónico de { task, promptVersion, promptHash, model, effort, thinking, maxTokens, schemaVersion, input })` con claves ordenadas y sin `undefined`.
- Antes de reservar, si hay un `AiRun` `SUCCEEDED` con la misma `cacheKey`, se devuelve su `output`, se registra un `AiRun` `CACHED` con costo 0 y **no se llama** a la API (ni a `count_tokens`).
- Sin vencimiento: cambiar el prompt cambia la versión y su hash; cambiar el modelo cambia la clave. El runner acepta `{ bypassCache: true }` para «Regenerar» en las features que lo necesiten.
- Es distinta del prompt caching de Anthropic (D5), que solo abarata prefijos repetidos dentro de 5 minutos.

### D12 — Prompts versionados en el repo

- Cada prompt vive en `backend/src/modules/ai/prompts/<tarea>/v<n>.md` y su definición registra `promptVersion` y `promptSha256`.
- Un test recalcula el hash de cada archivo y falla si no coincide: **editar un prompt obliga a subir la versión** (archivo nuevo) y a regrabar o revisar su cassette (D16).
- Las versiones viejas se conservan mientras haya `AiRun` que las referencien en el panel; borrarlas no rompe nada (la caché simplemente deja de acertar).

### D13 — Frontera de datos y test de lista negra

**Qué puede salir:** solo datos del CV (experiencias, skills, proyectos, educación, certificaciones, perfil **sin** email, teléfono ni ubicación exacta) y de las vacantes (título, empresa, requisitos, texto pegado). **Nunca:** email del owner, credenciales, tokens, `accessToken` de perfiles, `ipHash`, sal, hashes de contraseña, `sessionVersion`, cookies, user agents, referrers, códigos de `ShareLink` ni ningún dato de visitas o de `Application`.

**Cómo se garantiza (tres capas):**

1. **Constructores con lista blanca** (`buildInput` de cada tarea): arman el payload campo por campo desde DTOs de lectura; nunca hacen spread de una entidad.
2. **Guardián en `application`** (`assertLlmSafe(payload, knownSecrets)`), que corre en el runner **antes** de la caché, del conteo y de la reserva, sea cual sea el adaptador:
   - claves prohibidas en cualquier nivel (comparación sin mayúsculas ni separadores): `email`, `password*`, `token`, `accessToken`, `secret`, `apiKey`, `cookie`, `ipHash`, `salt`, `hash`, `sessionVersion`, `userAgent`, `referrer`, `credential`, `ciphertext`, `phone`;
   - valores prohibidos en campos **estructurados**: direcciones de email, `sk-ant-`, `ghp_`/`github_pat_`, JWT (`eyJ…\.…\.…`), IPv4/IPv6 y los secretos exactos de la configuración (`JWT_SECRET`, `ANALYTICS_SALT`, claves del keyring, `ANTHROPIC_API_KEY`) → `ForbiddenDataError`, `AiRun` `BLOCKED`, nada sale;
   - en campos marcados como **texto libre** (p. ej. el de una vacante): emails y teléfonos se **redactan** a `[email]`/`[teléfono]` y se cuenta cuántos; credenciales y secretos siguen bloqueando (P6).
3. **Tests de lista negra:**
   - unitario del guardián con un caso por clave y por patrón, y su autocontrol;
   - **propiedad:** para cada tarea registrada, `buildInput` sobre los datos de `docs/examples/cv-data.example.json` (con el email ficticio del perfil cargado) produce un payload que pasa el guardián y en el que no aparece el email; `fast-check` con entradas arbitrarias que contienen valores prohibidos → siempre bloqueadas o redactadas;
   - **arquitectura:** `modules/ai` no importa `analytics`, `auth`, `share-link` ni la persistencia de credenciales de `integrations`; `@anthropic-ai/sdk` solo se importa en `modules/ai/infrastructure/anthropic/`;
   - **adaptador espía:** en el e2e, un `LlmPort` que registra lo recibido confirma que ningún payload contiene el email del perfil ni el `JWT_SECRET`.

Alternativa descartada: **solo lista blanca, sin guardián.** Un constructor nuevo mal escrito en una feature futura filtraría datos sin que nada lo detecte.

### D14 — Ruta pública aislada y sin cuellos de botella (requisito del owner)

- **Nada público llama a la IA:** test de arquitectura que exige que `curated-profile`, `profile`, `experience`, `skill`, `analytics`, `featured-repository`, el renderer del head y los controllers públicos no importen `modules/ai`. En este change solo `ai` se importa a sí mismo.
- Las llamadas son I/O asíncrono: no bloquean el event loop. El trabajo de CPU es mínimo (hash y validación con Zod sobre salidas de ≤ 16K tokens).
- **Timeout por petición** `AI_REQUEST_TIMEOUT_MS` (60 s) en el SDK + `AbortSignal` atado al cierre de la petición HTTP del panel (si el owner cierra la pestaña, se aborta). `countTokens`: 10 s.
- **Semáforo por proceso** `AI_MAX_CONCURRENCY` (2): si no hay lugar en 2 s, `AiBusyError` → 503 con `retry-after: 5`, sin esperar en cola. Con dos instancias durante un deploy el máximo efectivo es el doble, acotado y sin riesgo de presupuesto (D8).
- Límite de peticiones propio en `POST /api/admin/ai/smoke` (5 por minuto) además del global.

### D15 — Humano en el bucle

- `AiTaskRunner` devuelve `{ runId, output }` y **no recibe repositorios de escritura** de ningún otro agregado; solo escribe `AiRun` y `AiBudgetMonth`.
- Test de arquitectura: en `modules/ai` las únicas escrituras de Prisma son sobre `aiRun` y `aiBudgetMonth`.
- La regla para las features que vienen queda en la spec: una salida de IA se muestra como propuesta y solo se aplica con una acción explícita del owner que pasa por los casos de uso existentes y sus validaciones. Las cifras (años, fechas, conteos) las calcula el código, nunca el modelo.

### D16 — Evals con cassettes en el CI

- **Cassette** (`backend/test/fixtures/ai/cassettes/<tarea>/<caso>.json`): `{ task, promptVersion, promptSha256, model, cacheKey, recordedAt, sdkVersion, pricingVerifiedAt, response: { content, stop_reason, stop_details, usage, model } }`. Sin cabeceras, sin `request_id`, sin la clave.
- **Casos** (`backend/src/modules/ai/evals/<tarea>.cases.ts`): entrada (armada desde los datos **ficticios** de `docs/examples/`), validadores semánticos y umbral de la tarea (p. ej. «schema válido en el 100 %»).
- `CassetteLlmAdapter` busca por `cacheKey`; si falta el cassette o el `promptSha256` no coincide, el test **falla** (nunca va a la red). Un test aparte verifica que todo cassette corresponde a una tarea y versión vigentes.
- Corre dentro de `npm test` del job `backend`: sin clave, sin red, sin base.
- Para la tarea de humo se versionan tres cassettes: respuesta válida, `refusal` y `max_tokens`.

### D17 — `npm run ai:eval` a demanda

- `tsx scripts/ai-eval.ts [--task <id>] [--record] [--max-usd <n>]`.
- **Se niega (código 2) sin gastar** si falta `AI_EVAL_API_KEY` (la clave del workspace de evals, **distinta** de `ANTHROPIC_API_KEY`: tener solo esta última no alcanza), si falta `AI_EVAL_ALLOW_SPEND=1`, o si la **suma de las reservas** de todos los casos (D7, con `count_tokens`, que es gratis) supera `--max-usd` (default `AI_EVAL_MAX_USD` o 2 USD). Mismo patrón que los `*_DISPOSABLE_DB=1` del repo.
- Usa el `AnthropicLlmAdapter` real con un `BudgetGuard` **en memoria** con ese tope: no toca la base ni el ledger de producción. Corta en cuanto el gasto real llega al tope.
- **Dónde se gasta (P1 = A, decisión del owner del 2026-11-17).** Las evals en vivo usan un **workspace aparte** de la Console, con su propio spend limit de **5 USD**, y cada corrida tiene un tope de **2 USD**. Los 10 USD de `AI_MONTHLY_BUDGET_USD` quedan **solo** para la IA del panel. Cada clave va en su variable: `ANTHROPIC_API_KEY` (workspace de la app, en Railway) y `AI_EVAL_API_KEY` (workspace de evals, solo en la terminal local). El script nunca lee la primera.
- Informa por tarea la **tasa** de casos que pasan los validadores (no salidas idénticas: sin `temperature` no hay determinismo), los tokens y el costo real; sale con 1 si alguna tarea queda bajo su umbral.
- `--record`: escribe los cassettes pasando cada string por `redactSecrets` con la clave conocida, y **se niega a escribir** si después de redactar queda algún `sk-ant-`, la clave exacta o un email que no sea del dominio ficticio del ejemplo. El escaneo de `architecture.spec.ts` (que ya cubre `backend/test/fixtures`) es la segunda barrera.
- Solo datos ficticios: nunca se manda a la API el CV real del owner desde una eval.

### D18 — Panel de solo lectura en Integraciones

- **API:** `GET /api/admin/ai/usage` → `{ enabled, provider, month, budgetUsd, spentUsd, reservedUsd, remainingUsd, state, providerBlockedUntil, pricingVerifiedAt, recentRuns[20] }` con `state ∈ { DISABLED, OK, NEAR_LIMIT (≥ 80 %), EXHAUSTED, PROVIDER_BLOCKED }`. Responde también con la IA apagada (lee la base). `POST /api/admin/ai/smoke` → corre `ai.smoke` y devuelve el `AiRun`; con la IA apagada 422 «La IA está apagada en este servidor»; con el tope 422 «Se alcanzó el tope de IA del mes»; ocupado 503.
- **Textos de estado** (literales, los usa el manual): `DISABLED` «La IA está apagada. Se enciende con la variable `AI_ENABLED` del servidor.»; `OK` «Activa»; `NEAR_LIMIT` «Cerca del tope del mes»; `EXHAUSTED` «Se alcanzó el tope de IA del mes»; `PROVIDER_BLOCKED` «Anthropic cortó por el spend limit hasta {fecha}».
- **Bloque «Inteligencia artificial»** al final de `/admin/integraciones` (sin ítem en la barra): estado por texto, «Gastado {x} de {tope} USD en {mes} ({%})», reservado en curso, aviso de bloqueo del proveedor con su fecha, fecha de verificación de precios, tabla de las 20 corridas recientes (fecha, tarea, versión, modelo, estado, tokens, costo, duración, «de caché») y **Probar conexión**, que confirma antes: «Hace una llamada real a Anthropic (unos 0,0001 USD).» o «Proveedor de prueba: no llama a Anthropic.».
- **Aviso del Dashboard:** «La IA alcanzó el tope del mes» con enlace a `/admin/integraciones` cuando `state` es `EXHAUSTED` o `PROVIDER_BLOCKED`.
- La tarea de humo manda un texto fijo (sin datos del usuario) y espera `{ "estado": "ok" }`; sirve para probar la clave, el presupuesto y el registro de punta a punta. Corre siempre con `bypassCache` (si no, la segunda prueba no probaría la conexión); la caché se prueba llamando al runner directamente en los tests.

### D19 — Precios versionados en el código

- `model-pricing.ts` guarda, por modelo, precio de entrada, escritura de caché 5 min, lectura de caché y salida (y la tarifa de Haiku de más de 100K), en micro-USD por millón de tokens, con `PRICING_VERIFIED_AT = '2026-11-17'` y la URL de la fuente.
- Un unitario fija los valores de la tabla de § Presupuesto; cambiarlos es un cambio de código revisable. El panel muestra la fecha de verificación.
- El costo real se calcula con el `usage`: `input × entrada + cache_creation × escritura5m + cache_read × lectura + output × salida`; para Haiku se elige la tarifa por la entrada total (`input + cache_creation + cache_read`).

### D20 — `FakeLlmAdapter` y sus escenarios

- Determinista, sin red; devuelve un `usage` fijo y una salida válida para cada tarea registrada (la que declara la tarea como ejemplo).
- `AI_FAKE_SCENARIO`: `ok`, `refusal`, `truncated`, `invalid-output`, `transient`, `spend-limit-tier` (429 `enforced_spend_limit_reached`), `spend-limit-console` (400 con el texto confirmado), `slow` (espera más que el timeout). Los escenarios de error construyen la misma forma que el SDK para pasar por el clasificador real.
- Prohibido en producción (arranque) y usado por los e2e, `manual:capture` y el TC-54.

### D21 — Logs y observabilidad

- Una línea por corrida con `aiRunId`, `task`, `promptVersion`, `model`, `status`, tokens, `costMicroUsd`, `durationMs` y `requestId`. **Nunca** el prompt, la entrada ni la salida.
- Se redacta `x-api-key` y el campo `apiKey`; los mensajes de error pasan por `redactSecrets` con la clave conocida antes de guardarse o loguearse.

## Presupuesto

### Precios reconfirmados (USD por millón de tokens)

Fuente: `https://platform.claude.com/docs/en/about-claude/pricing`, consultada el **2026-11-17**. Coinciden con la tabla del skill `claude-api` (caché del 2026-11-03).

| Modelo | ID | Entrada | Escritura caché 5 min | Lectura caché | Salida |
|---|---|---|---|---|---|
| Haiku 5.5 (prompt ≤ 100K) | `claude-haiku-5-5` | 0,10 | 0,125 | 0,01 | 0,50 |
| Haiku 5.5 (prompt > 100K) | `claude-haiku-5-5` | 0,50 | 0,625 | 0,05 | 2,50 |
| Sonnet 5.5 | `claude-sonnet-5-5` | 2 | 2,50 | 0,10 (0,05×) | 10 |
| Opus 5.5 (fuera del registro) | `claude-opus-5-5` | 4 | 5 | 0,20 (0,05×) | 20 |

`count_tokens`: gratis. Batch: 50 % de descuento (no se usa en este change). `inference_geo: "us"` multiplica por 1,1 (no se usa).

### Cálculo con el tope de 10 USD

Supuestos de la propuesta (§ 7) por mes, con el modelo que este diseño recomienda para cada feature (la elección final la toma el change de cada una con su eval):

| Rubro | Modelo | Por unidad | Mes |
|---|---|---|---|
| Vacante → perfil (30): extracción + selección | Haiku (5K/1K) + Sonnet (20K, 18K en caché / 4K) | ≈ 0,05 (sin caché ≈ 0,08) | 1,5–2,4 |
| Carta y respuestas (15), hasta 2 iteraciones | Sonnet genera (25K/3K ×2) + Haiku evalúa | ≈ 0,17 | ≈ 2,5 |
| Traducción (1 pasada) | Haiku | < 0,05 | < 0,05 |
| Linter capa 2 (4) | Sonnet effort low (20K/2K) | ≈ 0,06 | ≈ 0,25 |
| Asistente (10 sesiones) | Sonnet | ≈ 0,10 | ≈ 1 |
| Humo | Haiku (≈ 200/50) | ≈ 0,00005 | ≈ 0 |
| **Total** | | | **≈ 5,3–6,2 USD** |

- Con **Opus** para las cartas (lo que suponía la propuesta), ese rubro sube a ≈ 4,8 USD y el total a ≈ 7,6–8,5 USD: entra, pero con poco margen. Por eso Opus queda fuera del registro hasta que una eval lo justifique (P2).
- **Reserva pico:** una llamada de Sonnet con 25K de entrada y `max_tokens` 8 000 reserva ≈ 0,15 USD; con `AI_MAX_CONCURRENCY=2` en dos instancias, el pico reservado es < 0,6 USD. Cerca del tope, el guard rechaza la última llamada que no entra aunque su costo real hubiera sido menor: es el precio de no pasarse nunca.
- **Evals en vivo:** con la tarea de humo cuestan centavos; las de las features (≤ 2 USD por corrida con el tope del script) van **fuera** de los 10 USD de la app: P1 = A (workspace de evals con spend limit de 5 USD y tope de 2 USD por corrida).

## Plan de verificación

| Criterio de la ficha | Cómo se verifica |
|---|---|
| Con `AI_ENABLED=true` y sin clave, la API no arranca | e2e de arranque (`ai-env.e2e-spec.ts`): código ≠ 0, el error nombra `ANTHROPIC_API_KEY`, no imprime valores; con `AI_PROVIDER=fake` arranca sin clave; con `fake` y `NODE_ENV=production` no arranca. |
| `BudgetGuard` corta al llegar al tope | unitarios del guard con repositorio en memoria (tope exacto, reserva que pasaría el tope, conciliación, timeout, huérfanas); **e2e contra Postgres** con 20 reservas concurrentes sobre un tope que admite 7: exactamente 7 pasan y `spent + reserved ≤ cap` en todo momento; con `AI_MONTHLY_BUDGET_USD=0` el humo da 422 sin llamar al adaptador. |
| El test de lista negra pasa | las tres capas de D13 en `npm test` y el adaptador espía en el e2e. |
| Se reconfirman los precios en la página oficial | tabla de § Presupuesto con fuente y fecha; `model-pricing.spec.ts` fija los valores; `PRICING_VERIFIED_AT` visible en el panel. |
| `AI_ENABLED=false` no cambia nada | e2e: el cliente del SDK nunca se construye (espía sobre la factory), la suite e2e existente pasa igual y `GET /api/admin/ai/usage` responde `DISABLED`. |
| La ruta pública no depende de la IA | test de arquitectura (D14) y e2e: con `AI_FAKE_SCENARIO=slow`, `GET /api/curated-profiles/all` responde en < 500 ms mientras una llamada de humo espera. |
| Errores de spend limit | unitarios del clasificador con las formas confirmadas (429 del tier, 400 de la Console de organización y de workspace, 429 de rampa, 400 por parámetro) y e2e con `spend-limit-tier`/`spend-limit-console` que bloquean el mes. |
| Evals | cassettes de humo en el CI; `npm run ai:eval` probado en sus tres negativas (sin clave, sin `AI_EVAL_ALLOW_SPEND`, tope insuficiente) **sin hacer ninguna llamada**; la corrida real queda como paso manual del owner. |
| Panel | Vitest del bloque y del aviso con MSW; `a11y:check` con panel sin violaciones nuevas; TC-54 en la app real con el proveedor `fake`. |

## Risks / Trade-offs

- **[El conteo subestima la entrada]** → margen de 10 % + 512 tokens; el exceso se imputa igual; el unitario de `estimate-cost` cubre el caso.
- **[Un timeout se factura y no se sabe]** → se imputa la reserva entera (D8.3). Sobreestima el gasto; nunca lo subestima.
- **[Rechazar una llamada que hubiera entrado]** → consecuencia aceptada de reservar por `max_tokens`. Mitigación: `max_tokens` ajustado por tarea.
- **[Doble barrera desalineada]** → si el spend limit de la Console es menor que `AI_MONTHLY_BUDGET_USD`, corta antes Anthropic y el panel lo muestra como `PROVIDER_BLOCKED` (P1 recomienda workspaces separados).
- **[Inyección de prompt desde una vacante]** → texto delimitado como dato, salida con schema estricto, sin tools de escritura y humano en el bucle; las features que vienen suman su gate determinístico.
- **[El SDK cambia nombres o el helper de Zod]** → versión exacta fijada en `package.json`; el adaptador es el único archivo afectado; la tarea 3.2 verifica la firma contra el SDK instalado.
- **[El texto del 400 de la Console cambia]** → se mantiene la heurística vigente además del prefijo confirmado; si un 400 de presupuesto se clasificara `Permanent`, igual no se reintenta (D9) y el spend limit sigue cortando del lado de Anthropic.
- **[Mover el clasificador a `shared` choca con otro change]** → es un `git mv` con cambio de imports; si hay conflicto, se resuelve a favor de la ubicación nueva.
- **[Precios que cambian]** → `PRICING_VERIFIED_AT` y la fuente en el panel; reconfirmar en cada change de IA.

## Migration Plan

1. Migración aditiva `add_ai_foundation` (enum y dos tablas, sin tocar las existentes), creada con `--create-only` contra una base descartable y revisada a mano.
2. Deploy con `AI_ENABLED=false` (default): sin cambio de comportamiento.
3. El owner crea la clave en la Console (workspace dedicado, P1), fija el spend limit, carga `ANTHROPIC_API_KEY`, `AI_ENABLED=true` y `AI_MONTHLY_BUDGET_USD=10` en Railway y pulsa **Probar conexión**.
4. **Vuelta atrás:** `AI_ENABLED=false` y redeploy. Las tablas quedan inertes; borrarlas es una migración aparte que no hace falta.

## Open Questions

**Resueltas por el owner y la sesión principal el 2026-11-17** (ninguna queda abierta):

- **P1 = A (owner).** Las evals en vivo usan un workspace aparte de la Console, con un spend limit de 5 USD y un tope de 2 USD por corrida; los 10 USD de `AI_MONTHLY_BUDGET_USD` quedan solo para la IA del panel. La clave de evals va en `AI_EVAL_API_KEY` (no es la de la API). Ver D17 y `docs/DEPLOY-RAILWAY.md`.
- **P2.** Opus 5.5 queda fuera del registro hasta que una eval lo justifique (se decide en `add-ai-application-drafts`).
- **P3.** Sin fallback del servidor ante rechazos (D10).
- **P4.** `AiRun.output` se retiene **180 días** y después se purga. Implementado como `npm run ai-runs:purge` (simulación por defecto; `-- --apply` escribe), que deja en `NULL` el `output` de las corridas más viejas y conserva todas las métricas. Una salida purgada ya no acierta en la caché y la tarea vuelve a llamar.
- **P5.** La clave solo viene del entorno (D3).
- **P6.** Los emails y teléfonos del texto libre se redactan (D13).
- **P7.** El aviso «cerca del tope» salta al 80 % (D18).

Texto original de las preguntas, para el historial:


Ver la lista Pn en el informe del arquitecto; se resumen aquí.

- **P1 [bloqueante]** ¿Los 10 USD cubren también las evals en vivo? Opciones: A) no, las evals usan un workspace aparte con su propio spend limit (5 USD) y su tope por corrida; B) sí, todo en un workspace con spend limit de 10 y el ledger compartido; C) un solo workspace con spend limit de 15 USD. **Recomiendo A.**
- **P2 [no bloqueante]** Opus 5.5 fuera del registro hasta que una eval lo justifique. **Recomiendo** mantenerlo fuera y decidir en `add-ai-application-drafts`.
- **P3 [no bloqueante]** Fallback del servidor ante rechazos en Sonnet 5.5. **Recomiendo** apagado ahora y evaluarlo con la primera tarea en Sonnet.
- **P4 [no bloqueante]** Retención de `AiRun.output`. **Recomiendo** 180 días para la salida (las métricas quedan), con un script de purga en el primer change que guarde salidas derivadas de vacantes.
- **P5 [no bloqueante]** ¿Cargar la clave desde el panel? **Recomiendo** no: solo variable de entorno (D3).
- **P6 [no bloqueante]** Emails y teléfonos en el texto de una vacante: redactar o bloquear. **Recomiendo** redactar (D13).
- **P7 [no bloqueante]** Umbral del aviso «cerca del tope». **Recomiendo** 80 %.
