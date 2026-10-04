# layout-engine Specification (delta)

## MODIFIED Requirements

### Requirement: El cliente renderiza el orden que recibe
El frontend SHALL derivar el tipo `SectionId` de los tipos generados del OpenAPI y MUST NOT declarar su propia lista de secciones. El layout SHALL recorrer el array `sections` de la respuesta **en el orden recibido** y renderizar cada sección. El cliente MUST NOT reordenar, MUST NOT agregar secciones por relleno y MUST NOT decidir si una sección tiene datos: eso lo resuelve el backend.

El registro de secciones del cliente SHALL estar tipado de forma que falte implementar una sección del catálogo **no compile**.

#### Scenario: Se renderiza exactamente lo recibido
- **WHEN** la API devuelve `sections: ["hero", "experience", "projects"]`
- **THEN** la vista renderiza esas tres secciones en ese orden y ninguna otra

#### Scenario: Una sección del catálogo sin implementar rompe el build
- **WHEN** el catálogo del backend declara un id que el registro del cliente no implementa
- **THEN** `npm run typecheck` falla

#### Scenario: Un id desconocido en la respuesta no rompe la vista
- **WHEN** la respuesta trae un id que el cliente no conoce
- **THEN** la vista omite ese id y renderiza el resto sin lanzar error
