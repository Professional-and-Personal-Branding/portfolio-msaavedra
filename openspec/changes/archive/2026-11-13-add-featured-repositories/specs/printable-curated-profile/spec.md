## MODIFIED Requirements

### Requirement: Contenido y orden de la hoja
La hoja SHALL abrir con un encabezado de identidad (nombre, titular, email, ubicación y LinkedIn) y seguir con bloques en el orden de `sections` de la respuesta. Una sección ausente de `sections` MUST NOT imprimirse. `stats` MUST NOT imprimirse. `repositories` SHALL imprimirse solo según *Repositorios en la hoja solo si entran*. `contact` y `presence` SHALL sumar datos al encabezado en lugar de imprimirse como bloque. El cliente MUST NOT reordenar.

#### Scenario: Orden del perfil
- **WHEN** `sections = ["hero","skills","experience","education"]`
- **THEN** los bloques de la hoja son Perfil, Skills, Experiencia y Formación, en ese orden

#### Scenario: Sección oculta
- **WHEN** el perfil oculta `certifications`
- **THEN** la hoja no tiene bloque de certificaciones

#### Scenario: Contacto en el encabezado
- **WHEN** `sections` incluye `contact` y el perfil tiene teléfono e idiomas
- **THEN** el encabezado muestra teléfono, idiomas y disponibilidad, y no hay un bloque Contacto aparte

## ADDED Requirements

### Requirement: Repositorios en la hoja solo si entran
Si `sections` trae `repositories`, la hoja SHALL sumar en esa posición una sola línea «Repositorios:» con hasta 3 nombres enlazados, sin imprimir URLs, y «y N más» si hay más, solo si `estimatePrintLines` de la hoja sin ella más 1,5 no supera `PRINT_CAPACITY_LINES`. Si no, la línea MUST omitirse sin aviso. La hoja única SHALL mantenerse.

#### Scenario: Entra
- **WHEN** se arma la hoja de `/` contra la base de ejemplo, cuyo estimado deja lugar
- **THEN** hay una línea con los 2 nombres, cada uno con `href` a su repositorio, y el texto de la hoja no contiene `github.com`

#### Scenario: No entra
- **WHEN** un test arma una hoja cuyo estimado sin repositorios es `PRINT_CAPACITY_LINES - 1`
- **THEN** la hoja no tiene la línea de repositorios ni una línea de omitidos por ella

#### Scenario: Más de tres
- **WHEN** la vista resuelve 5 repositorios y la línea entra
- **THEN** muestra los 3 primeros por `order` y «y 2 más»

#### Scenario: Una hoja con repositorios
- **WHEN** se corre `npm run print:check` contra la base de ejemplo y contra una base con `docs/cv-data.json` más dos repositorios de prueba
- **THEN** cada combinación de perfil, idioma, papel y tema da un PDF de una página y el script sale con código 0
