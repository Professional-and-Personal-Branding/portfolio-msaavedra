# admin-curated-profile-crud Specification (delta)

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Campos opcionales de la creación y sus valores por defecto
Al crear un perfil, `description` y `roleType` SHALL ser opcionales bilingües; `techFocus`, string opcional; `filterTags`, `includeIds`, `excludeIds`, `sectionsOrder` y `sectionsHidden`, arrays de strings (default `[]`); `themeOverrides`, objeto opcional; `layout`, string (default `classic`); `visibility` ∈ `PUBLIC|PRIVATE|PROTECTED` (default `PUBLIC`); y `accessToken`, string opcional.

#### Scenario: Valores por defecto
- **WHEN** se crea un perfil enviando solo `slug` y `title`
- **THEN** el perfil creado tiene `visibility: "PUBLIC"`, `layout: "classic"` y `filterTags`, `includeIds`, `excludeIds`, `sectionsOrder` y `sectionsHidden` vacíos, y no tiene la clave `accentColor`

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

## REMOVED Requirements

### Requirement: `accentColor` obsoleto en el contrato
**Reason**: Era la primera etapa del retiro (D9 de `polish-builder-and-edge`). Esta etapa quita el campo del contrato, del dominio y de la base, así que ya no hay nada que marcar como obsoleto ni que aceptar.
**Migration**: Lo reemplaza *`accentColor` retirado del contrato*. El valor de cada perfil quedó en `themeOverrides.colors.accent` (`data-persistence-seed`, *Migración del acento de los perfiles al tema*). Un cliente que enviaba el campo debe dejar de hacerlo (recibe 400) y editar el acento como token del tema.
