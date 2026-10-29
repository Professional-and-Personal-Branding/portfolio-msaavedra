# web-performance Specification (delta)

## MODIFIED Requirements

### Requirement: Petición temprana del perfil
`index.html` SHALL cargar con `async` un script clásico del propio origen, sin módulos compartidos con el bundle, que pida el perfil de `/` (slug `all`) y de `/:slug` con el slug, el idioma, el token, `via` y `src` que usaría la app. La app SHALL tomar esa respuesta una sola vez si la clave `[slug, locale, token, via, src]` coincide y la API es del mismo origen. Cada carga MUST hacer una sola petición del perfil y registrar una sola visita. MUST NOT correr en `/admin/*`.

#### Scenario: Una sola petición
- **WHEN** se abre `/tech-lead-dotnet?lang=es` en la imagen de producción contra una base descartable
- **THEN** hay exactamente una petición a `/api/curated-profiles/tech-lead-dotnet?locale=es` y la base registra un solo `ProfileView` nuevo

#### Scenario: Idioma y token
- **WHEN** se abre `/dotnet-backend?lang=en&token=abc`
- **THEN** la petición temprana es `GET /api/curated-profiles/dotnet-backend?locale=en` con la cabecera `X-Access-Token: abc` y la app la reutiliza

#### Scenario: Enlace de seguimiento y portal
- **WHEN** se abre `/tech-lead-dotnet?via=k7m2q9xw4t&src=indeed`
- **THEN** la petición temprana es `GET /api/curated-profiles/tech-lead-dotnet?locale=es&via=k7m2q9xw4t&src=indeed` y la app la reutiliza sin una segunda petición

#### Scenario: Idioma del navegador
- **WHEN** se abre `/` sin `lang` con `navigator.language = "en-US"`
- **THEN** la petición temprana es `GET /api/curated-profiles/all?locale=en`

#### Scenario: Panel excluido
- **WHEN** se abre `/admin/login`
- **THEN** el script no hace ninguna petición

#### Scenario: Clave distinta
- **WHEN** la clave que dejó el script no coincide con la de la consulta de la app
- **THEN** la app no usa esa respuesta y pide el perfil con su propia petición

#### Scenario: Error de la API
- **WHEN** la petición temprana responde 401 o 404
- **THEN** la vista muestra el formulario de token o la página «perfil no encontrado», como sin el script

#### Scenario: El script no queda en caché
- **WHEN** se pide `/profile-prefetch.js` a la imagen de producción
- **THEN** la respuesta trae `Cache-Control: no-cache`
