## MODIFIED Requirements

### Requirement: Certificaciones visibles
`GET /api/certifications` SHALL devolver 200 con las certificaciones visibles ordenadas por `order`. Cada elemento MUST contener `id`, `name` (resuelto), `issuer`, `year` (nulo si no aplica), `order`, `verificationUrl`, `credentialId` y `expiresAt` (cada uno nulo si no se cargó). Estos tres no se traducen y la API no calcula si la certificación está vencida.

#### Scenario: Listado tras el seed
- **WHEN** un cliente hace `GET /api/certifications`
- **THEN** recibe 8 elementos y el primero tiene `issuer` igual al del JSON

#### Scenario: Certificación sin credencial
- **WHEN** un cliente hace `GET /api/certifications` tras sembrar `docs/cv-data.json`
- **THEN** cada elemento tiene `verificationUrl`, `credentialId` y `expiresAt` en `null`

#### Scenario: Certificación con credencial en los dos idiomas
- **WHEN** una certificación tiene `verificationUrl: "https://example.org/c/1"`, `credentialId: "EJ-1"` y `expiresAt: "2029-06"` y un cliente pide `GET /api/certifications?locale=en`
- **THEN** el elemento trae esos tres valores sin cambios, igual que con `locale=es`, y no trae ningún campo `expired`

#### Scenario: La vista curada usa la misma forma
- **WHEN** un cliente pide `GET /api/curated-profiles/all` con esa misma certificación cargada
- **THEN** su elemento de `certifications` trae `verificationUrl`, `credentialId` y `expiresAt` con los mismos valores
