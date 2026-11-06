## MODIFIED Requirements

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
- **WHEN** se inspecciona el bloque de cualquier perfil público
- **THEN** no trae `dateModified` ni `dateCreated`

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

## ADDED Requirements

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
