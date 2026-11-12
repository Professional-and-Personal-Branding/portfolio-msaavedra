## ADDED Requirements

### Requirement: Traducciones de los repositorios
`i18n.missing-translation` (warning) SHALL emitirse por la `description` de cada repositorio visible con un idioma vacío y el otro con contenido, con `entityType` `repository` y `field` `description`, igual que en proyectos. Los repositorios ocultos MUST NOT generar issues.

#### Scenario: Falta el inglés
- **WHEN** un repositorio visible tiene `description.es` y `description.en` vacío
- **THEN** hay un `i18n.missing-translation` sobre él con `field` `description` y `params.locale` `en`

#### Scenario: Repositorio oculto
- **WHEN** un repositorio con `visible: false` tiene `description.en` vacío
- **THEN** no hay issue sobre él
