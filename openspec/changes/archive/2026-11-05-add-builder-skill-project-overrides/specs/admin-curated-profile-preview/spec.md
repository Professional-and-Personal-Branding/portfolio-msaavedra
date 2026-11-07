## MODIFIED Requirements

### Requirement: Misma resolución que la ruta pública
El preview SHALL aplicar la selección por tags con overrides, el orden canónico de experiencias, la selección de categorías de skills, el merge profundo del tema y la resolución de secciones con las mismas reglas que la ruta pública, compartiendo la implementación.

#### Scenario: Equivalencia con la vista pública
- **WHEN** se pide el preview con exactamente los criterios de un perfil ya guardado
- **THEN** el cuerpo devuelto es igual al de `GET /api/curated-profiles/{slug}` para ese perfil y locale

#### Scenario: Overrides
- **WHEN** el borrador tiene `filterTags: ["java"]`, `excludeIds: [<id de una experiencia java>]` e `includeIds: [<id de una experiencia no java>]`
- **THEN** la experiencia excluida no aparece y la incluida sí

#### Scenario: Overrides de skills y proyectos
- **WHEN** el borrador tiene `filterTags: ["java"]`, `excludeIds` con el id de una skill java e `includeIds` con el id de una skill y el de un proyecto visible que no comparten tags
- **THEN** la skill excluida no aparece, la incluida aparece en su categoría, el proyecto incluido aparece y el resultado es igual al de la ruta pública tras guardar esos criterios
