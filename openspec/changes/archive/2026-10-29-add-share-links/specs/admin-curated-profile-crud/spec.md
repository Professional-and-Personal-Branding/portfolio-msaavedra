# admin-curated-profile-crud Specification (delta)

## MODIFIED Requirements

### Requirement: Borrado
`DELETE /api/admin/curated-profiles/:id` SHALL borrar el perfil, sus `ProfileView` y sus `ShareLink` (204; 404 si no existe).

#### Scenario: Borrado exitoso
- **WHEN** borra un perfil creado en la prueba
- **THEN** recibe 204 y `GET /api/curated-profiles/<slug>` responde 404

#### Scenario: Se borran sus enlaces
- **WHEN** borra un perfil que tiene dos enlaces de seguimiento
- **THEN** recibe 204 y ninguno de los dos enlaces existe

### Requirement: El duplicado nace retirado
La copia MUST NOT heredar `accessToken` (queda nulo), `views` (queda en 0), sus `ProfileView` (ninguna), sus `ShareLink` (ninguno) ni `archivedAt` (nulo). La copia SHALL forzarse a `visibility = PRIVATE` y `listed = false`, para que un duplicado a medio configurar no quede accesible por un slug adivinable.

#### Scenario: El duplicado nace retirado
- **WHEN** se duplica un perfil `PUBLIC` con token de acceso y 40 visitas
- **THEN** el duplicado tiene `visibility: "PRIVATE"`, `listed: false`, `accessToken: null`, `views: 0` y su slug responde 404 en la ruta pública

#### Scenario: Los enlaces quedan en el original
- **WHEN** se duplica un perfil con tres enlaces de seguimiento
- **THEN** el listado de enlaces del duplicado está vacío y el original conserva los tres
