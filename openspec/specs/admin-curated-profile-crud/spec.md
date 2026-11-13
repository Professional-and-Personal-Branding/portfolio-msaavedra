# admin-curated-profile-crud Specification

## Purpose
Permite al administrador crear y ajustar perfiles curados: qué se filtra, qué se fuerza, cómo se ve y quién puede verlo, con reglas que impiden estados inconsistentes.

## Requirements

### Requirement: Listado y detalle administrativos
`GET /api/admin/curated-profiles` SHALL listar todos los perfiles (cualquier visibilidad) con los campos crudos: traducibles `{ es, en }`, `filterTags`, `includeIds`, `excludeIds`, `themeId`, `themeOverrides`, `layout`, `sectionsOrder`, `sectionsHidden`, `visibility`, `accessToken`, `views`, `createdAt`, `updatedAt`. `GET /api/admin/curated-profiles/:id` SHALL devolver uno (404 si no existe).

#### Scenario: Listado completo con campos internos
- **WHEN** el administrador hace `GET /api/admin/curated-profiles`
- **THEN** recibe 14 elementos (tras el seed) y cada uno incluye `filterTags`, `includeIds`, `excludeIds` y `visibility`

### Requirement: Creación validada con slug único
`POST /api/admin/curated-profiles` SHALL crear un perfil (201) con `slug` en kebab-case (`^[a-z0-9]+(?:-[a-z0-9]+)*$`) y único (409 si ya existe) y `title` `{ es: string, en?: string }` obligatorio. `headline` `{ es: string, en?: string }` es **opcional** (decisión D7 de `add-profile-content-admin`): omitido o vacío, el perfil no tiene titular propio y su hero muestra el titular del perfil base.

#### Scenario: Creación mínima
- **WHEN** envía `{ slug: "qa-lead", title: { es: "QA Lead" }, headline: { es: "Calidad" }, filterTags: ["testing"] }`
- **THEN** recibe 201 y `GET /api/curated-profiles/qa-lead` responde 200 con las experiencias que tengan `testing`

#### Scenario: Sin titular propio
- **WHEN** envía `{ slug: "qa-lead", title: { es: "QA Lead" } }` sin `headline`
- **THEN** recibe 201, `GET /api/curated-profiles/qa-lead` responde `headline: ""` y `profile.headline` trae el titular del perfil base, que es el que muestra el hero

#### Scenario: Slug duplicado
- **WHEN** envía `slug: "all"`
- **THEN** recibe 409 con `error: "Conflict"`

#### Scenario: Slug inválido
- **WHEN** envía `slug: "QA Lead!"`
- **THEN** recibe 400

### Requirement: Campos opcionales de la creación y sus valores por defecto
Al crear un perfil, `description` y `roleType` SHALL ser opcionales bilingües; `techFocus`, string opcional; `filterTags`, `includeIds`, `excludeIds`, `sectionsOrder` y `sectionsHidden`, arrays de strings (default `[]`); `themeOverrides`, objeto opcional; `layout`, string (default `classic`); `visibility` ∈ `PUBLIC|PRIVATE|PROTECTED` (default `PUBLIC`); y `accessToken`, string opcional.

#### Scenario: Valores por defecto
- **WHEN** se crea un perfil enviando solo `slug` y `title`
- **THEN** el perfil creado tiene `visibility: "PUBLIC"`, `layout: "classic"` y `filterTags`, `includeIds`, `excludeIds`, `sectionsOrder` y `sectionsHidden` vacíos, y no tiene la clave `accentColor`

### Requirement: Coherencia de tema y acceso al crear
Al crear un perfil, `themeId` es opcional y, si se envía, MUST existir (404 → 400 con mensaje). Un perfil `PROTECTED` MUST tener `accessToken` no vacío (400 si falta).

#### Scenario: PROTECTED sin token
- **WHEN** envía `visibility: "PROTECTED"` sin `accessToken`
- **THEN** recibe 400 y el mensaje menciona `accessToken`

#### Scenario: Tema inexistente
- **WHEN** envía `themeId: "no-existe"`
- **THEN** recibe 400 y el mensaje menciona `themeId`

### Requirement: Edición parcial de filtros, overrides y presentación
`PATCH /api/admin/curated-profiles/:id` SHALL aplicar solo los campos enviados con las mismas reglas (incluida la coherencia `PROTECTED`/`accessToken` sobre el estado resultante y la unicidad si cambia el `slug`) y responder 200; 404 si no existe.

#### Scenario: Editar filterTags cambia la resolución
- **WHEN** cambia `filterTags` de `tech-lead-dotnet` a `["ruby"]`
- **THEN** `GET /api/curated-profiles/tech-lead-dotnet` devuelve solo experiencias con `ruby`

