# layout-engine Specification

## Purpose
Permite que los mismos datos resueltos se presenten con estructuras distintas y en el orden que define cada perfil curado, base del constructor visual de la Fase 5.

## Requirements

### Requirement: Layouts estructurales conmutables
El frontend SHALL ofrecer al menos dos layouts que reciben los mismos datos: `classic` (una columna, hero arriba, como el demo) y `sidebar` (columna lateral fija con identidad y contacto; contenido a la derecha; en móvil la columna pasa arriba). El layout activo SHALL ser el `layout` del perfil curado, y `?layout=classic|sidebar` SHALL poder sobrescribirlo. Un valor desconocido MUST caer a `classic`.

#### Scenario: Layout del perfil
- **WHEN** el perfil curado tiene `layout: "sidebar"`
- **THEN** se renderiza `SidebarLayout`

#### Scenario: Override por URL
- **WHEN** se abre `/all?layout=sidebar`
- **THEN** se renderiza `SidebarLayout` aunque el perfil tenga `classic`

#### Scenario: Valor desconocido
- **WHEN** el layout es `"timeline-3d"`
- **THEN** se renderiza `ClassicLayout`

### Requirement: Orden y ocultamiento de secciones
El cliente renderiza el orden que recibe. El frontend SHALL derivar el tipo `SectionId` de los tipos generados del OpenAPI y MUST NOT declarar su propia lista de secciones. El layout SHALL recorrer el array `sections` de la respuesta **en el orden recibido** y renderizar cada sección. El cliente MUST NOT reordenar, MUST NOT agregar secciones por relleno y MUST NOT decidir si una sección tiene datos: eso lo resuelve el backend.

#### Scenario: Orden de la API
- **WHEN** `sections = ["hero","skills","experience","contact"]`
- **THEN** el DOM contiene esas cuatro secciones en ese orden

#### Scenario: Conocidas no listadas se agregan al final
- **WHEN** el perfil tiene proyectos y enlaces sociales y su `sectionsOrder` no incluye `projects` ni `presence`
- **THEN** `projects` y `presence` llegan ya agregadas al final de `sections` por el backend (spec `curated-profile-resolution`), y el cliente las renderiza en esa posición sin agregar nada por su cuenta

#### Scenario: Ocultas y vacías
- **WHEN** `hiddenSections = ["stats"]` y `projects = []`
- **THEN** no se renderizan `stats` ni `projects`, porque el backend ya las excluyó de `sections` y el cliente no las agrega

#### Scenario: Se renderiza exactamente lo recibido
- **WHEN** la API devuelve `sections: ["hero", "experience", "projects"]`
- **THEN** la vista renderiza esas tres secciones en ese orden y ninguna otra

#### Scenario: Un id desconocido en la respuesta no rompe la vista
- **WHEN** la respuesta trae un id que el cliente no conoce
- **THEN** la vista omite ese id y renderiza el resto sin lanzar error

### Requirement: El registro de secciones del cliente es exhaustivo
El registro de secciones del cliente SHALL estar tipado de forma que falte implementar una sección del catálogo **no compile**.

#### Scenario: Una sección del catálogo sin implementar rompe el build
- **WHEN** el catálogo del backend declara un id que el registro del cliente no implementa
- **THEN** `npm run typecheck` falla

### Requirement: Estadísticas derivadas
La sección `stats` SHALL derivarse de los datos resueltos: años de experiencia (`profile.yearsOfExperience`), cantidad de experiencias, cantidad de tecnologías únicas y cantidad de certificaciones. No requiere campos nuevos en la API.

#### Scenario: Cálculo
- **WHEN** el perfil tiene 15 experiencias con 80 tecnologías únicas, 8 certificaciones y `yearsOfExperience = 10`
- **THEN** `stats` muestra 10+, 15, 80 y 8

### Requirement: Columna única del layout sidebar en móvil
Por debajo del breakpoint `lg`, la grilla de `SidebarLayout` SHALL declarar una sola columna que ocupa todo el ancho del contenedor, de modo que el ancho del aside y del contenido no dependa de qué secciones estén renderizadas.

#### Scenario: Ancho estable en móvil
- **WHEN** a 375 px de ancho se renderiza `SidebarLayout` primero solo con `hero` y después con todas las secciones
- **THEN** el aside tiene el mismo ancho en los dos renders y no hay scroll horizontal

#### Scenario: Escritorio sin cambios
- **WHEN** el viewport es de 1280 px
- **THEN** la grilla conserva la columna lateral de 320 px y el contenido a la derecha

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
