## ADDED Requirements

### Requirement: Variables de la IA validadas al arranque
La validación de entorno SHALL aceptar `AI_ENABLED` (default `false`), `AI_PROVIDER` (`anthropic` o `fake`), `ANTHROPIC_API_KEY`, `AI_MONTHLY_BUDGET_USD` (0 a 1000, default 10), `AI_REQUEST_TIMEOUT_MS`, `AI_MAX_CONCURRENCY`, `AI_MAX_INPUT_TOKENS` y `AI_FAKE_SCENARIO`. Con `AI_ENABLED=true` y `anthropic` sin clave, o `fake` en producción, MUST fallar el arranque nombrando la variable sin imprimir valores.

#### Scenario: Encendida sin clave
- **WHEN** la API arranca con `AI_ENABLED=true`, `AI_PROVIDER=anthropic` y sin `ANTHROPIC_API_KEY`
- **THEN** el proceso termina con código distinto de 0 y el error nombra `ANTHROPIC_API_KEY`

#### Scenario: Proveedor fake sin clave
- **WHEN** la API arranca con `AI_ENABLED=true`, `AI_PROVIDER=fake` y `NODE_ENV=development`
- **THEN** arranca sin pedir `ANTHROPIC_API_KEY`

#### Scenario: Fake en producción
- **WHEN** la API arranca con `AI_PROVIDER=fake` y `NODE_ENV=production`
- **THEN** no arranca y el error nombra `AI_PROVIDER`

#### Scenario: Presupuesto inválido
- **WHEN** la API arranca con `AI_MONTHLY_BUDGET_USD=-1`
- **THEN** no arranca y el error nombra `AI_MONTHLY_BUDGET_USD`

#### Scenario: Apagada por defecto
- **WHEN** la API arranca sin ninguna variable `AI_*`
- **THEN** arranca con la IA apagada y tope de 10 USD

#### Scenario: Clave que no se imprime
- **WHEN** el arranque falla por otra variable con `ANTHROPIC_API_KEY` definida
- **THEN** el mensaje de error no contiene el valor de la clave
