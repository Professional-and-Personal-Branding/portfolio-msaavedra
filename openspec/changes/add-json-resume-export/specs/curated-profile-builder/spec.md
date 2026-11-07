## ADDED Requirements

### Requirement: Descarga del JSON Resume en la pestaña Publicación
La pestaña **Publicación** SHALL ofrecer, junto a «Link público», «Descargar JSON Resume» con un enlace **ES** y otro **EN** a la exportación del panel por id. En un perfil sin guardar los enlaces MUST estar deshabilitados con «Guardá el perfil para exportarlo»; con cambios sin guardar SHALL verse «Se exporta la última versión guardada». La vista pública MUST NOT sumar un enlace de descarga.

#### Scenario: Perfil guardado
- **WHEN** el owner abre **Publicación** de un perfil guardado y pulsa **EN**
- **THEN** el navegador descarga `<slug>.en.resume.json` desde `/api/admin/curated-profiles/<id>/resume.json?locale=en`

#### Scenario: Perfil privado
- **WHEN** el perfil es `PRIVATE` y el owner pulsa **ES**
- **THEN** la descarga funciona igual, sin token en la URL

#### Scenario: Perfil nuevo
- **WHEN** el owner crea un perfil y todavía no lo guardó
- **THEN** los dos enlaces están deshabilitados y se ve «Guardá el perfil para exportarlo»

#### Scenario: Cambios sin guardar
- **WHEN** el owner edita el título sin guardar
- **THEN** se ve «Se exporta la última versión guardada» debajo de los enlaces

#### Scenario: Vista pública sin cambios
- **WHEN** se carga la vista pública de cualquier perfil
- **THEN** no hay enlace a `resume.json` y `npm run perf:budget` no cambia de tamaño por este change
