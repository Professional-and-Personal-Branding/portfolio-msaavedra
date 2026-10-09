# admin-curated-profile-crud Specification (delta)

## ADDED Requirements

### Requirement: `accentColor` obsoleto en el contrato
El documento OpenAPI SHALL marcar `accentColor` como `deprecated` en la entrada de creación, edición y preview, y en las salidas del perfil curado (administrativa, pública, listado y preview). La API SHALL seguir aceptándolo con la misma validación y devolviéndolo igual que hoy. Quitarlo de la salida y borrar la columna queda para un change posterior.

#### Scenario: El documento lo marca obsoleto
- **WHEN** se exporta el documento OpenAPI
- **THEN** `accentColor` tiene `deprecated: true` en `CreateCuratedProfileDto`, `UpdateCuratedProfileDto`, `PreviewCuratedProfileDto`, `AdminCuratedProfileResponse` y `CuratedProfileSummaryResponse`

#### Scenario: Un cliente que lo envía sigue funcionando
- **WHEN** un cliente autenticado crea un perfil con `accentColor: "#5B2C87"`
- **THEN** responde 201 y el perfil creado tiene `accentColor: "#5B2C87"`

#### Scenario: La validación no cambia
- **WHEN** se crea un perfil con `accentColor: "rojo"`
- **THEN** responde 400
