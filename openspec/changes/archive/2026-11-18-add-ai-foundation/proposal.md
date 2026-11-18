# add-ai-foundation — Base de IA: `LlmPort`, presupuesto, frontera de datos y evals

> Primer change de la **Fase 2.0** de `docs/PROPUESTA-FEATURES.md` (§ 4, épica E6, ítems **6.1** y **6.2**; § 6.2, fila `add-ai-foundation`). Criterio de la ficha: «Con `AI_ENABLED=true` y sin clave, la API no arranca. `BudgetGuard` corta al llegar al tope. El test de lista negra pasa. Se reconfirman los precios en la página oficial.» Decisión del owner del 2026-11-17 (pregunta 4 = B): **Anthropic, con un tope propio de 10 USD por mes** en `AI_MONTHLY_BUDGET_USD` y, como segunda barrera, el spend limit de la Console. Precios reconfirmados el 2026-11-17 en `https://platform.claude.com/docs/en/about-claude/pricing` (tabla en `design.md` § Presupuesto).

## Why

La Fase 2.0 suma features con IA (vacante a perfil, cartas con evidencia, traducción asistida, linter capa 2 y asistente). Todas comparten los mismos riesgos: gastar de más, mandar datos que no deben salir, depender de un tercero en la ruta pública, aplicar sin revisión lo que propone un modelo y no poder medir si un cambio de prompt empeora las cosas. Si cada feature resuelve eso por su cuenta, se resuelve cinco veces y distinto.

Este change pone la base una sola vez, **sin ninguna feature de IA para el usuario**: un puerto, un adaptador oficial y uno falso, el registro de cada corrida con su costo, un tope mensual que no se puede pasar ni con llamadas concurrentes, caché por hash, prompts versionados, una frontera de datos con su test de lista negra, evals que corren en el CI sin red ni clave y una vista de solo lectura del gasto en el panel. Con `AI_ENABLED=false` (el default) la app funciona exactamente igual que hoy.

## What Changes

- **Módulo `ai`** en Clean Architecture (D1): `LlmPort` en `application`; `AnthropicLlmAdapter` (SDK oficial `@anthropic-ai/sdk`, nada de `fetch` a mano), `FakeLlmAdapter` y `DisabledLlmAdapter` en `infrastructure`; `AiTaskRunner` como servicio de aplicación que reusan los casos de uso de IA de los módulos dueños del dato (los que vienen).
- **Configuración** (D2, D3): `AI_ENABLED` (default `false`), `AI_PROVIDER` (`anthropic` o `fake`, este último prohibido en producción), `ANTHROPIC_API_KEY` (obligatoria si `AI_ENABLED=true` con `anthropic`: **sin ella la API no arranca**), `AI_MONTHLY_BUDGET_USD` (default **10**), `AI_REQUEST_TIMEOUT_MS`, `AI_MAX_CONCURRENCY` y `AI_MAX_INPUT_TOKENS`. La clave solo viene del entorno (no del keyring) y la URL base de Anthropic no es configurable.
- **Modelos por tarea** (D4): cada tarea declara en código su modelo, effort, thinking y `max_tokens`. Default **Haiku 5.5**; Sonnet 5.5 solo si la eval lo justifica; **Opus fuera del registro** en este change. Parámetros vigentes de la API: sin `temperature`/`top_p`/`top_k`, sin prefill, sin `tool_choice` forzado; salida con `output_config.format` y validación con Zod en el código (D5).
- **`AiRun`** (D6, migración aditiva): una fila por corrida con tarea, versión de prompt, modelo, hash de la entrada, tokens (entrada, salida, lectura y escritura de caché), costo estimado (reserva) y real, estado, resultado validado, duración, `stop_reason` e id de la petición. **Nunca la entrada en crudo.**
- **`BudgetGuard`** (D7, D8): reserva antes de llamar (`count_tokens` con margen + `max_tokens` × precio de salida) con un `UPDATE` condicional atómico sobre `AiBudgetMonth`, corta al llegar al tope, concilia con el `usage` real y libera la diferencia. Las reservas huérfanas vencen y se imputan completas. Mes calendario UTC, como el de Anthropic.
- **Sin reintentos automáticos de la llamada facturable** (D9): el SDK va con `maxRetries: 0` en `messages`; un fallo transitorio vuelve al owner, que reintenta a mano. Un timeout imputa la reserva entera.
- **Errores** (D10): se reusa `classifyAnthropicError` (movido a `shared/domain` junto con `ProviderFailure` y `sanitizeFailure`, sin cambiar su comportamiento salvo lo que sigue). El 429 `enforced_spend_limit_reached` y el 400 «You have reached your specified … API usage limits» (texto **ahora confirmado** en la doc oficial) pasan a `BudgetExhausted` y bloquean nuevas llamadas hasta el reinicio; se distinguen de un 400 por una request mal formada. Rechazo (`stop_reason: "refusal"`), truncado (`max_tokens`) y salida inválida son fallos tipados.
- **Caché por hash** (D11): misma tarea, versión de prompt, modelo, effort, schema y entrada canónica → se devuelve el resultado guardado sin llamar ni gastar.
- **Prompts versionados en el repo** (D12) con el hash del texto registrado: editar un prompt sin subir la versión hace fallar el CI.
- **Frontera de datos** (D13): solo salen datos del CV y de las vacantes, armados por constructores con lista blanca. Un guardián en `application` bloquea claves y valores prohibidos (email, credenciales, tokens, IPs, hashes, sal, datos de visitas) y redacta emails y teléfonos del texto libre. **Test de lista negra** en tres capas.
- **Ruta pública aislada y sin cuellos de botella** (D14): ninguna ruta pública ni el render llaman a la IA (test de arquitectura); timeouts por petición, semáforo por proceso y respuesta inmediata «ocupado» si no hay lugar.
- **Humano en el bucle** (D15): ninguna salida de IA se escribe sola; el runner devuelve propuestas y no tiene acceso de escritura a otros agregados.
- **Evals** (D16, D17): cassettes en `backend/test/fixtures/ai/` que corren en el CI sin red ni clave, con validadores sobre las salidas estructuradas; `npm run ai:eval` a demanda contra la API real, con tope de costo por corrida, solo con la clave y `AI_EVAL_ALLOW_SPEND=1`, y **solo con los datos ficticios** de `docs/examples/`. La grabación redacta secretos y el escaneo de `sk-ant-` sigue pasando.
- **Panel de solo lectura** (D18): bloque **Inteligencia artificial** dentro de `/admin/integraciones` (sin ítem nuevo en la barra) con estado, gasto del mes contra el tope, reservado, corridas recientes y **Probar conexión** (tarea interna de humo); aviso en el Dashboard si el tope se alcanzó. API `GET /api/admin/ai/usage` y `POST /api/admin/ai/smoke`.
- **Docs y contrato:** `openapi.json` y `api.d.ts` regenerados; `docs/MANUAL.md` e `index.html` con **TC-54** (borrador en `manual-tc54.md` de este change) y la ampliación de B18; `docs/DEPLOY-RAILWAY.md` (clave, workspace y spend limit de la Console); `backend/.env.example`; `docs/ARCHITECTURE.md`; `docs/CHANGELOG.md`; la línea del roadmap en `CLAUDE.md` al archivar.

