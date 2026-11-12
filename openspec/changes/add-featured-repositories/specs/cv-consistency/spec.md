## ADDED Requirements

### Requirement: Traducciones de los repositorios
`i18n.missing-translation` (warning) SHALL emitirse por la `description` de cada repositorio visible con un idioma vacío y el otro con contenido, con `entityType` `repository` y `field` `description`, igual que en proyectos. Los repositorios ocultos MUST NOT generar issues.

#### Scenario: Falta el inglés
- **WHEN** un repositorio visible tiene `description.es` y `description.en` vacío
- **THEN** hay un `i18n.missing-translation` sobre él con `field` `description` y `params.locale` `en`

#### Scenario: Repositorio oculto
- **WHEN** un repositorio con `visible: false` tiene `description.en` vacío
- **THEN** no hay issue sobre él

### Requirement: Los repositorios cuentan como referencias de los perfiles curados
Las reglas de perfiles curados SHALL reconocer los ids de los repositorios, visibles u ocultos, como referencias válidas de `includeIds`/`excludeIds` (sin `curated.orphan-reference`), y SHALL contar los `tags` de los repositorios visibles al decidir si un `filterTags` tiene coincidencia (`curated.unmatched-filter-tag`).

#### Scenario: Referencia a un repositorio oculto
- **WHEN** un perfil curado incluye en `includeIds` el id de un repositorio con `visible: false`
- **THEN** no hay `curated.orphan-reference` sobre ese id

#### Scenario: Tag que solo tiene un repositorio
- **WHEN** un `filterTags` solo coincide con los tags de un repositorio visible
- **THEN** no hay `curated.unmatched-filter-tag` para ese tag
