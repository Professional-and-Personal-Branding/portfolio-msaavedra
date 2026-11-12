## MODIFIED Requirements

### Requirement: Catálogo canónico de secciones
El dominio SHALL declarar **un único** catálogo de secciones, `SECTION_IDS`, con estos diez ids en este orden canónico: `hero`, `stats`, `experience`, `skills`, `projects`, `repositories`, `education`, `certifications`, `presence`, `contact`. `DEFAULT_SECTIONS` SHALL ser ese mismo catálogo. Ningún otro módulo, ni el frontend, SHALL declarar una lista propia de secciones: el contrato OpenAPI es el único transporte del catálogo hacia el cliente.

#### Scenario: Orden vacío usa el catálogo completo
- **WHEN** un perfil curado tiene `sectionsOrder` vacío y datos en todas las colecciones, con al menos dos repositorios seleccionados
- **THEN** `sections` contiene los diez ids en el orden canónico

#### Scenario: El catálogo del backend y el tipo del frontend no pueden divergir
- **WHEN** se agrega un id al catálogo del backend y se regeneran los tipos
- **THEN** el frontend no compila hasta que el registro de secciones implemente ese id

### Requirement: Resultado listo para presentación
La vista resuelta SHALL contener los metadatos del perfil curado (`slug`, `title`, `headline`, `description`, `roleType`, `techFocus`, `layout`, `visibility`), `sections`/`hiddenSections` y el `theme` resuelto (ver `theme-resolution`). MUST NOT contener `accentColor`.

#### Scenario: Forma completa
- **WHEN** se resuelve un perfil `PUBLIC`
- **THEN** el resultado tiene exactamente las claves `slug, title, headline, description, roleType, techFocus, layout, visibility, sections, hiddenSections, theme, profile, experiences, skillCategories, projects, repositories, education, certifications, socialLinks`

## ADDED Requirements

### Requirement: Selección de repositorios por tags
Los repositorios visibles SHALL seleccionarse con la misma regla que los proyectos: intersección con `filterTags` (vacío = todos), `excludeIds` prevalece, `includeIds` fuerza solo visibles y los ids inexistentes se ignoran; comparten el espacio de ids de los overrides. `repositories` SHALL ordenarse por `order` ascendente, con la forma de `GET /api/featured-repositories`.

#### Scenario: Repositorio con intersección
- **WHEN** el perfil tiene `filterTags = ["java"]` y un repositorio visible tiene `tags = ["java", "microservices"]`
- **THEN** el repositorio está en `repositories`

#### Scenario: excludeIds sobre un repositorio
- **WHEN** el id de un repositorio que matchea figura en `excludeIds`
- **THEN** no está en `repositories`

#### Scenario: includeIds no fuerza un oculto
- **WHEN** se resuelve `ejemplo-overrides`, cuyo `includeIds` apunta al repositorio oculto del ejemplo
- **THEN** ese repositorio no está en `repositories`

### Requirement: La sección de repositorios necesita dos
La sección `repositories` SHALL contar como sección con datos solo si la vista resuelve **dos o más** repositorios. Con menos, MUST NOT figurar en `sections`, aunque esté en `sectionsOrder`; `repositories` SHALL conservar lo seleccionado.

#### Scenario: Un solo repositorio
- **WHEN** se resuelve `ejemplo-renombrado` contra la base de ejemplo, que selecciona 1 repositorio
- **THEN** `repositories` tiene 1 elemento y `sections` no contiene `repositories`

#### Scenario: Dos repositorios
- **WHEN** se resuelve `ejemplo-backend` contra la base de ejemplo
- **THEN** `repositories` tiene 2 elementos y `sections` contiene `repositories` inmediatamente después de `projects`

#### Scenario: Sin repositorios
- **WHEN** se resuelve cualquier perfil tras sembrar `docs/cv-data.json`
- **THEN** `repositories` es un array vacío y `sections` no contiene `repositories`

### Requirement: Los perfiles sembrados antes del change ubican repositories después de projects
Una migración de datos SHALL insertar `repositories` justo después de `projects` en el `sectionsOrder` de cada perfil curado que tenga `projects` y no tenga `repositories`. MUST NOT tocar los arreglos vacíos ni los que ya lo tienen, y aplicarla dos veces MUST dejar el mismo resultado.

#### Scenario: Perfiles sembrados antes del change ubican repositories después de projects
- **WHEN** se aplica la migración sobre una base cuyos perfiles tienen el orden de nueve ids sin `repositories`
- **THEN** cada uno queda con diez ids y `repositories` entre `projects` y `education`, y los perfiles con `sectionsOrder` vacío no cambian

#### Scenario: Aplicación repetida
- **WHEN** se vuelve a ejecutar el mismo `UPDATE`
- **THEN** no modifica ninguna fila