## Non-goals

- **Features de IA para el usuario** (vacante a perfil, cartas, traducción, linter capa 2, asistente): cada una en su change (`add-ai-vacancy-to-profile` y siguientes).
- **Tool use, agentes y Batch API**: los trae el change que los necesite (`add-admin-assistant`, `add-ai-translation-assist`).
- **Streaming**: las tareas de esta base tienen `max_tokens` chico; se suma cuando una tarea lo pida.
- **Fallback del servidor ante un rechazo** (`server-side-fallback-2026-07-01`): apagado en este change (D10, P3).
- **Opus 5.5** y cualquier modelo fuera del registro (P2).
- **Cargar la clave desde el panel** o guardarla en el keyring (D3, P5).
- **Otros proveedores** (OpenAI, Bedrock, Vertex): el owner eligió Anthropic.
- **Datos reales del owner en las evals**: solo los ficticios del ejemplo.

## Capabilities

### New Capabilities

- `ai-assistance`: IA apagada por defecto, puerto y adaptadores, modelos por tarea, parámetros vigentes, salidas validadas, rechazo y truncado, `AiRun`, tope mensual con reserva, conciliación, concurrencia, reservas huérfanas, caché por hash, prompts versionados, frontera de datos y redacción, corte por spend limit, sin reintentos facturables, timeouts y semáforo, ruta pública aislada, humano en el bucle, API de uso, tarea de humo, evals con cassettes y en vivo, cassettes sin secretos y precios versionados.

### Modified Capabilities

- `integration-connectors`: MODIFIED *Presupuesto agotado de Anthropic* (texto confirmado del 400 de la Console, variante de workspace y el 429 `ramp_limit_exceeded` que **no** es presupuesto). Se copian sus tres escenarios vigentes.
- `api-platform`: ADDED *Variables de la IA validadas al arranque*.
- `api-observability`: ADDED *Logs de las corridas de IA*.
- `admin-backoffice-shell`: ADDED *Bloque Inteligencia artificial en Integraciones* y *Aviso de IA en el Dashboard*.
- `platform-manual`: ADDED *Caso TC-54 de la base de IA*.

La pantalla Integraciones se amplía con un requisito `ADDED` en lugar de modificar *Pantalla Integraciones*: el bloque nuevo no cambia ninguno de sus escenarios.

## Impact

- **Backend:** módulo nuevo `backend/src/modules/ai/`; `shared/domain/provider-failure/` (movidos `provider-failure.ts`, `classify-anthropic-error.ts` y `sanitize-failure.ts` con sus specs; integraciones solo cambia imports); `config/env.validation.ts` y `config/configuration.ts`; `app.module.ts`; `shared/infrastructure/http/logger.options.ts` (redacción de `x-api-key`); `backend/test/architecture.spec.ts` (reglas nuevas); script `backend/scripts/ai-eval.ts`; `package.json` (`@anthropic-ai/sdk` y `zod` en dependencias, `ai:eval`).
- **Base:** migración aditiva `add_ai_foundation` (enum `AiRunStatus`, tablas `AiRun` y `AiBudgetMonth`). Sin cambios en tablas existentes.
- **Frontend:** bloque en `IntegrationsPage`, aviso del Dashboard, hook `use-ai-usage-api.ts`; `api.d.ts` regenerado. Sin cambios en la parte pública ni en `perf:budget` (el panel es un chunk aparte).
- **CI:** las evals de cassettes corren dentro de `npm test` del job `backend`; ningún job tiene la clave.
- **Costo:** 0 USD con `AI_ENABLED=false`. Encendida, la tarea de humo cuesta unos 0,00005 USD por llamada con Haiku 5.5.
- **Riesgo de conflicto:** `schema.prisma`, `env.validation.ts`, `configuration.ts`, `IntegrationsPage.tsx`, `architecture.spec.ts`, `MANUAL.md`/`index.html` (TC-53 lo reserva `polish-pre-deploy-cleanup`; TC-54 es de este change).
