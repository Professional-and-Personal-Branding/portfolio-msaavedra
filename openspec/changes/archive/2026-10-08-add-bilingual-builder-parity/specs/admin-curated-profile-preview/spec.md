# admin-curated-profile-preview Specification (delta)

## ADDED Requirements

### Requirement: Preview en el idioma elegido
El constructor SHALL permitir resolver el preview en español o en inglés sin recargar y sin modificar el borrador. El idioma del preview es estado de vista: MUST NOT persistirse en el perfil ni viajar en el `PATCH`.

La caché del preview SHALL indexarse por borrador **y** por idioma, de modo que conmutar y volver MUST NOT descartar el preview ya resuelto ni disparar una petición nueva.

#### Scenario: Conmutar a inglés
- **WHEN** se elige EN en el panel de preview de un perfil con contenido en inglés
- **THEN** el preview muestra los textos en inglés sin recargar la página y el borrador queda sin cambios

#### Scenario: Volver al idioma anterior no re-consulta
- **WHEN** se conmuta a EN y después de vuelta a ES, sin tocar el borrador
- **THEN** el preview en español se muestra desde la caché y no se emite una segunda petición

#### Scenario: El idioma no se persiste
- **WHEN** se conmuta a EN y se guarda el perfil
- **THEN** el cuerpo del `PATCH` no contiene ningún campo de idioma de preview

#### Scenario: Editar con el preview en inglés
- **WHEN** se cambia un filtro de tags con el preview en EN
- **THEN** el preview se recalcula en inglés, no vuelve a español

### Requirement: Informe de faltantes de traducción
La respuesta del preview SHALL incluir el conjunto de campos bilingües que, en el idioma resuelto, caen al fallback por estar vacíos, identificando entidad, id y campo. El cálculo SHALL hacerse en un servicio puro, sin acceso a persistencia.

Este informe MUST viajar únicamente en la respuesta del preview y MUST NOT exponerse en la ruta pública.

#### Scenario: Experiencia sin logros en inglés
- **WHEN** se previsualiza en EN un perfil que incluye una experiencia con `highlights.en` vacío
- **THEN** el informe la lista con su id y el campo `highlights`

#### Scenario: Perfil completo
- **WHEN** se previsualiza en EN un perfil cuyas entidades tienen todo el contenido en inglés
- **THEN** el informe viene vacío

#### Scenario: La ruta pública no lo expone
- **WHEN** se pide `GET /api/curated-profiles/{slug}`
- **THEN** la respuesta no contiene el informe de faltantes

#### Scenario: El informe acompaña al idioma pedido
- **WHEN** se previsualiza en ES un perfil con el español completo y el inglés a medias
- **THEN** el informe en ES viene vacío, y al conmutar a EN lista los faltantes

### Requirement: Qué cuenta como faltante de traducción
Un campo cuenta como faltante **solo** cuando su valor en el idioma pedido está ausente, es cadena vacía o es una lista vacía. Un valor idéntico al del otro idioma MUST NOT contar como faltante: hay nombres propios, siglas y títulos que no se traducen.

#### Scenario: Texto que no se traduce
- **WHEN** una experiencia tiene `role` idéntico en ES y EN (`Tech Lead`)
- **THEN** el informe no la marca como faltante