#### Scenario: Editar includeIds y excludeIds
- **WHEN** envía `{ includeIds: [<id de Kiwox>], excludeIds: [<id de Novacomp>] }` en `tech-lead-dotnet`
- **THEN** la resolución incluye Kiwox y excluye Novacomp

#### Scenario: Pasar a PROTECTED con token
- **WHEN** envía `{ visibility: "PROTECTED", accessToken: "abc123" }`
- **THEN** recibe 200, la ruta pública responde 401 sin token y 200 con `X-Access-Token: abc123`

#### Scenario: Pasar a PROTECTED sin token existente
- **WHEN** un perfil sin `accessToken` recibe `{ visibility: "PROTECTED" }`
- **THEN** recibe 400

#### Scenario: Cambiar slug a uno ocupado
- **WHEN** envía `{ slug: "all" }` en otro perfil
- **THEN** recibe 409

### Requirement: Borrado
`DELETE /api/admin/curated-profiles/:id` SHALL borrar el perfil, sus `ProfileView` y sus `ShareLink` (204; 404 si no existe).

#### Scenario: Borrado exitoso
- **WHEN** borra un perfil creado en la prueba
- **THEN** recibe 204 y `GET /api/curated-profiles/<slug>` responde 404

#### Scenario: Se borran sus enlaces
- **WHEN** borra un perfil que tiene dos enlaces de seguimiento
- **THEN** recibe 204 y ninguno de los dos enlaces existe

### Requirement: Validación de ids de sección
`POST /api/admin/curated-profiles`, `PATCH /api/admin/curated-profiles/{id}` y `POST /api/admin/curated-profiles/preview` SHALL rechazar con **400** cualquier `sectionsOrder` o `sectionsHidden` que contenga un id fuera del catálogo canónico, y el mensaje de error MUST nombrar el id inválido. Los ids desconocidos MUST NOT descartarse en silencio ni normalizarse. El OpenAPI SHALL declarar ambos campos como arrays del enum de secciones.

#### Scenario: Id inválido al crear
- **WHEN** se hace `POST /api/admin/curated-profiles` con `sectionsOrder: ["hero", "heroe"]`
- **THEN** responde 400 y el mensaje contiene `heroe`, y no se crea ningún perfil

#### Scenario: Id inválido al editar
- **WHEN** se hace `PATCH` con `sectionsHidden: ["proyectos"]`
- **THEN** responde 400 y el perfil queda sin cambios

#### Scenario: Id inválido en el preview
- **WHEN** se hace `POST /api/admin/curated-profiles/preview` con un id de sección inexistente
- **THEN** responde 400, para que no se pueda previsualizar algo que no se podría guardar

#### Scenario: Los nueve ids del catálogo se aceptan
- **WHEN** se hace `PATCH` con los nueve ids del catálogo en `sectionsOrder`
- **THEN** responde 200 y los persiste en ese orden

### Requirement: Duplicar un perfil curado
`POST /api/admin/curated-profiles/{id}/duplicate` SHALL crear un perfil nuevo copiando `title`, `headline`, `description`, `roleType`, `techFocus`, `filterTags`, `includeIds`, `excludeIds`, `themeId`, `themeOverrides`, `layout`, `sectionsOrder` y `sectionsHidden` del original, y SHALL responder 201 con el perfil creado.

#### Scenario: Duplicado de un perfil configurado
- **WHEN** se duplica un perfil con `filterTags`, `sectionsOrder`, `sectionsHidden` y `themeOverrides` propios
- **THEN** responde 201 y los cuatro campos del duplicado son idénticos a los del original

#### Scenario: El duplicado hereda el acento
- **WHEN** se duplica un perfil con `themeOverrides.colors.accent: "#5B2C87"`
- **THEN** el duplicado tiene `themeOverrides.colors.accent: "#5B2C87"` y no tiene la clave `accentColor`

#### Scenario: El original no se modifica
- **WHEN** se duplica un perfil
- **THEN** el original conserva su slug, su visibilidad, su token y sus visitas

#### Scenario: Id inexistente
- **WHEN** se duplica un id que no existe
- **THEN** responde 404

### Requirement: El duplicado nace retirado
La copia MUST NOT heredar `accessToken` (queda nulo), `views` (queda en 0), sus `ProfileView` (ninguna), sus `ShareLink` (ninguno) ni `archivedAt` (nulo). La copia SHALL forzarse a `visibility = PRIVATE` y `listed = false`, para que un duplicado a medio configurar no quede accesible por un slug adivinable.

