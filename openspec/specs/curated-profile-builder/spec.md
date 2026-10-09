# curated-profile-builder Specification

## Purpose
El corazón del producto en modo edición: armar la vista que verá una empresa concreta, viendo en vivo qué entra y qué queda fuera antes de compartir el link.

## Requirements

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

### Requirement: Duplicar desde la lista de perfiles
La lista de `/admin/perfiles` SHALL ofrecer una acción **Duplicar** por perfil que, al confirmarse, crea la copia y abre el constructor sobre ella. La lista SHALL mostrar el estado de cada perfil —visibilidad, si está archivado y si está enumerado— de forma que se distinga un perfil publicado de un duplicado a medio configurar.

#### Scenario: Duplicar y seguir editando
- **WHEN** se usa Duplicar sobre un perfil
- **THEN** se crea la copia y el constructor se abre con su configuración, su slug derivado y su visibilidad `PRIVATE`

#### Scenario: Los duplicados se distinguen en la lista
- **WHEN** la lista contiene un perfil publicado y un duplicado
- **THEN** el duplicado se muestra como privado y no enumerado

### Requirement: Controles de ciclo de vida en la pestaña Publicación
La pestaña Publicación SHALL permitir archivar y desarchivar, y conmutar `listed`, y SHALL explicar en una línea el efecto de cada uno, distinguiéndolos de la visibilidad: la visibilidad decide **quién puede abrir** el perfil, `listed` decide **si se enumera**, y archivar decide **si sigue vivo**. Al archivar SHALL pedirse confirmación, indicando que el link deja de funcionar y que las visitas se conservan.

#### Scenario: Archivar desde el panel
- **WHEN** se archiva un perfil desde la pestaña Publicación y se confirma
- **THEN** el perfil queda archivado y el panel lo refleja sin recargar

#### Scenario: Los tres ejes se explican por separado
- **WHEN** se abre la pestaña Publicación
- **THEN** visibilidad, enumeración y archivado se presentan como controles distintos, cada uno con su explicación

#### Scenario: El link copiado advierte el estado
- **WHEN** el perfil está archivado o es `PRIVATE`
- **THEN** el bloque del link público advierte que ese link no resuelve

### Requirement: Aviso de faltantes antes de copiar el link
La pestaña Publicación SHALL mostrar el informe de faltantes de traducción del preview: el conteo y la lista agrupada por entidad, junto al link que se va a copiar. El aviso SHALL ser informativo y MUST NOT impedir guardar ni publicar: hay perfiles que solo se envían en español.

Cuando no hay faltantes en el idioma del preview, el aviso SHALL indicarlo en una línea en lugar de desaparecer, para que la ausencia de aviso no se confunda con "no se comprobó".

#### Scenario: Perfil con faltantes en inglés
- **WHEN** el preview está en EN y tres experiencias no tienen logros en inglés
- **THEN** la pestaña Publicación muestra el conteo y las tres entradas, y el botón de guardar sigue habilitado

#### Scenario: Perfil completo
- **WHEN** el preview está en EN y no falta nada
- **THEN** la pestaña Publicación lo indica explícitamente

#### Scenario: El aviso sigue al idioma del preview
- **WHEN** se conmuta el preview de EN a ES en un perfil con el español completo
- **THEN** el aviso pasa a indicar que no faltan traducciones

#### Scenario: Publicar con faltantes
- **WHEN** se publica un perfil que tiene faltantes en inglés
- **THEN** la operación se completa con normalidad

### Requirement: Aviso antes de descartar un borrador sin guardar
Mientras el cuerpo que enviaría *Guardar* difiere del último guardado, la ficha SHALL pedir confirmación antes de salir: un diálogo del panel al navegar a otra ruta (enlace, *Volver*, menú lateral, *Atrás*) y el aviso nativo del navegador al recargar o cerrar la pestaña. Un guardado exitoso SHALL dejar la ficha limpia. El idioma del preview y el archivado MUST NOT contar como cambios.

#### Scenario: Volver con cambios
- **WHEN** se edita el título de un perfil y se pulsa *Volver*
- **THEN** aparece el diálogo de cambios sin guardar y la ruta sigue siendo la de la ficha

#### Scenario: Seguir editando
- **WHEN** en ese diálogo se elige *Seguir editando*
- **THEN** el diálogo se cierra, la ruta no cambia y el borrador conserva el título editado

#### Scenario: Salir sin guardar
- **WHEN** en ese diálogo se elige *Salir sin guardar*
- **THEN** se navega a `/admin/perfiles` y el perfil no se modificó

#### Scenario: Cerrar o recargar la pestaña
- **WHEN** hay cambios sin guardar y se dispara `beforeunload`
- **THEN** el evento queda cancelado (`defaultPrevented`), lo que hace que el navegador pida confirmación

#### Scenario: Sin cambios no hay aviso
- **WHEN** se abre un perfil, se cambia un campo y se lo vuelve a su valor original, y se pulsa *Volver*
- **THEN** se navega sin diálogo y `beforeunload` no queda cancelado

#### Scenario: Guardar limpia la ficha
- **WHEN** se guarda con éxito y después se navega a otra sección del panel
- **THEN** no aparece el diálogo

#### Scenario: Crear un perfil no se bloquea a sí mismo
- **WHEN** se guarda con éxito un perfil nuevo
- **THEN** la ficha pasa a `/admin/perfiles/{id}` sin diálogo

#### Scenario: Un guardado fallido sigue sucio
- **WHEN** el guardado responde 409 por slug duplicado y se pulsa *Volver*
- **THEN** aparece el diálogo de cambios sin guardar

#### Scenario: Estado de vista no ensucia
- **WHEN** solo se cambia el idioma del preview o se archiva el perfil, y se pulsa *Volver*
- **THEN** se navega sin diálogo

### Requirement: El fin de la sesión no se bloquea
La navegación a `/admin/login` (cierre de sesión o sesión vencida) MUST NOT pedir confirmación aunque haya cambios sin guardar: sin sesión el borrador ya no puede guardarse.

#### Scenario: Cerrar sesión con cambios
- **WHEN** hay cambios sin guardar y se cierra la sesión
- **THEN** se llega a `/admin/login` sin diálogo
