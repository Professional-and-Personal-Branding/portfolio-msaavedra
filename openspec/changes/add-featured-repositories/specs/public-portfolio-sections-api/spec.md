## MODIFIED Requirements

### Requirement: Elementos ocultos excluidos
Un registro con `visible = false` MUST NOT aparecer en ninguno de los cinco listados: educación, certificaciones, proyectos, enlaces sociales y repositorios destacados.

#### Scenario: Proyecto oculto
- **WHEN** un proyecto pasa a `visible = false` y un cliente hace `GET /api/projects`
- **THEN** ese proyecto no aparece

#### Scenario: Repositorio oculto
- **WHEN** un cliente hace `GET /api/featured-repositories` contra la base de ejemplo
- **THEN** el repositorio con `visible: false` no aparece

### Requirement: Documentación OpenAPI
El documento OpenAPI SHALL incluir las cinco rutas con el parámetro `locale`.

#### Scenario: Rutas documentadas
- **WHEN** un cliente hace `GET /api/docs-json`
- **THEN** `paths` contiene `/api/education`, `/api/certifications`, `/api/projects`, `/api/social-links` y `/api/featured-repositories`
