# public-seo Specification (delta)

## ADDED Requirements

### Requirement: Los enlaces de seguimiento no se indexan aparte
El HTML de `/{slug}?via=<código>` o `?src=<portal>` SHALL tener el mismo head que el de `/{slug}`: el fragmento del servidor MUST ignorar `via` y `src`. El sitemap MUST NOT incluir URLs con query, y `robots.txt` MUST NOT bloquear `via` ni `src`, para no dejar sin vista previa a los links compartidos.

#### Scenario: Mismo head con código
- **WHEN** se piden el fragmento y el HTML inicial de `/tech-lead-dotnet?via=k7m2q9xw4t` y de `/tech-lead-dotnet`
- **THEN** los dos heads son iguales y `canonical` y `og:url` no contienen `via`

#### Scenario: robots no bloquea los links compartidos
- **WHEN** se pide `GET /robots.txt`
- **THEN** el cuerpo no contiene `via` ni `src`

## MODIFIED Requirements

### Requirement: Metadatos por perfil curado
Al resolver un perfil, la vista pública SHALL actualizar el `title` del documento, la meta `description`, el `link rel="canonical"` y las etiquetas OpenGraph (`og:title`, `og:description`, `og:type`, `og:url`, `og:locale`) y Twitter Card, usando los textos del perfil resueltos al idioma activo. `canonical` y `og:url` SHALL ser la URL del perfil sin query. Al cambiar de perfil o de idioma SHALL actualizarse; al salir de la vista SHALL restaurarse los valores por defecto.

#### Scenario: Perfil curado
- **WHEN** se abre `/tech-lead-dotnet`
- **THEN** el `title` incluye el título del perfil y el nombre del profesional, y `og:title`, `og:description` y `canonical` corresponden a ese perfil

#### Scenario: Cambio de idioma
- **WHEN** se pasa a `?lang=en`
- **THEN** los metadatos pasan al inglés y `og:locale` refleja el idioma activo

#### Scenario: Link con código de seguimiento
- **WHEN** se abre `/tech-lead-dotnet?via=k7m2q9xw4t&src=linkedin&lang=en`
- **THEN** `canonical` y `og:url` son la URL absoluta de `/tech-lead-dotnet`, sin query

#### Scenario: Perfiles no indexables
- **WHEN** el perfil es `PRIVATE` o `PROTECTED`, o la vista es el panel `/admin`
- **THEN** la página declara `robots: noindex` y no se agrega al sitemap
