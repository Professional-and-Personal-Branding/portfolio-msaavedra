# public-seo Specification (delta)

## ADDED Requirements

### Requirement: Fragmento de head por perfil
El backend SHALL servir `GET /api/public/profile-head` con los parámetros `slug` (requerido) y `lang` (opcional), y SHALL responder **siempre 200** con `Content-Type: text/html; charset=utf-8` y un fragmento de HTML apto para insertarse dentro de `<head>`. El fragmento SHALL construirse con el mismo servicio de composición que resuelve la ruta pública, de modo que sus textos no puedan divergir de lo que ve el visitante. La ruta MUST NOT registrar visitas, MUST NOT aceptar `token` ni `X-Access-Token`, y SHALL estar exenta del límite de peticiones.

Para un perfil `PUBLIC`, el fragmento MUST contener `<title>`, `description`, `canonical`, `og:title`, `og:description`, `og:type`, `og:url`, `og:locale`, `og:image` (absoluta, raster), las Twitter Card, `robots: index, follow` y el bloque JSON-LD `Person`. El contenido textual MUST ir escapado.

#### Scenario: Perfil público en español
- **WHEN** se pide `GET /api/public/profile-head?slug=tech-lead-dotnet`
- **THEN** responde 200 `text/html`, el `<title>` y `og:title` corresponden a ese perfil, `canonical` es su URL absoluta sobre `FRONTEND_URL` y `robots` es `index, follow`

#### Scenario: Perfil público en inglés
- **WHEN** se pide el mismo slug con `lang=en`
- **THEN** los textos están en inglés y `og:locale` refleja el idioma

#### Scenario: Textos con caracteres que rompen HTML
- **WHEN** el perfil tiene `<`, `&` o `"` en su titular
- **THEN** el fragmento los emite escapados y sigue siendo HTML válido

#### Scenario: El canonical coincide con el sitemap
- **WHEN** se comparan el `canonical` del fragmento y la URL del mismo perfil en `GET /sitemap.xml`
- **THEN** son idénticos

### Requirement: Los perfiles no públicos no filtran textos por el head
Para un perfil `PROTECTED`, `PRIVATE` o inexistente, el fragmento SHALL ser el **genérico** del portafolio y MUST declarar `robots: noindex, nofollow`, sin JSON-LD. Un perfil `PROTECTED` MUST NOT exponer su título ni su descripción por esta ruta, aunque sean accesibles con token en la ruta pública.

#### Scenario: Perfil protegido
- **WHEN** se pide el fragmento de un perfil `PROTECTED`, con o sin `?token=`
- **THEN** responde 200 con los textos genéricos y `robots: noindex, nofollow`, y el título del perfil no aparece en el cuerpo

#### Scenario: Perfil privado e inexistente son indistinguibles
- **WHEN** se piden los fragmentos de un perfil `PRIVATE` y de un slug que no existe
- **THEN** los dos cuerpos son iguales

### Requirement: `noindex` sin JavaScript
El HTML inicial que entrega el sitio para un perfil `PRIVATE` o `PROTECTED` SHALL declarar `robots: noindex` **antes** de que se ejecute JavaScript.

#### Scenario: Rastreador que no ejecuta JavaScript
- **WHEN** se pide el HTML de un perfil `PROTECTED` con un cliente que no ejecuta scripts
- **THEN** el cuerpo contiene `noindex` y no contiene los textos del perfil

## MODIFIED Requirements

### Requirement: Metadatos base del documento
`index.html` SHALL incluir un marcador de inserción inmediatamente antes de su `<title>`, y metadatos de fallback que describan el portafolio con honestidad. La imagen de vista previa SHALL ser **raster** (PNG de 1200×630) con URL absoluta, acompañada de `og:image:width`, `og:image:height` y `og:image:alt`; MUST NOT ser un SVG, porque los rastreadores de LinkedIn, WhatsApp y Slack no lo renderizan.

Cuando el borde inserta el fragmento del perfil, el título efectivo del documento SHALL ser el del perfil. Cuando la inserción no ocurre, el título efectivo SHALL ser el del fallback. En ningún caso el documento SHALL quedar sin título.

#### Scenario: Vista previa sin JavaScript
- **WHEN** un scraper lee el HTML servido sin ejecutar scripts y el borde **no** insertó el fragmento
- **THEN** encuentra `og:title`, `og:description` y `og:image` genéricos del portafolio, con la imagen raster

#### Scenario: Con inserción
- **WHEN** el borde inserta el fragmento de `tech-lead-dotnet`
- **THEN** el título efectivo es el del perfil

#### Scenario: Sin inserción
- **WHEN** la API no responde y el borde entrega el head estático
- **THEN** el sitio responde 200, el título efectivo es el de fallback y la SPA arranca igual

#### Scenario: La imagen de vista previa es utilizable
- **WHEN** se inspecciona `og:image` del HTML inicial
- **THEN** es una URL absoluta a un PNG de 1200×630 y trae `og:image:alt`
