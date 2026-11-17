## ADDED Requirements

### Requirement: Contexto y redacción en los trabajos de integración
Cada línea de log de un trabajo de integración SHALL llevar `syncRunId`, `jobId` y `provider`. Los logs MUST NOT contener credenciales de integraciones: SHALL redactarse los campos `secret`, `ciphertext`, `credential` y `token`, incluido `secret` en el cuerpo de `PUT /api/admin/integrations/:provider/credential`.

#### Scenario: Trazabilidad de un trabajo
- **WHEN** corre un trabajo del proveedor `fake`
- **THEN** todas sus líneas de log llevan el mismo `syncRunId`, que coincide con el id de su fila `SyncRun`

#### Scenario: Guardar una credencial
- **WHEN** se procesa `PUT /api/admin/integrations/fake/credential` con un secreto
- **THEN** ninguna línea de log contiene ese secreto

#### Scenario: Error de un proveedor con el token
- **WHEN** el proveedor `fake` falla con un mensaje que incluye su token
- **THEN** el log muestra `[Redacted]` en su lugar
