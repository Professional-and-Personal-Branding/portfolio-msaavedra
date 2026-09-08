## Purpose

Mantiene un contrato único entre backend y frontend: el documento OpenAPI del backend es la fuente de los tipos TypeScript del frontend, de modo que un cambio de contrato rompe la compilación en lugar de fallar en runtime.

## ADDED Requirements

### Requirement: Exportación del documento OpenAPI sin servidor
`npm run openapi:export` (backend) SHALL escribir `backend/openapi.json` con el mismo documento que sirve `GET /api/docs-json`, sin abrir un puerto y sin requerir conexión a la base de datos, y MUST terminar con código 0.

#### Scenario: Exportación
- **WHEN** se ejecuta `npm run openapi:export` en `backend/`
- **THEN** existe `backend/openapi.json` con `paths` que incluyen `/api/profile`, `/api/curated-profiles/{slug}` y `/api/education`, y el proceso termina con código 0

#### Scenario: Igual al documento servido
- **WHEN** se compara `openapi.json` con la respuesta de `GET /api/docs-json` de la API en ejecución
- **THEN** el conjunto de `paths` y de `components.schemas` es idéntico

### Requirement: Tipos del frontend generados del contrato
`npm run api:types` (frontend) SHALL generar `src/shared/types/api.d.ts` a partir de `../backend/openapi.json` con `openapi-typescript`. El cliente HTTP del frontend SHALL usar esos tipos; una ruta o campo inexistente en el contrato MUST fallar en `tsc`.

#### Scenario: Generación
- **WHEN** se ejecuta `npm run api:types`
- **THEN** `src/shared/types/api.d.ts` exporta `paths` con `/api/curated-profiles/{slug}` y `components.schemas.CuratedProfileResponse`

#### Scenario: Deriva de contrato detectada en compilación
- **WHEN** el código del frontend accede a `data.noExiste` sobre la respuesta tipada de un endpoint
- **THEN** `npm run typecheck` falla

#### Scenario: Artefactos versionados
- **WHEN** se clona el repositorio sin backend en ejecución
- **THEN** `npm run build` del frontend funciona con el `api.d.ts` versionado
