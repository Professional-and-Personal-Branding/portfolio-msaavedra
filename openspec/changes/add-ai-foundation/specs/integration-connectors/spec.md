## MODIFIED Requirements

### Requirement: Presupuesto agotado de Anthropic
El clasificador de Anthropic SHALL mapear a `BudgetExhausted` el 429 `rate_limit_error` con `error.details.error_code` `enforced_spend_limit_reached` (reinicio el día 1 del mes siguiente a las 00:00 UTC), el 400 `invalid_request_error` del spend limit de la Console (organización o workspace) y el 402 `billing_error`. Cualquier otro 400 MUST ser `Permanent` y el 429 `ramp_limit_exceeded` MUST NOT ser `BudgetExhausted`.

#### Scenario: Tope del tier
- **WHEN** llega un 429 `rate_limit_error` con `enforced_spend_limit_reached` el 15 de marzo
- **THEN** el fallo es `BudgetExhausted` con reinicio el 1 de abril a las 00:00 UTC

#### Scenario: Spend limit de la Console
- **WHEN** llega un 400 `invalid_request_error` cuyo mensaje informa el spend limit alcanzado
- **THEN** el fallo es `BudgetExhausted` sin fecha de reinicio

#### Scenario: Request mal formada
- **WHEN** llega un 400 `invalid_request_error` por un parámetro inválido
- **THEN** el fallo es `Permanent`, no `BudgetExhausted`

#### Scenario: Texto confirmado del límite de workspace
- **WHEN** llega un 400 `invalid_request_error` cuyo mensaje empieza por «You have reached your specified workspace API usage limits»
- **THEN** el fallo es `BudgetExhausted` sin fecha de reinicio

#### Scenario: Límite de rampa
- **WHEN** llega un 429 `rate_limit_error` con `error.details.error_code` `ramp_limit_exceeded` y `retry-after: 20`
- **THEN** el fallo es `RetryAfter` de 20 segundos, no `BudgetExhausted`

#### Scenario: Parámetro de thinking rechazado
- **WHEN** llega un 400 `invalid_request_error` con «"thinking.type.disabled" is not supported for this model»
- **THEN** el fallo es `Permanent`
