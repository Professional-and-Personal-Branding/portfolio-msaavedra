## MODIFIED Requirements

### Requirement: Selección de skills por categoría
El sistema SHALL aplicar a las skills la misma regla de tags y overrides que a las experiencias (los overrides comparten el mismo espacio de ids). El resultado SHALL agruparse por categoría, conservando el orden de categorías y de skills; una categoría sin skills seleccionadas MUST NOT aparecer.

#### Scenario: Categoría filtrada parcialmente
- **WHEN** una categoría tiene 3 skills y solo 2 comparten tag con `filterTags`
- **THEN** la categoría aparece con exactamente esas 2 skills, en su orden original

#### Scenario: Categoría vacía desaparece
- **WHEN** ninguna skill de una categoría matchea ni está en `includeIds`
- **THEN** la categoría no aparece en el resultado

#### Scenario: Datos seed — all trae todas las categorías
- **WHEN** se resuelve el perfil `all`
- **THEN** aparecen las 12 categorías con sus 108 skills

#### Scenario: includeIds de una skill hace aparecer su categoría
- **WHEN** ninguna skill de una categoría matchea por tag y el id de una de ellas está en `includeIds`
- **THEN** la categoría aparece con esa sola skill

#### Scenario: excludeIds quita una skill que matchea
- **WHEN** una skill comparte tag con `filterTags` y su id está en `excludeIds`
- **THEN** la skill no aparece y su categoría conserva las demás skills seleccionadas

#### Scenario: Id de categoría en los overrides
- **WHEN** `excludeIds` contiene el id de una categoría y no el de sus skills
- **THEN** la categoría y sus skills se resuelven como si ese id no estuviera

### Requirement: Selección de proyectos por tags
Los proyectos visibles SHALL seleccionarse con la misma regla que las experiencias: intersección con `filterTags` (vacío = todos), `excludeIds` prevalece e `includeIds` fuerza la inclusión; comparten el espacio de ids de los overrides. El resultado SHALL ordenarse por `order` ascendente.

#### Scenario: Proyecto con intersección
- **WHEN** el perfil tiene `filterTags = ["java"]` y un proyecto tiene `tags = ["erp", "java"]`
- **THEN** el proyecto se incluye

#### Scenario: Sin intersección
- **WHEN** el perfil tiene `filterTags = ["devops"]` y ningún proyecto comparte tag
- **THEN** `projects` es un array vacío

#### Scenario: Override sobre un proyecto
- **WHEN** el id de un proyecto que matchea figura en `excludeIds`
- **THEN** no se incluye

#### Scenario: Datos seed
- **WHEN** se resuelve `tech-lead-dotnet`
- **THEN** `projects` contiene los 2 proyectos del JSON (ambos intersectan) y `devops-platform` devuelve 0

#### Scenario: includeIds fuerza un proyecto sin intersección
- **WHEN** un proyecto visible no comparte tags con `filterTags` y su id está en `includeIds`
- **THEN** el proyecto se incluye, en su posición según `order`

#### Scenario: includeIds no fuerza un proyecto oculto
- **WHEN** un proyecto tiene `visible = false` y su id está en `includeIds`
- **THEN** no se incluye

#### Scenario: Datos de ejemplo — ejemplo-overrides
- **WHEN** se resuelve `ejemplo-overrides` sobre `docs/examples/cv-data.example.json`
- **THEN** `projects` contiene Plataforma de Reservas y Herramienta Interna de Métricas, ninguna categoría contiene Kotlin y Prototipo en Pausa no aparece
