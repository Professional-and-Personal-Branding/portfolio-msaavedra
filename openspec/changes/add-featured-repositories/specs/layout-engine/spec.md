## ADDED Requirements

### Requirement: La sección de repositorios no suma al arranque
El componente de la sección `repositories` SHALL cargarse en un chunk diferido, fuera de los scripts de `dist/index.html`, y SHALL precargarse cuando el perfil recibido trae `repositories` en `sections`. Mientras carga, la sección SHALL reservar su lugar con el título visible, sin spinner. El preview del panel SHALL usar el mismo registro.

#### Scenario: Fuera del arranque
- **WHEN** se corre `npm run build` y luego `npm run perf:budget`
- **THEN** sale con código 0, un solo JS de módulo, y el código de la sección de repositorios no está en ese JS

#### Scenario: Perfil sin la sección
- **WHEN** se abre un perfil cuyo `sections` no contiene `repositories`
- **THEN** el navegador no pide el chunk de la sección

#### Scenario: Perfil con la sección
- **WHEN** se abre `/` contra la base de ejemplo
- **THEN** la sección `#repositories` aparece en el orden de `sections` con sus tarjetas, y el recorrido de teclado de `a11y:check` pasa
