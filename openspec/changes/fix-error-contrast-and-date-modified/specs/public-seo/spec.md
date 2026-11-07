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
- **WHEN** se inspecciona el bloque de un perfil público cuya vista resuelta trae `updatedAt: null`
- **THEN** no trae `dateModified` ni `dateCreated`

#### Scenario: Fecha de modificación presente
- **WHEN** se inspecciona el bloque de un perfil público cuyo perfil curado tiene `updatedAt`
- **THEN** el `ProfilePage` trae `dateModified` y no trae `dateCreated`

## ADDED Requirements

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
