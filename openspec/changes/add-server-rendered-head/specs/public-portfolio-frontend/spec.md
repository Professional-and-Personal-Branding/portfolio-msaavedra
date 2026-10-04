# public-portfolio-frontend Specification (delta)

## MODIFIED Requirements

### Requirement: El escritor de metadatos del cliente es idempotente
`applyDocumentMeta` SHALL reutilizar la etiqueta existente para cada clave de metadato —buscándola por `name` o `property`, **sin exigir** que lleve el marcador `data-managed-meta`— y marcarla como gestionada al escribirla. Tras aplicarse sobre un head ya poblado por el servidor, el documento MUST contener **exactamente una** etiqueta por clave, un solo `<link rel="canonical">` y un solo `<script type="application/ld+json">`.

`restoreDocumentMeta` SHALL seguir limpiando únicamente lo marcado como gestionado.

#### Scenario: Head pre-poblado por el servidor
- **WHEN** el documento ya trae `og:title`, `description` y `canonical` del fragmento del servidor y el cliente resuelve el perfil
- **THEN** esas mismas etiquetas se actualizan y no se agrega ninguna duplicada

#### Scenario: Navegación entre perfiles sin recargar
- **WHEN** se navega de un perfil a otro dentro de la SPA
- **THEN** cada clave de metadato sigue teniendo una sola etiqueta, con los valores del perfil nuevo

#### Scenario: Head vacío (desarrollo, sin borde)
- **WHEN** el documento no trae metadatos del servidor
- **THEN** el cliente los crea y el resultado es el mismo que antes de este change

#### Scenario: Los textos del cliente y del servidor coinciden
- **WHEN** se comparan el fragmento del backend y el resultado de `metaFromProfile` para el mismo perfil e idioma
- **THEN** título, descripción y canonical son iguales
