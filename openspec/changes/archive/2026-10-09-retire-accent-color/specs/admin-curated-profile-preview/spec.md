# admin-curated-profile-preview Specification (delta)

## MODIFIED Requirements

### Requirement: Resolución de un borrador sin persistir
`POST /api/admin/curated-profiles/preview` (autenticado) SHALL aceptar un borrador con `filterTags`, `includeIds`, `excludeIds`, `themeId`, `themeOverrides`, `layout`, `sectionsOrder`, `sectionsHidden` y los textos del perfil (`title`, `headline`, `description`, `roleType`, `techFocus`, `slug`), y devolver el mismo `CuratedProfileResponse` que `GET /api/curated-profiles/{slug}`, resuelto al locale negociado. MUST NOT crear, modificar ni borrar ningún registro. Un borrador con `accentColor` MUST responder 400.

#### Scenario: Preview de un borrador nuevo
- **WHEN** se envía un borrador con `filterTags: ["dotnet"]` y sin `slug` existente
- **THEN** responde 200 con `experiences`, `skillCategories`, `projects`, `theme` y `sections` resueltos, y la cantidad de filas de `CuratedProfile` en la base no cambia

#### Scenario: No registra visitas
- **WHEN** se pide el preview de un borrador cuyo `slug` coincide con un perfil existente
- **THEN** el contador `views` de ese perfil y la cantidad de `ProfileView` no cambian

#### Scenario: Borrador con el campo retirado
- **WHEN** se pide el preview de un borrador que incluye `accentColor: "#5B2C87"`
- **THEN** responde 400 y el mensaje nombra `accentColor`
