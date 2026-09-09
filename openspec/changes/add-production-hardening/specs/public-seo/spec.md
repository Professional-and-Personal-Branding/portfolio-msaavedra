## Purpose

Un perfil curado se comparte por link con una empresa: ese link tiene que decir quién es Manuel y para qué rol, tanto en un buscador como en la vista previa de un chat.

## ADDED Requirements

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
El backend SHALL servir `GET /robots.txt` (permitiendo la vista pública, bloqueando `/admin`) y `GET /sitemap.xml` con la home y **solo** los perfiles curados `PUBLIC`, con URLs absolutas basadas en `FRONTEND_URL` y su fecha de última modificación.

#### Scenario: Sitemap con perfiles públicos
- **WHEN** se pide `GET /sitemap.xml` con la base seedeada
- **THEN** responde 200 con `Content-Type: application/xml`, incluye la home y `/tech-lead-dotnet`, y no incluye ningún perfil `PRIVATE` ni `PROTECTED`

#### Scenario: robots bloquea el panel
- **WHEN** se pide `GET /robots.txt`
- **THEN** el cuerpo contiene `Disallow: /admin` y la referencia al `sitemap.xml`

#### Scenario: Un perfil que deja de ser público desaparece del sitemap
- **WHEN** un perfil pasa a `PRIVATE` y se vuelve a pedir el sitemap
- **THEN** su URL ya no figura

### Requirement: Metadatos base del documento
`index.html` SHALL traer título, descripción, OpenGraph y Twitter Card por defecto, para que un scraper que no ejecuta JavaScript muestre una vista previa correcta del portafolio (aunque no la del perfil concreto).

#### Scenario: Vista previa sin JavaScript
- **WHEN** un scraper lee el HTML servido sin ejecutar scripts
- **THEN** encuentra `og:title`, `og:description` y `og:image` genéricos del portafolio
