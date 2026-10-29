## ADDED Requirements

### Requirement: Campos de credencial opcionales en el seed
Cada elemento de `certifications` del archivo del seed SHALL aceptar `verificationUrl`, `credentialId` y `expiresAt` opcionales, con las mismas reglas que la API del panel. Ausentes SHALL guardarse como `null`. Un valor inválido MUST terminar con código 1 nombrando el campo, antes de borrar nada. `seed:verify` SHALL comparar los tres campos de cada certificación, en orden, con la fuente.

#### Scenario: Seed por defecto sin credenciales
- **WHEN** se ejecuta `npm run seed` con el `docs/cv-data.json` actual sobre una base migrada vacía y después `npm run seed:verify`
- **THEN** las 8 certificaciones tienen los tres campos en `null` y la verificación termina con código 0

#### Scenario: URL insegura en el archivo
- **WHEN** se ejecuta `npm run seed -- --file` con una certificación cuyo `verificationUrl` es `http://example.org/c/1`
- **THEN** el seed termina con código 1, el mensaje nombra `certifications[0].verificationUrl` y los conteos de la base no cambian

#### Scenario: Credencial distinta en la base
- **WHEN** se cambia en la base el `credentialId` de una certificación sembrada y se ejecuta la verificación del seed
- **THEN** termina con código distinto de 0 nombrando la certificación y el campo

#### Scenario: Migración aditiva
- **WHEN** se lee el SQL de la migración que agrega los tres campos
- **THEN** solo contiene `ALTER TABLE "Certification" ADD COLUMN` de columnas nulas, sin `UPDATE` ni `DROP`
