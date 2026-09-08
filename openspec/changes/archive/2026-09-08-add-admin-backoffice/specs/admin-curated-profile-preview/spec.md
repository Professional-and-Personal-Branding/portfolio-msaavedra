## Purpose

Permite ver, antes de guardar, exactamente qué va a renderizar la vista pública para un perfil curado en construcción: la misma resolución, el mismo DTO, sin escribir nada en la base.

## ADDED Requirements

### Requirement: Resolución de un borrador sin persistir
`POST /api/admin/curated-profiles/preview` (autenticado) SHALL aceptar un borrador con `filterTags`, `includeIds`, `excludeIds`, `themeId`, `themeOverrides`, `layout`, `sectionsOrder`, `sectionsHidden` y los textos del perfil (`title`, `headline`, `description`, `roleType`, `techFocus`, `accentColor`, `slug`), y devolver el mismo `CuratedProfileResponse` que `GET /api/curated-profiles/{slug}`, resuelto al locale negociado. MUST NOT crear, modificar ni borrar ningún registro.

#### Scenario: Preview de un borrador nuevo
- **WHEN** se envía un borrador con `filterTags: ["dotnet"]` y sin `slug` existente
- **THEN** responde 200 con `experiences`, `skillCategories`, `projects`, `theme` y `sections` resueltos, y la cantidad de filas de `CuratedProfile` en la base no cambia

#### Scenario: No registra visitas
- **WHEN** se pide el preview de un borrador cuyo `slug` coincide con un perfil existente
- **THEN** el contador `views` de ese perfil y la cantidad de `ProfileView` no cambian

### Requirement: Misma resolución que la ruta pública
El preview SHALL aplicar la selección por tags con overrides, el orden canónico de experiencias, la selección de categorías de skills, el merge profundo del tema y la resolución de secciones con las mismas reglas que la ruta pública, compartiendo la implementación.

#### Scenario: Equivalencia con la vista pública
- **WHEN** se pide el preview con exactamente los criterios de un perfil ya guardado
- **THEN** el cuerpo devuelto es igual al de `GET /api/curated-profiles/{slug}` para ese perfil y locale

#### Scenario: Overrides
- **WHEN** el borrador tiene `filterTags: ["java"]`, `excludeIds: [<id de una experiencia java>]` e `includeIds: [<id de una experiencia no java>]`
- **THEN** la experiencia excluida no aparece y la incluida sí

### Requirement: Visibilidad y token no aplican al preview
El preview SHALL resolver el borrador independientemente de su `visibility`: un borrador `PRIVATE` o `PROTECTED` MUST devolver 200 sin exigir token de acceso, porque el llamador ya está autenticado como administrador.

#### Scenario: Borrador protegido
- **WHEN** se pide el preview de un borrador con `visibility: "PROTECTED"` y sin `X-Access-Token`
- **THEN** responde 200 con el perfil resuelto

#### Scenario: Sin sesión
- **WHEN** se pide el preview sin cookie de sesión ni header `Authorization`
- **THEN** responde 401
