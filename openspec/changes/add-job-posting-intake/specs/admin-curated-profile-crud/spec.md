## ADDED Requirements

### Requirement: Borrador de perfil desde una vacante
`POST /api/admin/curated-profiles/from-job-posting` SHALL crear un perfil curado a partir de una vacante importada, que lee por el puerto de lectura de `job-posting`: título del cuerpo o de la vacante en ES y EN, titular vacío, sin overrides, layout `classic`, secciones por defecto, `PRIVATE`, `listed: false` y sin token. Una vacante inexistente SHALL dar 404.

#### Scenario: Borrador privado
- **WHEN** el owner crea un borrador desde una vacante con `filterTags: ["java", "spring-boot"]`
- **THEN** responde 201 con un perfil `PRIVATE`, `listed: false`, esos `filterTags` y el título de la vacante, y la vacante no cambia

#### Scenario: Vacante inexistente
- **WHEN** el `jobPostingId` no existe
- **THEN** la respuesta es 404 y no se crea ningún perfil

#### Scenario: No se enumera
- **WHEN** se crea el borrador y se pide `sitemap.xml` o `GET /api/curated-profiles/{slug}` del borrador
- **THEN** el sitemap no lo lista y la ruta pública responde 404

### Requirement: Tags del borrador dentro del vocabulario
Los `filterTags` del borrador SHALL ser entre 1 y 20, sin repetidos, y cada uno SHALL existir en el vocabulario vigente (tags de experiencias y proyectos visibles y de las skills); si no, la respuesta SHALL ser 400 nombrando los desconocidos. El slug SHALL ser el dado (409 si está ocupado) o el derivado de empresa y puesto con el primer sufijo libre hasta `-50`.

#### Scenario: Tag inventado
- **WHEN** el cuerpo trae `filterTags: ["java", "cobol-mainframe"]` y `cobol-mainframe` no está en el vocabulario
- **THEN** la respuesta es 400 que nombra `cobol-mainframe` y no se crea ningún perfil

#### Scenario: Sin tags
- **WHEN** el cuerpo trae `filterTags: []`
- **THEN** la respuesta es 400

#### Scenario: Slug derivado ocupado
- **WHEN** el slug derivado `acme-ejemplo-backend-engineer` ya existe
- **THEN** el borrador se crea con `acme-ejemplo-backend-engineer-2`

#### Scenario: Slug elegido ocupado
- **WHEN** el cuerpo trae un `slug` que ya usa otro perfil o un alias
- **THEN** la respuesta es 409
