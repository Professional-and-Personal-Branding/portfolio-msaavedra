# public-seo Specification

## Purpose
Un perfil curado se comparte por link con una empresa: ese link tiene que decir quién es Manuel y para qué rol, tanto en un buscador como en la vista previa de un chat.

## Requirements

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

### Requirement: Datos estructurados del profesional
La vista pública de un perfil indexable SHALL incluir un único bloque JSON-LD `schema.org/ProfilePage` cuyo `mainEntity` es un `Person` con nombre, titular, ubicación y enlaces sociales del perfil resuelto. El `ProfilePage` SHALL llevar `url` igual al `canonical` (sin query), `name` y `description` iguales al `<title>` y a la meta `description`, e `inLanguage` con el idioma de la petición.

#### Scenario: JSON-LD válido
- **WHEN** se inspecciona la home
- **THEN** existe un solo `<script type="application/ld+json">` con `"@type": "ProfilePage"` y un `mainEntity` con `"@type": "Person"`, el nombre y los enlaces de `socialLinks`

#### Scenario: Idioma y URL canónica
- **WHEN** se pide el fragmento de `tech-lead-dotnet` con `lang=en`
- **THEN** el `ProfilePage` tiene `inLanguage` `en`, `name` igual al `<title>` en inglés y `url` igual al `canonical`, sin query

#### Scenario: La misma persona en todos los perfiles
- **WHEN** se comparan los bloques de `/` y de `/tech-lead-dotnet`
- **THEN** el `@id` y la `url` del `Person` son iguales en los dos y apuntan a la home

#### Scenario: Sin fecha de modificación
- **WHEN** se inspecciona el bloque de un perfil público cuya vista resuelta trae `updatedAt: null`
- **THEN** no trae `dateModified` ni `dateCreated`

#### Scenario: Fecha de modificación presente
- **WHEN** se inspecciona el bloque de un perfil público cuyo perfil curado tiene `updatedAt`
- **THEN** el `ProfilePage` trae `dateModified` y no trae `dateCreated`

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
Para un perfil `PUBLIC`, el fragmento MUST contener `<title>`, `description`, `canonical`, `og:title`, `og:description`, `og:type`, `og:url`, `og:locale`, `og:image` (absoluta, raster), las Twitter Card, `robots: index, follow` y el bloque JSON-LD `ProfilePage` con su `Person`. El contenido textual MUST ir escapado.

#### Scenario: Perfil público en inglés
- **WHEN** se pide el mismo slug con `lang=en`
- **THEN** los textos están en inglés y `og:locale` refleja el idioma

#### Scenario: Textos con caracteres que rompen HTML
- **WHEN** el perfil tiene `<`, `&` o `"` en su titular
- **THEN** el fragmento los emite escapados y sigue siendo HTML válido

#### Scenario: Bloque de datos estructurados presente
- **WHEN** se pide `GET /api/public/profile-head?slug=tech-lead-dotnet`
- **THEN** el fragmento trae un `<script type="application/ld+json">` cuyo contenido parseado tiene `"@type": "ProfilePage"`

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

### Requirement: Los enlaces de seguimiento no se indexan aparte
El HTML de `/{slug}?via=<código>` o `?src=<portal>` SHALL tener el mismo head que el de `/{slug}`: el fragmento del servidor MUST ignorar `via` y `src`. El sitemap MUST NOT incluir URLs con query, y `robots.txt` MUST NOT bloquear `via` ni `src`, para no dejar sin vista previa a los links compartidos.

#### Scenario: Mismo head con código
- **WHEN** se piden el fragmento y el HTML inicial de `/tech-lead-dotnet?via=k7m2q9xw4t` y de `/tech-lead-dotnet`
- **THEN** los dos heads son iguales y `canonical` y `og:url` no contienen `via`

#### Scenario: robots no bloquea los links compartidos
- **WHEN** se pide `GET /robots.txt`
- **THEN** el cuerpo no contiene `via` ni `src`

### Requirement: Lo que el profesional sabe, estudió y acredita
El `Person` SHALL llevar `knowsAbout` con las skills de la vista (en orden, sin repetidos sin distinguir mayúsculas, hasta 50), `alumniOf` con una `EducationalOrganization` por institución distinta y `hasCredential` con una `EducationalOccupationalCredential` por certificación (`recognizedBy`, y `url`, `identifier` y `expires` si existen). Cada lista MUST omitirse si su sección no se muestra o queda vacía. Ninguna MUST requerir consultas nuevas.

#### Scenario: Skills del perfil curado
- **WHEN** un perfil curado muestra las categorías con `TypeScript` en dos de ellas y `typescript` en una tercera
- **THEN** `knowsAbout` trae `TypeScript` una sola vez, en la posición de su primera aparición

