# Tasks — add-ai-foundation

> Referencias: `proposal.md`, `design.md` (D1–D21; P1 bloqueante para encender la IA con evals en vivo, P2–P7 no bloqueantes) y los deltas de `specs/`. Borrador del caso del manual en `manual-tc54.md`. La evidencia va en `verification/`, como en los changes anteriores.
>
> **Orden:** 1 → 2 → … → 11. Cada grupo de código va en el mismo commit que sus tests.
>
> **Bases:**
> - `portfolio` (la del owner): **ninguna** tarea le escribe; la migra él.
> - E2e: la base de e2e de siempre (migrada y sembrada).
> - `portfolio_ai_check`: base descartable nueva, sembrada con el ejemplo, para la migración (2) y la app real (9); se borra al terminar. Antes de cada comando que escriba, `npm run prisma:status` para confirmar el destino.
>
> **Red y dinero:** **ninguna tarea llama a la API de Anthropic.** Todo corre con `AI_PROVIDER=fake`, el adaptador de cassettes o un `LlmPort` en memoria. El adaptador real se prueba con un cliente del SDK apuntado a un servidor HTTP en `127.0.0.1` (solo en el test; en la app la URL base es fija). La corrida real de `npm run ai:eval` es un paso del owner.
>
> **Conflictos esperables:** `schema.prisma`, `env.validation.ts`, `configuration.ts`, `app.module.ts`, `architecture.spec.ts`, `IntegrationsPage.tsx`, `DashboardPage`, `MANUAL.md`/`index.html` (TC-53 es de `polish-pre-deploy-cleanup`; **TC-54 es de este change**). Regenerar `openapi.json` y `api.d.ts` con los comandos, nunca a mano.

## 1. Punto de partida

- [x] 1.1 Confirmar en la rama: sin `modules/ai`, sin `@anthropic-ai/sdk` ni `zod` en `backend/package.json`, `classify-anthropic-error.ts` en `integrations/domain/services/`, último caso del manual TC-52 o TC-53. Verificar: `npm test`, `npm run test:e2e`, `npm run lint` y `npm run typecheck` en `backend/`; `npm test`, `npm run build` y `npm run perf:budget` en `frontend/`; salida en `verification/1.1-punto-de-partida.txt`.
  - **Hecho:** Línea base en `verification/1.1-punto-de-partida.txt` (backend 169 suites / 2193 tests y e2e 31 suites / 464 tests; frontend 84 archivos / 1295 tests; `perf:budget` 151,2 KB).
- [x] 1.2 Reconfirmar los precios en `https://platform.claude.com/docs/en/about-claude/pricing` el día de la implementación; si cambiaron, actualizar § Presupuesto de `design.md` y `PRICING_VERIFIED_AT`. Verificar: captura de la tabla (texto) en `verification/1.2-precios.md` con fecha.
  - **Hecho:** Precios idénticos a § Presupuesto, reconfirmados el 2026-11-17 en `verification/1.2-precios.md`; `PRICING_VERIFIED_AT = 2026-11-17`.

## 2. Persistencia (D6)

- [x] 2.1 `schema.prisma`: enum `AiRunStatus`, modelos `AiRun` y `AiBudgetMonth` con los índices de D6. Migración `<timestamp>_add_ai_foundation` con `npx prisma migrate dev --create-only` contra `portfolio_ai_check`, revisada a mano (solo `CREATE TYPE`, `CREATE TABLE` e índices). Verificar: `npm run prisma:migrate` y `npm run prisma:status` sobre la descartable; `npx prisma migrate diff` sin diferencias; SQL en `verification/2.1-migracion.sql`.
  - **Hecho:** Migración `20261117160536_add_ai_foundation` (solo `CREATE TYPE`, `CREATE TABLE` e índices) en `verification/2.1-migracion.sql`; aplicada a la base de e2e y a `portfolio_ai_check`; `prisma migrate status` al día y `migrate diff` sin diferencias.

## 3. Dependencias y dominio compartido (D1, D10)

- [x] 3.1 Mover con `git mv` `provider-failure.ts`, `classify-anthropic-error.ts` y `sanitize-failure.ts` (con sus specs) a `backend/src/shared/domain/provider-failure/` y actualizar los imports de `integrations`. Verificar: `npm run typecheck`, `npm run lint` y `npx jest src/shared src/modules/integrations` en verde sin tocar los asserts existentes.
  - **Hecho:** `git mv` a `shared/domain/provider-failure/`; typecheck, lint y `jest src/shared src/modules/integrations` en verde con los asserts intactos.
