# admin-curated-profile-crud Specification (delta)

## ADDED Requirements

### Requirement: Validación de ids de sección
`POST /api/admin/curated-profiles`, `PATCH /api/admin/curated-profiles/{id}` y `POST /api/admin/curated-profiles/preview` SHALL rechazar con **400** cualquier `sectionsOrder` o `sectionsHidden` que contenga un id fuera del catálogo canónico, y el mensaje de error MUST nombrar el id inválido. Los ids desconocidos MUST NOT descartarse en silencio ni normalizarse. El OpenAPI SHALL declarar ambos campos como arrays del enum de secciones.

#### Scenario: Id inválido al crear
- **WHEN** se hace `POST /api/admin/curated-profiles` con `sectionsOrder: ["hero", "heroe"]`
- **THEN** responde 400 y el mensaje contiene `heroe`, y no se crea ningún perfil

#### Scenario: Id inválido al editar
- **WHEN** se hace `PATCH` con `sectionsHidden: ["proyectos"]`
- **THEN** responde 400 y el perfil queda sin cambios

#### Scenario: Id inválido en el preview
- **WHEN** se hace `POST /api/admin/curated-profiles/preview` con un id de sección inexistente
- **THEN** responde 400, para que no se pueda previsualizar algo que no se podría guardar

#### Scenario: Los nueve ids del catálogo se aceptan
- **WHEN** se hace `PATCH` con los nueve ids del catálogo en `sectionsOrder`
- **THEN** responde 200 y los persiste en ese orden
