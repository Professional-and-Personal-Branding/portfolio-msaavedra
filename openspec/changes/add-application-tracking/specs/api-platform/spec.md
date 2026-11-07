## ADDED Requirements

### Requirement: Violación de una regla de negocio con 422
Un error de dominio que indica una petición bien formada que viola una regla del dominio (`RuleViolationError`) SHALL responder 422 con `{ statusCode: 422, message, error: "Unprocessable Entity" }`, sin stack ni detalles internos. La validación de entrada SHALL seguir respondiendo 400.

#### Scenario: Transición de estado inválida
- **WHEN** el administrador pide pasar una postulación `DRAFT` a `OFFER`
- **THEN** recibe 422 con `error: "Unprocessable Entity"` y un `message` que nombra los dos estados, sin campo `stack`

#### Scenario: Entrada mal formada
- **WHEN** envía un `status` que no existe
- **THEN** recibe 400 con `error: "Bad Request"`