- [x] 3.2 Agregar `@anthropic-ai/sdk` (versión exacta, la más reciente que envíe la versión de API `2026-10-21`) y `zod` (misma mayor que el frontend) a `dependencies`. Confirmar en el SDK instalado: `messages.parse`, `zodOutputFormat` con esa Zod, `countTokens`, `output_config.effort`, `thinking: {type: "between_tools"}`, `maxRetries`, `timeout` y la forma de `APIError`. Si `zodOutputFormat` no acepta la versión de Zod, usar `output_config.format` con `z.toJSONSchema` (D5). Verificar: `npm ls @anthropic-ai/sdk zod`, `npm run typecheck`; notas en `verification/3.2-sdk.md`.
  - **Hecho:** `@anthropic-ai/sdk` 1.9.0 (exacta) y `zod` 4.6.7; firmas confirmadas en `verification/3.2-sdk.md` (se usa `messages.create` con `zodOutputFormat`, no `parse`).
- [x] 3.3 Clasificador (MODIFIED *Presupuesto agotado de Anthropic*): prefijo confirmado `^You have reached your specified (workspace )?API usage limits` además de la heurística; `ramp_limit_exceeded` nunca `BudgetExhausted`. Verificar: `classify-anthropic-error.spec.ts` con los seis escenarios del delta (los tres vigentes sin cambios).
  - **Hecho:** `classify-anthropic-error.spec.ts` con los seis escenarios del delta y fixtures `spend-limit-400-console/workspace` y `ramp-limit-429`.

## 4. Dominio de `ai` (D7, D11, D13, D19)

- [x] 4.1 `model-pricing.ts` y `estimate-cost.ts` en micro-USD: reserva (D7) y costo real con tarifa de Haiku por entrada total. Verificar: `model-pricing.spec.ts` (valores de § Presupuesto y `PRICING_VERIFIED_AT`) y `estimate-cost.spec.ts` (con y sin caché, Haiku > 100K, redondeo hacia arriba, `fast-check`: costo real ≤ reserva cuando `output ≤ max_tokens` y la entrada real ≤ estimada).
  - **Hecho:** `model-pricing.spec.ts` y `estimate-cost.spec.ts` (incluye la propiedad con `fast-check`).
- [x] 4.2 `ai-run.entity.ts`: estados y transiciones válidas; una inválida devuelve `fail`. Verificar: unitario con cada transición.
  - **Hecho:** `ai-run.entity.spec.ts`.
- [x] 4.3 `ai-cache-key.ts`: JSON canónico (claves ordenadas, sin `undefined`) y SHA-256. Verificar: unitario (mismo hash con claves en otro orden; distinto con otra versión, modelo, effort o entrada).
  - **Hecho:** `ai-cache-key.spec.ts`.
- [x] 4.4 `data-boundary/`: lista negra de claves y patrones, `assertLlmSafe` y redacción de texto libre (D13). Verificar: unitario con un caso por clave y por patrón (email, `sk-ant-`, `ghp_`, `github_pat_`, JWT, IPv4, IPv6, secreto exacto), redacción de email y teléfono en texto libre, autocontrol; `fast-check` con valores prohibidos incrustados en estructuras arbitrarias → siempre bloqueados o redactados.
  - **Hecho:** `data-boundary.spec.ts` (un caso por clave y patrón, redacción de texto libre, autocontrol y propiedades con `fast-check`).

## 5. Aplicación (D4, D5, D7–D12, D15)

- [x] 5.1 Puertos (`llm.port.ts`, `ai-run.repository.ts`, `ai-budget.repository.ts`, `clock.port.ts`) y `AiTaskDefinition` con el registro de modelos permitidos. Verificar: `registry.spec.ts` (Opus rechazado; thinking apagado con effort ≤ `high`).
  - **Hecho:** Puertos en `application/ports/`; `registry.spec.ts` (Opus rechazado; thinking apagado con effort ≤ `high`).
- [x] 5.2 Prompt y tarea `ai.smoke` v1 (`prompts/ai.smoke/v1.md`, Haiku 5.5, effort `low`, thinking apagado, `max_tokens` 256, schema `{ estado: "ok" }`). Verificar: `prompts.spec.ts` recalcula el SHA-256 de cada prompt y falla si no coincide (autocontrol con un texto alterado).
  - **Hecho:** `prompts/ai.smoke/v1.md` y `registry.spec.ts` (recalcula el SHA-256 y falla con un texto alterado).
