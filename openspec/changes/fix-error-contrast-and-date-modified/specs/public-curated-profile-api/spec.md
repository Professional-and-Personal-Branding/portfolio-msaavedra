## ADDED Requirements

### Requirement: La vista resuelta informa su última edición
La vista resuelta de `GET /api/curated-profiles/:slug` y del preview del constructor SHALL incluir `updatedAt`: la fecha de la última edición del perfil curado como ISO 8601 en UTC, o `null` si el perfil no tiene fila (borrador del preview). MUST salir de la misma lectura que ya resuelve el perfil, sin consultas nuevas, y una visita MUST NOT cambiarla.

#### Scenario: Perfil público
- **WHEN** el perfil `tech-lead-dotnet` tiene `updatedAt` en `2026-01-15T12:00:00.000Z` y un cliente hace `GET /api/curated-profiles/tech-lead-dotnet`
- **THEN** recibe 200 con `updatedAt: "2026-01-15T12:00:00.000Z"`

#### Scenario: Borrador en el preview
- **WHEN** el constructor pide el preview de un perfil que todavía no se guardó
- **THEN** la respuesta trae `updatedAt: null`

#### Scenario: Contrato generado
- **WHEN** se corre `npm run openapi:export` y después `npm run api:types`
- **THEN** `CuratedProfileResponse` declara `updatedAt` como string nullable con formato `date-time` y el test de deriva del frontend pasa
