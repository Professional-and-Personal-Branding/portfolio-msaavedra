# admin-curated-profile-crud Specification (delta)

## ADDED Requirements

### Requirement: Duplicar un perfil curado
`POST /api/admin/curated-profiles/{id}/duplicate` SHALL crear un perfil nuevo copiando `title`, `headline`, `description`, `roleType`, `techFocus`, `filterTags`, `includeIds`, `excludeIds`, `accentColor`, `themeId`, `themeOverrides`, `layout`, `sectionsOrder` y `sectionsHidden` del original, y SHALL responder 201 con el perfil creado.

La copia MUST NOT heredar `accessToken` (queda nulo), `views` (queda en 0), sus `ProfileView` (ninguna) ni `archivedAt` (nulo). La copia SHALL forzarse a `visibility = PRIVATE` y `listed = false`, para que un duplicado a medio configurar no quede accesible por un slug adivinable.

El `slug` SHALL derivarse del original agregando el primer sufijo numérico libre (`-2`, `-3`, …). El cuerpo de la petición MUST NOT aceptar un slug: renombrar es una operación aparte y ya no rompe links.

#### Scenario: Duplicado de un perfil configurado
- **WHEN** se duplica un perfil con `filterTags`, `sectionsOrder`, `sectionsHidden` y `themeOverrides` propios
- **THEN** responde 201 y los cuatro campos del duplicado son idénticos a los del original

#### Scenario: El duplicado nace retirado
- **WHEN** se duplica un perfil `PUBLIC` con token de acceso y 40 visitas
- **THEN** el duplicado tiene `visibility: "PRIVATE"`, `listed: false`, `accessToken: null`, `views: 0` y su slug responde 404 en la ruta pública

#### Scenario: Slug derivado con colisión
- **WHEN** ya existen `acme-lead` y `acme-lead-2` y se duplica `acme-lead`
- **THEN** el nuevo slug es `acme-lead-3`

#### Scenario: El original no se modifica
- **WHEN** se duplica un perfil
- **THEN** el original conserva su slug, su visibilidad, su token y sus visitas

#### Scenario: Id inexistente
- **WHEN** se duplica un id que no existe
- **THEN** responde 404

### Requirement: Archivar y desarchivar
`POST /api/admin/curated-profiles/{id}/archive` SHALL registrar `archivedAt` con la hora del servidor, y `POST .../unarchive` SHALL dejarlo nulo. Ambas SHALL responder 200 con el perfil. `archivedAt` MUST NOT ser escribible desde el cuerpo de `POST` ni de `PATCH`: una fecha arbitraria o futura no tiene significado en el dominio.

Archivar un perfil ya archivado SHALL ser idempotente y SHALL conservar la fecha original.

#### Scenario: Archivar
- **WHEN** se archiva un perfil `PUBLIC`
- **THEN** responde 200 con `archivedAt` no nulo, y su slug devuelve 404 en la ruta pública

#### Scenario: Archivar dos veces
- **WHEN** se archiva un perfil ya archivado
- **THEN** responde 200 y `archivedAt` conserva el valor de la primera vez

#### Scenario: Desarchivar
- **WHEN** se desarchiva
- **THEN** `archivedAt` queda nulo y la ruta pública vuelve a responder según su visibilidad

#### Scenario: `archivedAt` no se puede escribir por `PATCH`
- **WHEN** se hace `PATCH` con `archivedAt` en el cuerpo
- **THEN** responde 400 por campo no permitido y el perfil queda sin cambios

### Requirement: Enumeración controlada por `listed`
`CuratedProfile` SHALL tener `listed` (booleano, por defecto `true`), escribible por `PATCH`. `listed` SHALL decidir **únicamente** si el perfil se enumera en los listados públicos, el menú y el sitemap, y MUST NOT afectar el acceso por slug ni la validación del token: un perfil `PUBLIC` no enumerado sigue respondiendo 200 por su URL.

#### Scenario: No enumerado sigue accesible
- **WHEN** un perfil `PUBLIC` se marca `listed: false` y se pide su slug
- **THEN** responde 200 con el perfil completo

#### Scenario: No enumerado desaparece de los listados
- **WHEN** ese mismo perfil se busca en `GET /api/curated-profiles` y en `GET /sitemap.xml`
- **THEN** no figura en ninguno de los dos

#### Scenario: `listed` no altera la visibilidad
- **WHEN** un perfil `PROTECTED` se marca `listed: false`
- **THEN** sigue respondiendo 401 sin token y 200 con token válido