- [x] 5.3 `BudgetGuard` (D8): reservar, conciliar, imputar en timeout, barrido de huérfanas, bloqueo del proveedor. Verificar: unitario con repositorio en memoria (tope exacto, reserva que pasaría el tope, tope 0, conciliación menor y mayor que la reserva, timeout, huérfana vencida, bloqueo con y sin fecha, mes UTC en el borde de las 23:59 del último día).
  - **Hecho:** `budget-guard.spec.ts` (tope exacto, reserva que pasaría, tope 0, conciliación, timeout, huérfanas, bloqueo y borde del mes UTC).
- [x] 5.4 `AiTaskRunner`: guardián → caché → conteo → reserva → semáforo → llamada → conciliación → `AiRun`, con `bypassCache`. Verificar: unitario con `LlmPort` en memoria: éxito; caché (1 llamada para 2 corridas); `ForbiddenData` sin conteo ni reserva; `Refused`, `Truncated` e `InvalidOutput` imputan costo; `BudgetExhausted` bloquea el mes; `Transient` sin reintento (1 sola llamada); conteo fallido sin llamada.
  - **Hecho:** `ai-task-runner.spec.ts`.
- [x] 5.5 Casos de uso `GetAiUsageUseCase` (estados y 80 %) y `RunAiSmokeTestUseCase`. Verificar: unitarios (cada estado, `remainingUsd` con 2 decimales, IA apagada → `AiDisabledError`).
  - **Hecho:** `get-ai-usage` y `run-ai-smoke-test` en `ai-use-cases.spec.ts` y `ai-usage-state.spec.ts`.

## 6. Infraestructura (D3, D5, D9, D10, D14, D20, D21)

- [x] 6.1 `AnthropicLlmAdapter` y su factory: `apiKey` y `baseURL` explícitos, `maxRetries: 0` en `messages`, 2 en `countTokens`, `timeout`, `AbortSignal`, `cache_control` si la tarea lo pide, mapeo de thinking por modelo, orden de chequeo de `stop_reason`, traducción de `APIError` al clasificador. Verificar: test contra `http.createServer` en `127.0.0.1` (puerto 0, URL inyectada solo en el test): cuerpo sin `temperature`/`top_p`/`top_k`/`tool_choice`; `thinking` correcto en Haiku y Sonnet; una sola petición ante 529; 429 del tier y 400 de la Console → `BudgetExhausted`; `refusal`, `max_tokens` y JSON inválido; timeout; la cabecera `x-api-key` llega y no aparece en ningún mensaje de error.
  - **Hecho:** `anthropic-llm.adapter.spec.ts` contra un servidor HTTP en `127.0.0.1` (20 casos).
- [x] 6.2 `FakeLlmAdapter` con los escenarios de D20, `DisabledLlmAdapter` y `CassetteLlmAdapter`. Verificar: unitarios (cada escenario pasa por el clasificador real; el deshabilitado nunca llama a la factory).
  - **Hecho:** `ai-adapters.spec.ts` (fake con sus ocho escenarios, disabled y cassettes).
- [x] 6.3 Repositorios Prisma: reserva con `INSERT … ON CONFLICT DO NOTHING` + `UPDATE` condicional en una transacción corta; conciliación; barrido de huérfanas; últimas 20 corridas. Verificar: `npm run typecheck` y los e2e de 8.1.
  - **Hecho:** Repositorios Prisma tipados y cubiertos por los e2e de 8.1 (20 reservas concurrentes, conciliación, huérfanas).
- [x] 6.4 Semáforo por proceso con espera máxima de 2 s y `AiBusyError`. Verificar: unitario (3 pedidos con límite 2: el tercero falla en < 2,5 s; liberar en `finally` aun con error).
  - **Hecho:** `ai-adapters.spec.ts` (semáforo: el tercero falla en menos de 2,5 s, liberación en `finally`).
- [x] 6.5 `AdminAiController` (`GET /api/admin/ai/usage`, `POST /api/admin/ai/smoke` con throttle de 5/min), mapeo de errores (422, 503 con `retry-after`), Swagger y `ai.module.ts` cableado según `AI_ENABLED`/`AI_PROVIDER`. Verificar: `npm run openapi:export` sin errores.
  - **Hecho:** `npm run openapi:export` sin errores (64 rutas, 113 schemas); `openapi.json` versionado.
