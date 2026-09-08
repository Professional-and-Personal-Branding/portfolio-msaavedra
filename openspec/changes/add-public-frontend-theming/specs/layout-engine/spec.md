## Purpose

Permite que los mismos datos resueltos se presenten con estructuras distintas y en el orden que define cada perfil curado, base del constructor visual de la Fase 5.

## ADDED Requirements

### Requirement: Layouts estructurales conmutables
El frontend SHALL ofrecer al menos dos layouts que reciben los mismos datos: `classic` (una columna, hero arriba, como el demo) y `sidebar` (columna lateral fija con identidad y contacto; contenido a la derecha; en móvil la columna pasa arriba). El layout activo SHALL ser el `layout` del perfil curado, y `?layout=classic|sidebar` SHALL poder sobrescribirlo. Un valor desconocido MUST caer a `classic`.

#### Scenario: Layout del perfil
- **WHEN** el perfil curado tiene `layout: "sidebar"`
- **THEN** se renderiza `SidebarLayout`

#### Scenario: Override por URL
- **WHEN** se abre `/all?layout=sidebar`
- **THEN** se renderiza `SidebarLayout` aunque el perfil tenga `classic`

#### Scenario: Valor desconocido
- **WHEN** el layout es `"timeline-3d"`
- **THEN** se renderiza `ClassicLayout`

### Requirement: Orden y ocultamiento de secciones
Las secciones SHALL renderizarse en el orden de `sections` de la API. Las secciones conocidas por el frontend (`hero, stats, experience, skills, projects, education, certifications, presence, contact`) que tengan datos y no figuren ni en `sections` ni en `hiddenSections` SHALL agregarse al final en ese orden canónico. Una sección en `hiddenSections` MUST NOT renderizarse. Una sección sin datos (ej. `projects` vacío) MUST NOT renderizarse.

#### Scenario: Orden de la API
- **WHEN** `sections = ["hero","skills","experience","contact"]`
- **THEN** el DOM contiene esas cuatro secciones en ese orden

#### Scenario: Conocidas no listadas se agregan al final
- **WHEN** `sections` es el orden por defecto del seed (sin `projects` ni `presence`) y el perfil tiene proyectos y enlaces sociales
- **THEN** `projects` y `presence` aparecen después de `contact`, en ese orden

#### Scenario: Ocultas y vacías
- **WHEN** `hiddenSections = ["stats"]` y `projects = []`
- **THEN** no se renderizan `stats` ni `projects`

### Requirement: Estadísticas derivadas
La sección `stats` SHALL derivarse de los datos resueltos: años de experiencia (`profile.yearsOfExperience`), cantidad de experiencias, cantidad de tecnologías únicas y cantidad de certificaciones. No requiere campos nuevos en la API.

#### Scenario: Cálculo
- **WHEN** el perfil tiene 15 experiencias con 80 tecnologías únicas, 8 certificaciones y `yearsOfExperience = 10`
- **THEN** `stats` muestra 10+, 15, 80 y 8
