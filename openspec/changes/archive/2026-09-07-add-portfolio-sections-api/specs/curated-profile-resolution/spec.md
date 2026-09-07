## ADDED Requirements

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

### Requirement: Secciones informativas sin filtrar
La vista resuelta SHALL incluir educación, certificaciones y enlaces sociales visibles, sin filtrado por tags (no tienen tags), ordenados por `order` y resueltos al locale, con la misma forma que `public-portfolio-sections-api`.

#### Scenario: Conteos seed
- **WHEN** se resuelve cualquier perfil `PUBLIC`
- **THEN** `education` tiene 6 elementos, `certifications` 8 y `socialLinks` 3

## MODIFIED Requirements

### Requirement: Resultado listo para presentación
La vista resuelta SHALL contener: metadatos del perfil curado (`slug`, `title`, `headline`, `description`, `roleType`, `techFocus`, `accentColor`, `layout`, `visibility`), `sections`/`hiddenSections`, el `theme` resuelto (ver `theme-resolution`), el perfil base (`profile`, misma forma que `public-profile-api`), las `experiences` (misma forma que `public-experience-api`), `skillCategories[] { name, skills[] }`, `projects` (seleccionados por tags/overrides), `education`, `certifications` y `socialLinks` (misma forma que `public-portfolio-sections-api`). Todos los campos traducibles SHALL venir resueltos al locale pedido; la salida MUST NOT contener `accessToken`, `includeIds`, `excludeIds` ni `filterTags`.

#### Scenario: Forma completa
- **WHEN** se resuelve un perfil `PUBLIC`
- **THEN** el resultado tiene las claves `slug, title, headline, description, roleType, techFocus, accentColor, layout, visibility, sections, hiddenSections, theme, profile, experiences, skillCategories, projects, education, certifications, socialLinks`

#### Scenario: Sin datos sensibles ni internos
- **WHEN** se resuelve un perfil `PROTECTED` con token válido
- **THEN** el resultado no contiene `accessToken`, `includeIds`, `excludeIds` ni `filterTags`

#### Scenario: Locale aplicado a todo el árbol
- **WHEN** se resuelve con locale `en`
- **THEN** `title`, `roleType`, `profile.headline`, `experiences[].role`, `skillCategories[].name`, `projects[].role`, `education[].degree`, `certifications[].name` y `socialLinks[].label` vienen en inglés, y ningún valor es un objeto `{es,en}`
