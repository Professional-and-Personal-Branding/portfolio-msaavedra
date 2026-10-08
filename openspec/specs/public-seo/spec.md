# public-seo Specification

## Purpose
Un perfil curado se comparte por link con una empresa: ese link tiene que decir quién es Manuel y para qué rol, tanto en un buscador como en la vista previa de un chat.

## Requirements

### Requirement: Metadatos por perfil curado
Al resolver un perfil, la vista pública SHALL actualizar el `title` del documento, la meta `description`, el `link rel="canonical"` y las etiquetas OpenGraph (`og:title`, `og:description`, `og:type`, `og:url`, `og:locale`) y Twitter Card, usando los textos del perfil resueltos al idioma activo. Al cambiar de perfil o de idioma SHALL actualizarse; al salir de la vista SHALL restaurarse los valores por defecto.

#### Scenario: Perfil curado
- **WHEN** se abre `/tech-lead-dotnet`
- **THEN** el `title` incluye el título del perfil y el nombre del profesional, y `og:title`, `og:description` y `canonical` corresponden a ese perfil

#### Scenario: Cambio de idioma
- **WHEN** se pasa a `?lang=en`
- **THEN** los metadatos pasan al inglés y `og:locale` refleja el idioma activo

#### Scenario: Perfiles no indexables
- **WHEN** el perfil es `PRIVATE` o `PROTECTED`, o la vista es el panel `/admin`
- **THEN** la página declara `robots: noindex` y no se agrega al sitemap

### Requirement: Datos estructurados del profesional
La vista pública SHALL incluir un bloque JSON-LD `schema.org/Person` con nombre, titular, ubicación y enlaces sociales del perfil resuelto.

#### Scenario: JSON-LD válido
- **WHEN** se inspecciona la home
- **THEN** existe un `<script type="application/ld+json">` con `"@type": "Person"`, el nombre y los enlaces de `socialLinks`

### Requirement: robots.txt y sitemap.xml
El backend SHALL servir `GET /robots.txt` (permitiendo la vista pública, bloqueando `/admin`) y `GET /sitemap.xml` con la home y **solo** los perfiles curados que cumplan las tres condiciones del listado público: `visibility = PUBLIC`, `listed = true` y `archivedAt` nulo. Las URLs SHALL ser absolutas sobre `FRONTEND_URL`, con su fecha de última modificación, y SHALL usar el **slug canónico**: un alias de slug MUST NOT figurar en el sitemap.

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

### Requirement: El sitemap y el listado público usan el mismo criterio
El criterio de inclusión del sitemap y el del listado público SHALL ser el mismo, para que no puedan divergir.

#### Scenario: El sitemap y el listado público coinciden
- **WHEN** se comparan los slugs de `GET /sitemap.xml` con los de `GET /api/curated-profiles`
- **THEN** son el mismo conjunto

### Requirement: Metadatos base del documento
`index.html` SHALL incluir un marcador de inserción inmediatamente antes de su `<title>`, y metadatos de fallback que describan el portafolio con honestidad. La imagen de vista previa SHALL ser **raster** (PNG de 1200×630) con URL absoluta, acompañada de `og:image:width`, `og:image:height` y `og:image:alt`; MUST NOT ser un SVG, porque los rastreadores de LinkedIn, WhatsApp y Slack no lo renderizan.

#### Scenario: Vista previa sin JavaScript
- **WHEN** un scraper lee el HTML servido sin ejecutar scripts y el borde **no** insertó el fragmento
- **THEN** encuentra `og:title`, `og:description` y `og:image` genéricos del portafolio, con la imagen raster

#### Scenario: La imagen de vista previa es utilizable
- **WHEN** se inspecciona `og:image` del HTML inicial
- **THEN** es una URL absoluta a un PNG de 1200×630 y trae `og:image:alt`

### Requirement: Título efectivo del documento
Cuando el borde inserta el fragmento del perfil, el título efectivo del documento SHALL ser el del perfil. Cuando la inserción no ocurre, el título efectivo SHALL ser el del fallback. En ningún caso el documento SHALL quedar sin título.

#### Scenario: Con inserción
- **WHEN** el borde inserta el fragmento de `tech-lead-dotnet`
- **THEN** el título efectivo es el del perfil

#### Scenario: Sin inserción
- **WHEN** la API no responde y el borde entrega el head estático
- **THEN** el sitio responde 200, el título efectivo es el de fallback y la SPA arranca igual

### Requirement: Fragmento de head por perfil
El backend SHALL servir `GET /api/public/profile-head` con los parámetros `slug` (requerido) y `lang` (opcional), y SHALL responder **siempre 200** con `Content-Type: text/html; charset=utf-8` y un fragmento de HTML apto para insertarse dentro de `<head>`. El fragmento SHALL construirse con el mismo servicio de composición que resuelve la ruta pública, de modo que sus textos no puedan divergir de lo que ve el visitante.

#### Scenario: Perfil público en español
- **WHEN** se pide `GET /api/public/profile-head?slug=tech-lead-dotnet`
- **THEN** responde 200 `text/html`, el `<title>` y `og:title` corresponden a ese perfil, `canonical` es su URL absoluta sobre `FRONTEND_URL` y `robots` es `index, follow`

#### Scenario: El canonical coincide con el sitemap
- **WHEN** se comparan el `canonical` del fragmento y la URL del mismo perfil en `GET /sitemap.xml`
- **THEN** son idénticos

### Requirement: La ruta del fragmento no autentica ni cuenta visitas
La ruta del fragmento de head MUST NOT registrar visitas, MUST NOT aceptar `token` ni `X-Access-Token`, y SHALL estar exenta del límite de peticiones.

#### Scenario: Ni token ni visitas
- **WHEN** se pide el fragmento de un perfil `PROTECTED` enviando su `token` o `X-Access-Token`
- **THEN** responde el fragmento genérico con `noindex` y el contador de visitas del perfil no cambia

### Requirement: Contenido del fragmento de un perfil público
Para un perfil `PUBLIC`, el fragmento MUST contener `<title>`, `description`, `canonical`, `og:title`, `og:description`, `og:type`, `og:url`, `og:locale`, `og:image` (absoluta, raster), las Twitter Card, `robots: index, follow` y el bloque JSON-LD `Person`. El contenido textual MUST ir escapado.

#### Scenario: Perfil público en inglés
- **WHEN** se pide el mismo slug con `lang=en`
- **THEN** los textos están en inglés y `og:locale` refleja el idioma

#### Scenario: Textos con caracteres que rompen HTML
- **WHEN** el perfil tiene `<`, `&` o `"` en su titular
- **THEN** el fragmento los emite escapados y sigue siendo HTML válido

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
