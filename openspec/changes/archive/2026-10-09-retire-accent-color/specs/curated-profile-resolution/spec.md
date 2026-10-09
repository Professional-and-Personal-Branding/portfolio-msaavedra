# curated-profile-resolution Specification (delta)

## MODIFIED Requirements

### Requirement: Resultado listo para presentación
La vista resuelta SHALL contener los metadatos del perfil curado (`slug`, `title`, `headline`, `description`, `roleType`, `techFocus`, `layout`, `visibility`), `sections`/`hiddenSections` y el `theme` resuelto (ver `theme-resolution`). MUST NOT contener `accentColor`.

#### Scenario: Forma completa
- **WHEN** se resuelve un perfil `PUBLIC`
- **THEN** el resultado tiene exactamente las claves `slug, title, headline, description, roleType, techFocus, layout, visibility, sections, hiddenSections, theme, profile, experiences, skillCategories, projects, education, certifications, socialLinks`
