# curated-profile-resolution Specification (delta)

## MODIFIED Requirements

### Requirement: Catálogo canónico de secciones
El dominio SHALL declarar **un único** catálogo de secciones, `SECTION_IDS`, con estos nueve ids en este orden canónico: `hero`, `stats`, `experience`, `skills`, `projects`, `education`, `certifications`, `presence`, `contact`. `DEFAULT_SECTIONS` SHALL ser ese mismo catálogo. Ningún otro módulo, ni el frontend, SHALL declarar una lista propia de secciones: el contrato OpenAPI es el único transporte del catálogo hacia el cliente.

#### Scenario: Orden vacío usa el catálogo completo
- **WHEN** un perfil curado tiene `sectionsOrder` vacío y datos en todas las colecciones
- **THEN** `sections` contiene los nueve ids en el orden canónico

#### Scenario: El catálogo del backend y el tipo del frontend no pueden divergir
- **WHEN** se agrega un id al catálogo del backend y se regeneran los tipos
- **THEN** el frontend no compila hasta que el registro de secciones implemente ese id

### Requirement: La resolución devuelve el orden final, con relleno aplicado
El composer SHALL devolver en `sections` el orden **final** que se renderiza. Para eso, después de aplicar `sectionsOrder` y `sectionsHidden`, SHALL agregar al final las secciones del catálogo que (a) tengan datos tras el filtrado, (b) no estén ocultas y (c) no figuren ya en el orden. El relleno MUST NOT duplicar ids ni reordenar los que ya venían. Una sección sin datos MUST NOT aparecer en `sections`, aunque figure en `sectionsOrder`. El cliente MUST NOT recalcular el orden ni completarlo.

#### Scenario: Sección con datos omitida del orden
- **WHEN** un perfil declara `sectionsOrder: ["hero", "experience"]`, tiene proyectos que pasan el filtro y no oculta nada
- **THEN** `sections` empieza con `hero` y `experience`, e incluye `projects` después de ellas

#### Scenario: Sección sin datos no se rellena
- **WHEN** un perfil declara `sectionsOrder: ["hero"]` y ningún proyecto pasa el filtro
- **THEN** `sections` no contiene `projects`

#### Scenario: Sección oculta no se rellena
- **WHEN** un perfil declara `sectionsOrder: ["hero"]`, `sectionsHidden: ["projects"]` y tiene proyectos que pasan el filtro
- **THEN** `sections` no contiene `projects` y `hiddenSections` sí

#### Scenario: El orden declarado no se altera
- **WHEN** un perfil declara `sectionsOrder: ["contact", "hero", "experience"]`
- **THEN** esos tres ids aparecen en `sections` en ese mismo orden, antes de cualquier id agregado por relleno

#### Scenario: Id repetido en el orden
- **WHEN** un perfil declara `sectionsOrder: ["hero", "hero", "experience"]`
- **THEN** `sections` contiene `hero` una sola vez
