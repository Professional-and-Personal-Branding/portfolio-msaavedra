# admin-curated-profile-crud Specification (delta)

## MODIFIED Requirements

### Requirement: Creación validada con slug único
`POST /api/admin/curated-profiles` SHALL crear un perfil (201) validando: `slug` en kebab-case (`^[a-z0-9]+(?:-[a-z0-9]+)*$`) y único (409 si ya existe); `title` `{ es: string, en?: string }` obligatorio; `headline` `{ es: string, en?: string }` **opcional** (decisión D7 de `add-profile-content-admin`): omitido o vacío, el perfil no tiene titular propio y su hero muestra el titular del perfil base; `description`, `roleType` opcionales bilingües; `techFocus` string opcional; `filterTags`, `includeIds`, `excludeIds`, `sectionsOrder`, `sectionsHidden` arrays de strings (default `[]`); `accentColor` hex `#RRGGBB` (default `#1A365D`); `themeId` opcional que MUST existir (404 → 400 con mensaje); `themeOverrides` objeto opcional; `layout` string (default `classic`); `visibility` ∈ `PUBLIC|PRIVATE|PROTECTED` (default `PUBLIC`); `accessToken` string opcional. Un perfil `PROTECTED` MUST tener `accessToken` no vacío (400 si falta).

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

#### Scenario: PROTECTED sin token
- **WHEN** envía `visibility: "PROTECTED"` sin `accessToken`
- **THEN** recibe 400 y el mensaje menciona `accessToken`

#### Scenario: Tema inexistente
- **WHEN** envía `themeId: "no-existe"`
- **THEN** recibe 400 y el mensaje menciona `themeId`