- [x] 6.6 Configuración (D2): variables en `env.validation.ts` y `configuration.ts`; redacción de `x-api-key` y `apiKey` en `logger.options.ts`; línea de log por corrida (D21). Verificar: `logger.options.spec.ts` con los campos nuevos.
  - **Hecho:** `env.validation.spec.ts` y `logger.options.spec.ts`; línea de log por corrida en `PinoAiRunLogger`.

## 7. Evals (D16, D17)

- [x] 7.1 Casos de `ai.smoke` y tres cassettes (válido, `refusal`, `max_tokens`) en `backend/test/fixtures/ai/cassettes/ai.smoke/`, escritos a mano a partir de la forma documentada de la respuesta (no se graban: no hay clave). Verificar: `npx jest src/modules/ai/evals` sin red; test de cassette faltante y de `promptSha256` viejo con su autocontrol.
  - **Hecho:** Tres cassettes escritos a mano en `backend/test/fixtures/ai/cassettes/ai.smoke/`; `evals.spec.ts` (cassette faltante, `promptSha256` viejo y huérfano, con autocontrol).
- [x] 7.2 `backend/scripts/ai-eval.ts` y `npm run ai:eval`: negativas sin gastar, presupuesto en memoria, tasas, `--record` con redacción y negativa a escribir si queda un secreto o un email ajeno al ejemplo. Verificar: tests del script con un `LlmPort` en memoria (las tres negativas con código 2 y 0 llamadas; corte al llegar al tope; grabación redactada; negativa a grabar un `sk-ant-` simulado); `npm run ai:eval` sin clave sale con 2 (salida en `verification/7.2-ai-eval.txt`). **No** correr con una clave real.
  - **Hecho:** `ai-eval.cli.spec.ts` (negativas con código 2 y 0 llamadas, corte al tope, grabación redactada y negativa a grabar un `sk-ant-`); `npm run ai:eval` sin clave sale con 2 (`verification/7.2-ai-eval.txt`). No se corrió con una clave real.

## 8. E2e y arquitectura (D13, D14, D15)

- [x] 8.1 `test/ai-foundation.e2e-spec.ts` con `AI_ENABLED=true` y `AI_PROVIDER=fake`: (a) humo 201 y `AiRun` `SUCCEEDED`, y un segundo humo vuelve a llamar al adaptador (sin caché); (b) el runner invocado dos veces con la misma entrada de `ai.smoke` sin `bypassCache` → la segunda `CACHED` y una sola llamada; (c) 20 reservas concurrentes contra Postgres con un tope que admite 7 → exactamente 7; (d) `AI_MONTHLY_BUDGET_USD=0` → 422 sin llamada; (e) `spend-limit-tier` y `spend-limit-console` bloquean el mes y el humo siguiente no llama; (f) `slow`: `GET /api/curated-profiles/all` en < 500 ms mientras el humo espera, y el humo termina `FAILED` con la reserva imputada; (g) huérfana vencida → `ABANDONED`; (h) 401 sin sesión; (i) adaptador espía: ningún payload con el email del perfil ni `JWT_SECRET`; (j) con `AI_ENABLED=false` la factory nunca se invoca y `usage` devuelve `DISABLED`. Verificar: `npm run test:e2e` en verde; salida en `verification/8.1-e2e.txt`.
  - **Hecho:** `test/ai-foundation.e2e-spec.ts` (19 casos) en verde; salida en `verification/8.1-e2e.txt`.
- [x] 8.2 `test/ai-env.e2e-spec.ts`: los seis escenarios de *Variables de la IA validadas al arranque* (proceso hijo, código de salida, mensaje sin valores). Verificar: `npm run test:e2e`.
  - **Hecho:** `test/ai-env.e2e-spec.ts` (7 casos, proceso real) en verde.
- [x] 8.3 `architecture.spec.ts`: `@anthropic-ai/sdk` solo en `modules/ai/infrastructure/anthropic/`; `curated-profile`, `profile`, `experience`, `skill`, `analytics` y `featured-repository` no importan `modules/ai`; `modules/ai` no importa `analytics`, `auth`, `share-link` ni la persistencia de credenciales de `integrations`; las únicas escrituras de Prisma en `modules/ai` son `aiRun` y `aiBudgetMonth`. Cada regla con su autocontrol. El escaneo de tokens ya cubre `backend/test/fixtures/ai`. Verificar: `npx jest test/architecture.spec.ts` en verde.
  - **Hecho:** `architecture.spec.ts` (46 tests, con autocontrol de cada regla); el escaneo de tokens cubre `backend/test/fixtures/ai`.
