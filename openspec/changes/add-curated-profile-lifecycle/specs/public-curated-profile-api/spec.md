# public-curated-profile-api Specification (delta)

## MODIFIED Requirements

### Requirement: Listado de perfiles curados públicos
`GET /api/curated-profiles` SHALL devolver 200 con los perfiles que cumplan **las tres** condiciones: `visibility = PUBLIC`, `listed = true` y `archivedAt` nulo. Un perfil que falle cualquiera de las tres MUST NOT aparecer, y el endpoint MUST NOT revelar su existencia de ninguna otra forma. Cada elemento conserva los campos ya especificados (`slug`, `title`, `headline`, `description`, `roleType`, `techFocus`, `accentColor`, `layout`), resueltos al locale del request.

#### Scenario: Listado tras el seed
- **WHEN** un cliente hace `GET /api/curated-profiles`
- **THEN** recibe 200 con los perfiles públicos, enumerados y no archivados

#### Scenario: Listado en inglés
- **WHEN** un cliente hace `GET /api/curated-profiles?locale=en`
- **THEN** el elemento `tech-lead-dotnet` tiene `roleType: "Tech Lead"` y `title` igual al valor `en` de `cv-data.json`

#### Scenario: No públicos excluidos
- **WHEN** un perfil pasa a `PRIVATE` o `PROTECTED` y un cliente hace `GET /api/curated-profiles`
- **THEN** ese slug no aparece

#### Scenario: Perfil no enumerado
- **WHEN** un perfil `PUBLIC` tiene `listed: false`
- **THEN** no aparece en el listado, aunque su slug siga respondiendo 200

#### Scenario: Perfil archivado
- **WHEN** un perfil `PUBLIC` y `listed` se archiva
- **THEN** desaparece del listado

#### Scenario: Ningún endpoint público enumera todo
- **WHEN** se recorren todos los endpoints públicos
- **THEN** ninguno devuelve la lista completa de slugs existentes
