# public-seo Specification (delta)

## MODIFIED Requirements

### Requirement: robots.txt y sitemap.xml
El backend SHALL servir `GET /robots.txt` (permitiendo la vista pública, bloqueando `/admin`) y `GET /sitemap.xml` con la home y **solo** los perfiles curados que cumplan las tres condiciones del listado público: `visibility = PUBLIC`, `listed = true` y `archivedAt` nulo. Las URLs SHALL ser absolutas sobre `FRONTEND_URL`, con su fecha de última modificación, y SHALL usar el **slug canónico**: un alias de slug MUST NOT figurar en el sitemap.

El criterio de inclusión del sitemap y el del listado público SHALL ser el mismo, para que no puedan divergir.

#### Scenario: Sitemap con perfiles públicos
- **WHEN** se pide `GET /sitemap.xml` con la base seedeada
- **THEN** responde 200 con `Content-Type: application/xml`, incluye la home y `/tech-lead-dotnet`, y no incluye ningún perfil `PRIVATE` ni `PROTECTED`

#### Scenario: robots bloquea el panel
- **WHEN** se pide `GET /robots.txt`
- **THEN** el cuerpo contiene `Disallow: /admin` y la referencia al `sitemap.xml`

#### Scenario: Un perfil que deja de ser público desaparece del sitemap
- **WHEN** un perfil pasa a `PRIVATE` y se vuelve a pedir el sitemap
- **THEN** su URL ya no figura

#### Scenario: Un perfil no enumerado no se indexa
- **WHEN** un perfil `PUBLIC` pasa a `listed: false` y se vuelve a pedir el sitemap
- **THEN** su URL ya no figura

#### Scenario: Un perfil archivado no se indexa
- **WHEN** un perfil se archiva y se vuelve a pedir el sitemap
- **THEN** su URL ya no figura

#### Scenario: El alias no se indexa
- **WHEN** un perfil se renombra y se pide el sitemap
- **THEN** figura solo el slug canónico

#### Scenario: El sitemap y el listado público coinciden
- **WHEN** se comparan los slugs de `GET /sitemap.xml` con los de `GET /api/curated-profiles`
- **THEN** son el mismo conjunto
