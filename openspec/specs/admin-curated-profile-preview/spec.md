# admin-curated-profile-preview Specification

## Purpose
Permite ver, antes de guardar, exactamente qué va a renderizar la vista pública para un perfil curado en construcción: la misma resolución, el mismo DTO, sin escribir nada en la base.

## Requirements

### Requirement: Resolución de un borrador sin persistir
`POST /api/admin/curated-profiles/preview` (autenticado) SHALL aceptar un borrador con `filterTags`, `includeIds`, `excludeIds`, `themeId`, `themeOverrides`, `layout`, `sectionsOrder`, `sectionsHidden` los textos del perfil y el `slug`, y devolver el mismo `CuratedProfileResponse` que `GET /api/curated-profiles/{slug}`, resuelto al locale negociado. MUST NOT crear, modificar ni borrar ningún registro. Un borrador con `accentColor` MUST responder 400.

#### Scenario: Preview de un borrador nuevo
- **WHEN** se envía un borrador con `filterTags: ["dotnet"]` y sin `slug` existente
- **THEN** responde 200 con `experiences`, `skillCategories`, `projects`, `theme` y `sections` resueltos, y la cantidad de filas de `CuratedProfile` en la base no cambia

#### Scenario: No registra visitas
- **WHEN** se pide el preview de un borrador cuyo `slug` coincide con un perfil existente
- **THEN** el contador `views` de ese perfil y la cantidad de `ProfileView` no cambian

#### Scenario: Borrador con el campo retirado
- **WHEN** se pide el preview de un borrador que incluye `accentColor: "#5B2C87"`
- **THEN** responde 400 y el mensaje nombra `accentColor`

### Requirement: Misma resolución que la ruta pública
El preview SHALL aplicar la selección por tags con overrides, el orden canónico de experiencias, la selección de categorías de skills, el merge profundo del tema y la resolución de secciones con las mismas reglas que la ruta pública, compartiendo la implementación.

#### Scenario: Equivalencia con la vista pública
- **WHEN** se pide el preview con exactamente los criterios de un perfil ya guardado
- **THEN** el cuerpo devuelto es igual al de `GET /api/curated-profiles/{slug}` para ese perfil y locale

#### Scenario: Overrides
- **WHEN** el borrador tiene `filterTags: ["java"]`, `excludeIds: [<id de una experiencia java>]` e `includeIds: [<id de una experiencia no java>]`
- **THEN** la experiencia excluida no aparece y la incluida sí

### Requirement: Visibilidad y token no aplican al preview
El preview SHALL resolver el borrador independientemente de su `visibility`: un borrador `PRIVATE` o `PROTECTED` MUST devolver 200 sin exigir token de acceso, porque el llamador ya está autenticado como administrador.

#### Scenario: Borrador protegido
- **WHEN** se pide el preview de un borrador con `visibility: "PROTECTED"` y sin `X-Access-Token`
- **THEN** responde 200 con el perfil resuelto

#### Scenario: Sin sesión
- **WHEN** se pide el preview sin cookie de sesión ni header `Authorization`
- **THEN** responde 401

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

### Requirement: Faltantes de traducción en los idiomas del perfil
El informe de faltantes del preview SHALL revisar cada idioma del perfil base como entidad `language`, con su id, en los campos `nameI18n`, `level` y `detail`, con la misma regla de faltante que el resto. Un valor guardado como texto plano MUST NOT reportarse. El aviso del constructor SHALL agruparlos bajo *Idiomas* y nombrar cada idioma por su nombre en español; solo si la lista de idiomas no cargó, por su id.

#### Scenario: Nivel sin inglés
- **WHEN** se previsualiza en EN un perfil cuyo idioma `Inglés` tiene `level: { es: "Intermedio" }`
- **THEN** el informe incluye `{ entity: "language", id: <id de Inglés>, field: "level" }` y el aviso muestra *Idiomas — Inglés: Nivel*

#### Scenario: Idiomas completos
- **WHEN** se previsualiza en EN un perfil tras el seed
- **THEN** el informe no incluye ninguna entrada de entidad `language`

#### Scenario: Nivel legado
- **WHEN** un idioma tiene `level` guardado como el string `"C1"` y se previsualiza en EN
- **THEN** el informe no lo marca como faltante

#### Scenario: Detalle sin inglés
- **WHEN** se previsualiza en EN un perfil con un idioma cuyo `detail` es `{ es: "Oral y escrito" }`
- **THEN** el informe incluye ese idioma con el campo `detail`