- [x] 8.4 Test de lista negra sobre el ejemplo (D13, capa 3): para cada tarea registrada, `buildInput` con `docs/examples/cv-data.example.json` pasa el guardián y no contiene el email del perfil. Verificar: `npx jest src/modules/ai` en verde.
  - **Hecho:** `tasks-data-boundary.spec.ts` sobre `docs/examples/cv-data.example.json`.

## 9. Frontend (D18)

- [x] 9.1 `npm run openapi:export` y `npm run api:types`; hook `use-ai-usage-api.ts`; bloque «Inteligencia artificial» al final de `IntegrationsPage` con los textos literales de D18, confirmación de **Probar conexión** y tabla de corridas; aviso del Dashboard. Verificar: Vitest con MSW (cada estado, porcentaje y formato de moneda, confirmación real y de prueba, botón deshabilitado con `EXHAUSTED`, aviso del Dashboard solo con `EXHAUSTED`/`PROVIDER_BLOCKED` y sin aviso si la consulta falla); test de la barra sin cambios; test de deriva de `api.d.ts`.
  - **Hecho:** `AiUsageBlock.test.tsx` (22 casos con MSW) y `ai-text.spec.ts`; `api.d.ts` sin deriva.
- [x] 9.2 `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` y `npm run perf:budget` en `frontend/` (el arranque público no crece). Verificar: salidas en `verification/9.2-frontend.txt`.
  - **Hecho:** Lint, typecheck, tests, build y `perf:budget` (151,2 KB, sin cambios) en `verification/9.2-frontend.txt`.

## 10. App real sin red (TC-54)

- [x] 10.1 Contra `portfolio_ai_check` (ejemplo sembrado), API con `AI_ENABLED=true`, `AI_PROVIDER=fake` y el frontend de `frontend/Dockerfile`: seguir el borrador `manual-tc54.md` (apagada, encendida, probar conexión dos veces, tope 0, `spend-limit-tier`, Dashboard). Verificar: pasos y salidas en `verification/10.1-tc54.md`; `npm run a11y:check` con panel y `A11Y_CHECK_DISPOSABLE_DB=1` sin violaciones nuevas. TC-54 queda en 🔍: la llamada real a Anthropic no se ejecuta.
  - **Hecho:** Pasos y salidas en `verification/10.1-tc54.md`; `a11y:check` con panel: 0 violaciones tras corregir la tabla (`verification/a11y-check.txt`). TC-54 queda en 🔍.

## 11. Documentación y cierre

- [x] 11.1 `docs/MANUAL.md` e `index.html`: **TC-54** (desde `manual-tc54.md` y `verification/10.1-tc54.md`), ampliación de B18 con el bloque, las variables, la clave, el tope y el spend limit de la Console, glosario («tope de IA», «reserva», «corrida de IA»); capturas con `npm run manual:capture` y `AI_PROVIDER=fake`. Verificar: `npm run manual:check` con código 0.
  - **Hecho:** TC-54, B18 y glosario en `MANUAL.md` e `index.html`; capturas `bo-integraciones-ia` y `tc54-tope`; `npm run manual:check` con código 0.
- [x] 11.2 `backend/.env.example` (variables `AI_*` comentadas, sin clave), `docs/DEPLOY-RAILWAY.md` (crear la clave en un workspace dedicado, fijar el spend limit de la Console, encender y probar; vuelta atrás con `AI_ENABLED=false`), `docs/ARCHITECTURE.md` (módulo `ai`, frontera de datos, presupuesto) y `docs/CHANGELOG.md`. Verificar: revisión del diff; `npx -y @fission-ai/openspec@1.14.1 validate add-ai-foundation --strict` válido.
  - **Hecho:** `.env.example`, `DEPLOY-RAILWAY.md` (dos workspaces, P1), `ARCHITECTURE.md` y `CHANGELOG.md`; `openspec validate add-ai-foundation --strict` válido.
- [x] 11.3 Cierre: suites completas de backend y frontend, `npx -y @fission-ai/openspec@1.14.1 validate --all --strict` sin fallas nuevas y sin «Archive would refuse», y `git status` limpio fuera de lo esperado. Verificar: salida en `verification/11.3-cierre.txt`. La línea del roadmap en `CLAUDE.md` se agrega al archivar.
  - **Hecho:** Cierre en `verification/11.3-cierre.txt`.
