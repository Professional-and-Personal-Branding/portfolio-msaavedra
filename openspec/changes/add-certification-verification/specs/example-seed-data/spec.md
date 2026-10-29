## ADDED Requirements

### Requirement: Certificaciones verificables en el ejemplo
El ejemplo SHALL incluir una certificación visible con `verificationUrl` https de un dominio de RFC 2606, `credentialId` y `expiresAt` futuro, y otra visible con `expiresAt` pasado y sin `verificationUrl`. Los conteos de certificaciones del ejemplo MUST NOT cambiar por esto.

#### Scenario: Credencial vigente
- **WHEN** se pide `GET /api/certifications` contra la base de ejemplo
- **THEN** una certificación trae `verificationUrl` con `https://` y dominio `example.org`, `credentialId` no nulo y `expiresAt` posterior a 2026

#### Scenario: Credencial vencida sin enlace
- **WHEN** se abre `/` contra la base de ejemplo con la fecha del navegador en octubre de 2026
- **THEN** una certificación muestra «Vencida» y no tiene enlace «Ver credencial»

#### Scenario: Verificación del ejemplo
- **WHEN** se ejecuta `npm run seed:example:verify` justo después de `npm run seed:example`
- **THEN** termina con código 0 y compara también los campos de credencial
