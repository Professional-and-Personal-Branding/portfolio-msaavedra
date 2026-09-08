## Purpose

El corazón del producto en modo edición: armar la vista que verá una empresa concreta, viendo en vivo qué entra y qué queda fuera antes de compartir el link.

## ADDED Requirements

### Requirement: Listado y ficha de perfiles curados
`/admin/perfiles` SHALL listar los perfiles de `GET /api/admin/curated-profiles` con slug, título en español, tipo de rol, visibilidad y visitas, y permitir crear uno nuevo, abrir su ficha en `/admin/perfiles/{id}` y borrarlo con confirmación que advierta que también se borran sus visitas.

#### Scenario: Listado
- **WHEN** la API devuelve 14 perfiles
- **THEN** se listan los 14 con su slug, visibilidad y número de visitas

#### Scenario: Crear
- **WHEN** se pulsa "Nuevo perfil"
- **THEN** se abre la ficha en blanco con los valores por defecto (layout `classic`, visibilidad `PUBLIC`, secciones por defecto)

### Requirement: Edición de los criterios de selección
La ficha SHALL permitir editar `filterTags`, `includeIds` y `excludeIds`. Los tags SHALL ofrecerse desde el universo real de tags de los datos (experiencias, skills y proyectos), y las inclusiones y exclusiones SHALL elegirse desde la lista de experiencias identificadas por empresa y rol, nunca escribiendo ids a mano.

#### Scenario: Elegir tags
- **WHEN** se abre el selector de tags
- **THEN** se ofrecen los tags existentes en los datos y se pueden agregar o quitar del perfil

#### Scenario: Excluir una experiencia
- **WHEN** se marca una experiencia como excluida
- **THEN** su id se agrega a `excludeIds` y la experiencia desaparece del preview

#### Scenario: Sin tags
- **WHEN** `filterTags` queda vacío
- **THEN** el preview muestra todas las experiencias visibles (regla de `filterTags` vacío = todo)

### Requirement: Preview en vivo del resultado
La ficha SHALL mostrar un panel de preview alimentado por `POST /api/admin/curated-profiles/preview` con el borrador actual. Cambiar tags, inclusiones, exclusiones, tema, layout o secciones SHALL actualizar el preview sin guardar y sin recargar la página; las peticiones SHALL agruparse con un retardo corto para no disparar una por pulsación. El preview SHALL indicar cuántas experiencias, categorías de skills y proyectos resultan.

#### Scenario: Cambiar tags actualiza el preview
- **WHEN** se agrega el tag `dotnet` a un perfil sin tags
- **THEN** el preview pasa a mostrar solo las experiencias con ese tag y el contador refleja la nueva cantidad

#### Scenario: Sin guardar
- **WHEN** se cambian los tags y no se guarda
- **THEN** no se llama a `PATCH` ni a `POST /api/admin/curated-profiles`, y al recargar la ficha reaparecen los valores guardados

#### Scenario: Agrupación de peticiones
- **WHEN** se agregan tres tags seguidos en menos de medio segundo
- **THEN** se hace una sola petición de preview con el estado final

#### Scenario: Preview con el aspecto público
- **WHEN** el preview termina de cargar
- **THEN** el resultado se renderiza con los mismos componentes y el mismo layout que la vista pública

### Requirement: Tema, layout y secciones
La ficha SHALL permitir elegir el tema base del catálogo, el layout entre los disponibles (`classic`, `sidebar`), reordenar las secciones y marcar cuáles se ocultan. El orden y las ocultas SHALL guardarse en `sectionsOrder` y `sectionsHidden`.

#### Scenario: Reordenar
- **WHEN** se mueve `skills` por encima de `experience`
- **THEN** el preview muestra skills antes que experiencia y `sectionsOrder` refleja el nuevo orden al guardar

#### Scenario: Ocultar
- **WHEN** se marca `education` como oculta
- **THEN** el preview deja de mostrar esa sección y `sectionsHidden` la incluye

#### Scenario: Cambiar layout
- **WHEN** se elige el layout `sidebar`
- **THEN** el preview se reorganiza con la columna lateral

### Requirement: Visibilidad y token de acceso
La ficha SHALL permitir elegir `visibility` entre `PUBLIC`, `PRIVATE` y `PROTECTED`. Con `PROTECTED` SHALL exigir un `accessToken` no vacío antes de guardar y SHALL ofrecer copiar el link público con el token incluido. Al pasar a otra visibilidad, el token deja de exigirse.

#### Scenario: Protegido sin token
- **WHEN** se elige `PROTECTED` y se guarda sin token
- **THEN** no se llama a la API y el campo de token muestra que es obligatorio

#### Scenario: Link con token
- **WHEN** el perfil es `PROTECTED` y tiene token
- **THEN** el link ofrecido incluye `?token=<token>` y abre la vista pública sin pedirlo

### Requirement: Guardado y link público
Guardar SHALL enviar `POST` para un perfil nuevo o `PATCH` para uno existente, mostrar el resultado y dejar la ficha con los datos persistidos. La ficha de un perfil guardado SHALL mostrar su link público (`/{slug}`, o `/` para el perfil `all`) con acciones de copiar y abrir en una pestaña nueva.

#### Scenario: Guardar uno nuevo
- **WHEN** se guarda un perfil nuevo con slug `acme-backend`
- **THEN** se llama a `POST /api/admin/curated-profiles`, se avisa del éxito y la ficha muestra el link `/acme-backend`

#### Scenario: Slug duplicado
- **WHEN** la API responde 409 porque el slug ya existe
- **THEN** se muestra el error junto al campo slug y no se pierde el resto del formulario

#### Scenario: Copiar el link
- **WHEN** se pulsa copiar
- **THEN** el portapapeles queda con la URL absoluta del perfil y se avisa que se copió
