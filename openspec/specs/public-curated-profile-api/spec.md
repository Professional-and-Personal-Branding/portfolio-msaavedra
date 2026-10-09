# public-curated-profile-api Specification

## Purpose
Contrato HTTP público de los perfiles curados: listado para el menú de navegación y detalle resuelto por slug, con negociación de idioma, control de acceso y códigos de estado consistentes con `api-platform`.

## Requirements

### Requirement: Listado de perfiles curados públicos
`GET /api/curated-profiles` SHALL devolver 200 con los perfiles que cumplan **las tres** condiciones: `visibility = PUBLIC`, `listed = true` y `archivedAt` nulo. Un perfil que falle cualquiera de las tres MUST NOT aparecer, y el endpoint MUST NOT revelar su existencia de ninguna otra forma. Cada elemento trae exactamente `slug`, `title`, `headline`, `description`, `roleType`, `techFocus` y `layout`, resueltos al locale del request.

#### Scenario: Listado tras el seed
- **WHEN** un cliente hace `GET /api/curated-profiles`
- **THEN** recibe 200 con los perfiles públicos, enumerados y no archivados

#### Scenario: Claves de cada elemento
- **WHEN** un cliente hace `GET /api/curated-profiles`
- **THEN** cada elemento tiene exactamente las claves `slug, title, headline, description, roleType, techFocus, layout` y ninguno trae `accentColor`

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

### Requirement: Detalle resuelto por slug
`GET /api/curated-profiles/:slug` SHALL devolver 200 con la vista resuelta (spec `curated-profile-resolution` → "Resultado listo para presentación") aplicando el locale negociado (`content-localization`) y el header `Content-Language`.

#### Scenario: tech-lead-dotnet en español
- **WHEN** un cliente hace `GET /api/curated-profiles/tech-lead-dotnet?locale=es`
- **THEN** recibe 200, `slug` es `tech-lead-dotnet`, `experiences` solo contiene experiencias con intersección de tags y `theme.slug` es `modern-dark`

#### Scenario: Orden cronológico en la respuesta
- **WHEN** un cliente hace `GET /api/curated-profiles/generalist-polyglot`
- **THEN** `experiences[i].startDate >= experiences[i+1].startDate` para todo `i`

#### Scenario: Locale inexistente cae al español
- **WHEN** un cliente hace `GET /api/curated-profiles/all?locale=xx`
- **THEN** recibe 200 con los textos en español y `Content-Language: es`

### Requirement: Códigos de estado por visibilidad
Slug inexistente o perfil `PRIVATE` MUST responder 404. Perfil `PROTECTED` sin token válido MUST responder 401. El token SHALL leerse del header `X-Access-Token` o, en su defecto, del query param `token`. Todas las respuestas de error SHALL usar el formato de `api-platform`.

#### Scenario: Slug inexistente
- **WHEN** un cliente hace `GET /api/curated-profiles/no-existe`
- **THEN** recibe 404 con `error: "Not Found"`

#### Scenario: Privado
- **WHEN** un perfil es `PRIVATE` y un cliente pide su detalle
- **THEN** recibe 404

#### Scenario: Protegido sin token
- **WHEN** un perfil es `PROTECTED` y un cliente pide su detalle sin token
- **THEN** recibe 401 con `error: "Unauthorized"`

#### Scenario: Protegido con token por header
- **WHEN** un cliente envía `X-Access-Token` con el token correcto
- **THEN** recibe 200 con la vista resuelta

#### Scenario: Protegido con token por query
- **WHEN** un cliente envía `?token=<correcto>` sin header
- **THEN** recibe 200

### Requirement: Documentación OpenAPI
El documento OpenAPI SHALL incluir `/api/curated-profiles` y `/api/curated-profiles/{slug}`, documentando `locale`, el header `X-Access-Token`, el query `token` y las respuestas 200/401/404.

#### Scenario: Rutas documentadas
- **WHEN** un cliente hace `GET /api/docs-json`
- **THEN** `paths` contiene ambas rutas y el detalle declara los parámetros `locale`, `X-Access-Token` y `token`
