## ADDED Requirements

### Requirement: Logs de las corridas de IA
Cada corrida de IA SHALL dejar una línea de log con `aiRunId`, tarea, versión de prompt, modelo, estado, tokens, costo en micro-USD, duración e id de la petición. Los logs MUST NOT contener el prompt, la entrada, la salida ni la clave: SHALL redactarse la cabecera `x-api-key` y el campo `apiKey`, y los mensajes de error pasan por `redactSecrets`.

#### Scenario: Corrida de humo
- **WHEN** corre la tarea de humo con el proveedor `fake`
- **THEN** hay una línea con su `aiRunId` y su costo, y ninguna línea contiene el texto del prompt

#### Scenario: Error que repite la clave
- **WHEN** un error del proveedor incluye el valor de `ANTHROPIC_API_KEY`
- **THEN** ni el log ni `AiRun.failureMessage` lo contienen y en su lugar figura `[Redacted]`
