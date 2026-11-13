## ADDED Requirements

### Requirement: Rótulos de la sección de repositorios
Los textos de interfaz de la sección `repositories`, de su línea en la hoja imprimible y del nombre accesible de sus enlaces SHALL salir del diccionario `es`/`en` con el locale activo. Los datos (`description`) SHALL llegar ya resueltos por la API.

#### Scenario: Título en inglés
- **WHEN** se abre `/?lang=en` contra la base de ejemplo
- **THEN** la sección de repositorios se titula «Featured Repositories» y las descripciones están en inglés

#### Scenario: Título en español
- **WHEN** se abre `/?lang=es` contra la base de ejemplo
- **THEN** la sección se titula «Repositorios destacados»
