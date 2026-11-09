## ADDED Requirements

### Requirement: Pantalla Revisión del CV
`/admin/revision` SHALL requerir sesión, figurar como **Revisión** en la navegación y mostrar el resultado de `GET /api/admin/consistency`: el resumen por severidad, los años declarados y derivados, y los hallazgos agrupados en Errores, Avisos y Sugerencias y por tipo de entidad, cada uno con su mensaje y un enlace **Abrir** al ítem. La severidad MUST distinguirse por texto, no solo por color.

#### Scenario: Abrir una experiencia
- **WHEN** se pulsa **Abrir** en un hallazgo de la experiencia `exp1`
- **THEN** se llega a `/admin/experiencias`, se abre el diálogo de edición de `exp1` y el parámetro `editar` sale de la URL

#### Scenario: El ítem ya no existe
- **WHEN** se abre `/admin/formacion?editar=<id>` con un id que no está en la lista
- **THEN** aparece "El ítem ya no existe." y no se abre ningún diálogo

#### Scenario: Perfil curado
- **WHEN** se pulsa **Abrir** en un hallazgo de un perfil curado
- **THEN** se llega a su ficha en `/admin/perfiles/<id>`

#### Scenario: Sin hallazgos
- **WHEN** la API devuelve `issues` vacío
- **THEN** se muestra "No hay hallazgos: el CV es consistente." y ningún bloque de severidad

#### Scenario: Volver a revisar
- **WHEN** se corrige un ítem y se pulsa **Volver a revisar**
- **THEN** se vuelve a pedir `GET /api/admin/consistency` y la lista refleja el cambio