#### Scenario: El duplicado nace retirado
- **WHEN** se duplica un perfil `PUBLIC` con token de acceso y 40 visitas
- **THEN** el duplicado tiene `visibility: "PRIVATE"`, `listed: false`, `accessToken: null`, `views: 0` y su slug responde 404 en la ruta pública

#### Scenario: Los enlaces quedan en el original
- **WHEN** se duplica un perfil con tres enlaces de seguimiento
- **THEN** el listado de enlaces del duplicado está vacío y el original conserva los tres

### Requirement: Slug del duplicado
El `slug` del duplicado SHALL derivarse del original agregando el primer sufijo numérico libre (`-2`, `-3`, …). El cuerpo de la petición MUST NOT aceptar un slug: renombrar es una operación aparte y ya no rompe links.

#### Scenario: Slug derivado con colisión
- **WHEN** ya existen `acme-lead` y `acme-lead-2` y se duplica `acme-lead`
- **THEN** el nuevo slug es `acme-lead-3`

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

### Requirement: `accentColor` retirado del contrato
El perfil curado MUST NOT tener `accentColor`. La creación y la edición SHALL rechazar con 400 un cuerpo que lo incluya, igual que cualquier campo no declarado, y el mensaje MUST nombrar la propiedad. El documento OpenAPI MUST NOT declararlo en ningún schema, y las respuestas administrativas (detalle, listado, alta, edición y duplicado) MUST NOT incluirlo. El acento del sitio sale solo de los tokens del tema (`colors.accent`).

#### Scenario: Alta con el campo retirado
- **WHEN** un cliente autenticado crea un perfil con `slug`, `title` y `accentColor: "#5B2C87"`
- **THEN** responde 400, el mensaje nombra `accentColor` y no se crea ningún perfil

#### Scenario: Edición con el campo retirado
- **WHEN** un cliente autenticado hace `PATCH` de un perfil existente con `accentColor: "#5B2C87"`
- **THEN** responde 400 y el perfil no cambia

#### Scenario: El documento no lo declara
- **WHEN** se exporta el documento OpenAPI
- **THEN** ningún schema tiene la propiedad `accentColor`

#### Scenario: La salida administrativa no lo trae
- **WHEN** un cliente autenticado hace `GET /api/admin/curated-profiles/{id}`
- **THEN** el cuerpo no tiene la clave `accentColor`

### Requirement: Borrador de perfil desde una vacante
`POST /api/admin/curated-profiles/from-job-posting` SHALL crear un perfil curado a partir de una vacante importada, que lee por el puerto de lectura de `job-posting`: título del cuerpo o de la vacante en ES y EN, titular vacío, sin overrides, layout `classic`, secciones por defecto, `PRIVATE`, `listed: false` y sin token. Una vacante inexistente SHALL dar 404.

#### Scenario: Borrador privado
- **WHEN** el owner crea un borrador desde una vacante con `filterTags: ["java", "spring-boot"]`
- **THEN** responde 201 con un perfil `PRIVATE`, `listed: false`, esos `filterTags` y el título de la vacante, y la vacante no cambia

#### Scenario: Vacante inexistente
- **WHEN** el `jobPostingId` no existe
- **THEN** la respuesta es 404 y no se crea ningún perfil

#### Scenario: No se enumera
- **WHEN** se crea el borrador y se pide `sitemap.xml` o `GET /api/curated-profiles/{slug}` del borrador
- **THEN** el sitemap no lo lista y la ruta pública responde 404

### Requirement: Tags del borrador dentro del vocabulario
Los `filterTags` del borrador SHALL ser entre 1 y 20, sin repetidos, y cada uno SHALL existir en el vocabulario vigente (tags de experiencias y proyectos visibles y de las skills); si no, la respuesta SHALL ser 400 nombrando los desconocidos. El slug SHALL ser el dado (409 si está ocupado) o el derivado de empresa y puesto con el primer sufijo libre hasta `-50`.

#### Scenario: Tag inventado
- **WHEN** el cuerpo trae `filterTags: ["java", "cobol-mainframe"]` y `cobol-mainframe` no está en el vocabulario
- **THEN** la respuesta es 400 que nombra `cobol-mainframe` y no se crea ningún perfil

#### Scenario: Sin tags
- **WHEN** el cuerpo trae `filterTags: []`
- **THEN** la respuesta es 400

#### Scenario: Slug derivado ocupado
- **WHEN** el slug derivado `acme-ejemplo-backend-engineer` ya existe
- **THEN** el borrador se crea con `acme-ejemplo-backend-engineer-2`

#### Scenario: Slug elegido ocupado
- **WHEN** el cuerpo trae un `slug` que ya usa otro perfil o un alias
- **THEN** la respuesta es 409
