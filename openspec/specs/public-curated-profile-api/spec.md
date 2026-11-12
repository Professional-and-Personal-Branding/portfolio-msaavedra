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
El documento OpenAPI SHALL incluir `/api/curated-profiles` y `/api/curated-profiles/{slug}`, documentando `locale`, el header `X-Access-Token`, el query `token`, los query opcionales de atribución `via` y `src` (`share-links`) y las respuestas 200/401/404.

#### Scenario: Rutas documentadas
- **WHEN** un cliente hace `GET /api/docs-json`
- **THEN** `paths` contiene ambas rutas y el detalle declara los parámetros `locale`, `X-Access-Token`, `token`, `via` y `src`

### Requirement: La vista resuelta informa su última edición
La vista resuelta de `GET /api/curated-profiles/:slug` y del preview del constructor SHALL incluir `updatedAt`: la fecha de la última edición del perfil curado como ISO 8601 en UTC, o `null` si el perfil no tiene fila (borrador del preview). MUST salir de la misma lectura que ya resuelve el perfil, sin consultas nuevas, y una visita MUST NOT cambiarla.

#### Scenario: Perfil público
- **WHEN** el perfil `tech-lead-dotnet` tiene `updatedAt` en `2026-01-15T12:00:00.000Z` y un cliente hace `GET /api/curated-profiles/tech-lead-dotnet`
- **THEN** recibe 200 con `updatedAt: "2026-01-15T12:00:00.000Z"`

#### Scenario: Borrador en el preview
- **WHEN** el constructor pide el preview de un perfil que todavía no se guardó
- **THEN** la respuesta trae `updatedAt: null`

#### Scenario: Contrato generado
- **WHEN** se corre `npm run openapi:export` y después `npm run api:types`
- **THEN** `CuratedProfileResponse` declara `updatedAt` como string nullable con formato `date-time` y el test de deriva del frontend pasa

### Requirement: Exportación JSON Resume por slug
`GET /api/curated-profiles/:slug/resume.json` SHALL devolver 200 con el documento JSON Resume (`json-resume-export`) de la misma vista que `GET /api/curated-profiles/:slug`, en el locale negociado. Los códigos MUST ser los del detalle: 404 para slug inexistente, `PRIVATE` o archivado, y 401 para `PROTECTED` sin token válido (`X-Access-Token` o `?token=`). Un slug anterior SHALL resolver con `Content-Location` a la ruta del canónico.

#### Scenario: Perfil público en inglés
- **WHEN** un cliente hace `GET /api/curated-profiles/tech-lead-dotnet/resume.json?lang=en`
- **THEN** recibe 200, `Content-Language: en` y un documento cuyo `work` tiene las mismas empresas, en el mismo orden, que `experiences` de `GET /api/curated-profiles/tech-lead-dotnet?lang=en`

#### Scenario: Perfil de la home
- **WHEN** un cliente hace `GET /api/curated-profiles/all/resume.json`
- **THEN** recibe 200 con el documento del perfil `all` en español

#### Scenario: Privado
- **WHEN** un perfil es `PRIVATE` y un cliente pide su `resume.json`
- **THEN** recibe 404 con `error: "Not Found"`

#### Scenario: Archivado
- **WHEN** un perfil `PUBLIC` está archivado y un cliente pide su `resume.json`
- **THEN** recibe 404, nunca 401

#### Scenario: Protegido sin token
- **WHEN** un perfil es `PROTECTED` y un cliente pide su `resume.json` sin token o con uno incorrecto
- **THEN** recibe 401 con `error: "Unauthorized"`

#### Scenario: Protegido con token
- **WHEN** un cliente pide el `resume.json` de un perfil `PROTECTED` con `?token=<correcto>` o con `X-Access-Token`
- **THEN** recibe 200 y el token no aparece en ninguna parte del documento

#### Scenario: Slug anterior
- **WHEN** un cliente pide `GET /api/curated-profiles/ejemplo-nombre-anterior/resume.json` y ese slug es alias de `ejemplo-renombrado`
- **THEN** recibe 200 con `Content-Location: /api/curated-profiles/ejemplo-renombrado/resume.json` y `meta.canonical` apunta al slug canónico

### Requirement: Documentación OpenAPI de la exportación
El documento OpenAPI SHALL incluir `/api/curated-profiles/{slug}/resume.json` con `locale`, `X-Access-Token`, `token` y las respuestas 200, 401 y 404, y `/api/admin/curated-profiles/{id}/resume.json` con `locale` y 200, 401 y 404. El cuerpo 200 de ambas SHALL declararse como objeto `application/json` con referencia al schema JSON Resume v1.0.0.

#### Scenario: Rutas documentadas
- **WHEN** se corre `npm run openapi:export`
- **THEN** `paths` de `backend/openapi.json` contiene las dos rutas, la pública declara `locale`, `X-Access-Token` y `token` y no declara `via` ni `src`

#### Scenario: Contrato generado
- **WHEN** se corre `npm run openapi:export` y después `npm run api:types`
- **THEN** `api.d.ts` incluye las dos rutas y el test de deriva del frontend pasa
