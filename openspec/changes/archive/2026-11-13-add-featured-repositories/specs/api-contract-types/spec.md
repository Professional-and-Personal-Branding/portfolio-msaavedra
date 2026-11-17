## ADDED Requirements

### Requirement: Repositorios en el contrato generado
`backend/openapi.json` y `frontend/src/shared/types/api.d.ts` SHALL incluir el id `repositories` en el enum `SectionId`, la clave `repositories` en la respuesta de la vista curada y del preview, y las rutas pública y del panel de repositorios. Ambos archivos SHALL regenerarse con los comandos del proyecto, nunca editarse a mano.

#### Scenario: Sin deriva
- **WHEN** se corre `npm run openapi:export` en `backend/` y `npm run api:types` en `frontend/` sobre la rama del change
- **THEN** `git diff --exit-code` sobre los dos archivos no muestra cambios y el test de deriva del frontend pasa

#### Scenario: Tipo de sección
- **WHEN** se inspecciona `components.schemas.SectionId` en `api.d.ts`
- **THEN** contiene `"repositories"` entre `"projects"` y `"education"`
