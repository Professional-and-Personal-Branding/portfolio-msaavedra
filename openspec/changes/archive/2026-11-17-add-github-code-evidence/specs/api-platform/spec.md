## ADDED Requirements

### Requirement: Variables del proveedor GitHub validadas al arranque
La configuración SHALL aceptar `GITHUB_SYNC_TOKEN` (opcional) y `GITHUB_TRANSPORT` (`http` por defecto o `fixture`). Un valor de `GITHUB_TRANSPORT` fuera de esos dos, o `fixture` con `NODE_ENV=production`, MUST hacer fallar el arranque con un mensaje que nombre la variable sin imprimir valores. La URL base de GitHub MUST NOT ser configurable por variable.

#### Scenario: Valor desconocido
- **WHEN** la API arranca con `GITHUB_TRANSPORT=proxy`
- **THEN** no arranca y el error nombra `GITHUB_TRANSPORT`

#### Scenario: Por defecto
- **WHEN** la API arranca sin `GITHUB_TRANSPORT`
- **THEN** usa el transporte `http` contra `https://api.github.com`
