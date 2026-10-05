# layout-engine Specification (delta)

## MODIFIED Requirements

### Requirement: Orden y ocultamiento de secciones
El cliente renderiza el orden que recibe. El frontend SHALL derivar el tipo `SectionId` de los tipos generados del OpenAPI y MUST NOT declarar su propia lista de secciones. El layout SHALL recorrer el array `sections` de la respuesta **en el orden recibido** y renderizar cada sección. El cliente MUST NOT reordenar, MUST NOT agregar secciones por relleno y MUST NOT decidir si una sección tiene datos: eso lo resuelve el backend.

El registro de secciones del cliente SHALL estar tipado de forma que falte implementar una sección del catálogo **no compile**.

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

#### Scenario: Una sección del catálogo sin implementar rompe el build
- **WHEN** el catálogo del backend declara un id que el registro del cliente no implementa
- **THEN** `npm run typecheck` falla

#### Scenario: Un id desconocido en la respuesta no rompe la vista
- **WHEN** la respuesta trae un id que el cliente no conoce
- **THEN** la vista omite ese id y renderiza el resto sin lanzar error
