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
`POST /api/admin/curated-profiles` SHALL crear un perfil (201) validando: `slug` en kebab-case (`^[a-z0-9]+(?:-[a-z0-9]+)*$`) y único (409 si ya existe); `title`, `headline` `{ es: string, en?: string }` obligatorios; `description`, `roleType` opcionales bilingües; `techFocus` string opcional; `filterTags`, `includeIds`, `excludeIds`, `sectionsOrder`, `sectionsHidden` arrays de strings (default `[]`); `accentColor` hex `#RRGGBB` (default `#1A365D`); `themeId` opcional que MUST existir (404 → 400 con mensaje); `themeOverrides` objeto opcional; `layout` string (default `classic`); `visibility` ∈ `PUBLIC|PRIVATE|PROTECTED` (default `PUBLIC`); `accessToken` string opcional. Un perfil `PROTECTED` MUST tener `accessToken` no vacío (400 si falta).

#### Scenario: Creación mínima
- **WHEN** envía `{ slug: "qa-lead", title: { es: "QA Lead" }, headline: { es: "Calidad" }, filterTags: ["testing"] }`
- **THEN** recibe 201 y `GET /api/curated-profiles/qa-lead` responde 200 con las experiencias que tengan `testing`

#### Scenario: Slug duplicado
- **WHEN** envía `slug: "all"`
- **THEN** recibe 409 con `error: "Conflict"`

#### Scenario: Slug inválido
- **WHEN** envía `slug: "QA Lead!"`
- **THEN** recibe 400

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
`DELETE /api/admin/curated-profiles/:id` SHALL borrar el perfil y sus `ProfileView` (204; 404 si no existe).

#### Scenario: Borrado exitoso
- **WHEN** borra un perfil creado en la prueba
- **THEN** recibe 204 y `GET /api/curated-profiles/<slug>` responde 404

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
