## MODIFIED Requirements

### Requirement: Las secciones ocultas no se exportan
Una clave SHALL emitirse solo si una de sus secciones está en `sections` de la vista resuelta: `experience` → `work`, `skills` → `skills`, `projects` y `repositories` → `projects`, `education` → `education`, `certifications` → `certificates`, `presence` → `basics.profiles`, `contact` → `basics.email`, `basics.phone` y `languages`. `basics` SHALL emitirse siempre; `stats` no tiene equivalente.

#### Scenario: Presencia oculta
- **WHEN** se exporta `ejemplo-secciones`, que oculta `stats` y `presence`
- **THEN** `basics` no tiene `profiles` y el resto de las claves con datos sí está

#### Scenario: Contacto oculto
- **WHEN** un perfil oculta `contact`
- **THEN** el documento no tiene `basics.email`, `basics.phone` ni `languages`, y sí `basics.name`

#### Scenario: Hero oculto
- **WHEN** un perfil oculta `hero`
- **THEN** `basics` sigue con `name`, `label`, `url` y `summary`

#### Scenario: Sección sin datos
- **WHEN** la selección de un perfil deja `projects` vacío y `sections` no contiene `repositories`
- **THEN** el documento no tiene la clave `projects`

#### Scenario: Un solo repositorio no se exporta
- **WHEN** se exporta `ejemplo-renombrado`, que resuelve 1 repositorio y por eso no tiene `repositories` en `sections`
- **THEN** `projects` contiene solo sus proyectos

## ADDED Requirements

### Requirement: Repositorios como proyectos del JSON Resume
Con `repositories` en `sections`, cada repositorio de la vista SHALL agregarse a `projects` después de los proyectos y en su orden, con `name`, `description`, `url`, `keywords` (el lenguaje primero si no figura entre las tecnologías, luego las tecnologías, sin repetidos sin distinguir mayúsculas) y `type: "repository"`, sin fechas ni `roles`.

#### Scenario: Perfil con repositorios
- **WHEN** se exporta `ejemplo-backend` contra la base de ejemplo
- **THEN** `projects` termina con 2 entradas `type: "repository"` cuyas `url` empiezan con `https://github.com/`, y el documento valida contra el schema vendorizado

#### Scenario: Proyectos ocultos y repositorios visibles
- **WHEN** un perfil oculta `projects` y resuelve 2 repositorios
- **THEN** `projects` contiene solo las 2 entradas de repositorio