#### Scenario: Tope de skills
- **WHEN** la vista resuelta tiene 70 skills distintas
- **THEN** `knowsAbout` trae las 50 primeras en el orden de la sección

#### Scenario: Credencial verificable
- **WHEN** una certificación visible tiene `verificationUrl: "https://example.org/c/1"`, `credentialId: "EJ-1"` y `expiresAt: "2029-06"`
- **THEN** su entrada en `hasCredential` trae esos tres valores como `url`, `identifier` y `expires`, y el emisor en `recognizedBy`

#### Scenario: Certificación sin credencial
- **WHEN** una certificación no tiene `verificationUrl`, `credentialId` ni `expiresAt`
- **THEN** su entrada trae solo `@type`, `name` y `recognizedBy`, sin claves nulas

#### Scenario: Sección oculta
- **WHEN** el perfil curado oculta `skills`, `education` y `certifications`
- **THEN** el `Person` no trae `knowsAbout`, `alumniOf` ni `hasCredential`

### Requirement: Escape del JSON-LD embebido
El JSON del bloque en el fragmento SHALL escapar `<`, `>`, `&`, U+2028 y U+2029 como `\uXXXX`, de modo que ningún texto del perfil pueda cerrar la etiqueta `<script>` y que `JSON.parse` del contenido devuelva los textos originales.

#### Scenario: Un título que intenta cerrar el script
- **WHEN** el título del perfil es `</script><script>alert(1)</script>`
- **THEN** el fragmento contiene `</script` una sola vez dentro del bloque (su cierre) y el `name` parseado es el título original

### Requirement: Sin datos estructurados fuera de lo indexable
Un perfil `PROTECTED`, `PRIVATE`, archivado o inexistente MUST NOT producir JSON-LD por el fragmento, con o sin `token`, y los cuatro casos SHALL seguir devolviendo el fragmento genérico con `noindex, nofollow`. Un perfil `PUBLIC` con `listed: false` SHALL emitir el bloque como cualquier perfil público.

#### Scenario: Perfiles no indexables
- **WHEN** se piden los fragmentos de un perfil `PROTECTED` (con y sin `token`), uno `PRIVATE`, uno archivado y un slug inexistente
- **THEN** ninguno contiene `application/ld+json` ni `ProfilePage`

#### Scenario: Perfil público no enumerado
- **WHEN** un perfil `PUBLIC` pasa a `listed: false` y se pide su fragmento
- **THEN** el fragmento trae el bloque `ProfilePage` y `robots: index, follow`

### Requirement: El `lastmod` del sitemap refleja ediciones, no visitas
El `<lastmod>` de cada URL de `GET /sitemap.xml` SHALL ser la fecha de la última edición del perfil curado. Una visita MUST NOT cambiarlo, para no anunciar cambios que no hubo ni revelar cuándo se abrió por última vez un perfil.

#### Scenario: Una visita no cambia el lastmod
- **WHEN** el perfil `tech-lead-dotnet` tiene `updatedAt` en `2026-01-15T12:00:00.000Z`, recibe una visita humana y se pide `GET /sitemap.xml`
- **THEN** la URL `/tech-lead-dotnet` del sitemap lleva `<lastmod>2026-01-15</lastmod>`

#### Scenario: Una edición actualiza el lastmod
- **WHEN** después de eso el administrador guarda un cambio del perfil y se vuelve a pedir el sitemap
- **THEN** la URL `/tech-lead-dotnet` lleva como `<lastmod>` la fecha del guardado

### Requirement: Fecha de la última edición en los datos estructurados
El `ProfilePage` SHALL llevar `dateModified` con el día UTC (`AAAA-MM-DD`) del `updatedAt` del perfil curado, el mismo día que el `<lastmod>` de su URL en el sitemap, entre `inLanguage` y `mainEntity`. Head y cliente SHALL emitir el mismo valor; sin `updatedAt` la clave MUST omitirse. Una visita MUST NOT cambiarlo.

#### Scenario: El mismo día que el sitemap
- **WHEN** `tech-lead-dotnet` tiene `updatedAt` en `2026-01-15T12:00:00.000Z` y se piden su fragmento de head y `GET /sitemap.xml`
- **THEN** el bloque parseado trae `dateModified: "2026-01-15"` después de `inLanguage` y el sitemap trae `<lastmod>2026-01-15</lastmod>` para esa URL

#### Scenario: Día UTC en cualquier zona
- **WHEN** el cliente arma el bloque de un perfil con `updatedAt` `2026-03-01T23:30:00.000Z` en un navegador con zona UTC−4
- **THEN** `dateModified` es `2026-03-01`, igual que en el fragmento del head

#### Scenario: Una visita no la mueve
- **WHEN** después de fijar `updatedAt` el perfil recibe una visita humana y se vuelve a pedir su fragmento con la caché vencida
- **THEN** `dateModified` sigue en `2026-01-15`
