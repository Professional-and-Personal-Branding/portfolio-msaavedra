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
La ficha SHALL permitir editar `filterTags`, `includeIds` y `excludeIds`. Los tags SHALL ofrecerse desde el universo real de tags de los datos (experiencias, skills y proyectos). Las inclusiones y exclusiones SHALL elegirse desde las listas de experiencias, skills y proyectos, nunca escribiendo ids a mano. Incluir un ítem MUST quitarlo de `excludeIds` y excluirlo MUST quitarlo de `includeIds`; un id presente en ambos SHALL mostrarse como excluido.

#### Scenario: Elegir tags
- **WHEN** se abre el selector de tags
- **THEN** se ofrecen los tags existentes en los datos y se pueden agregar o quitar del perfil

#### Scenario: Tags de proyectos en el universo
- **WHEN** un proyecto tiene un tag que ninguna experiencia ni skill usa
- **THEN** ese tag aparece entre los tags disponibles de la pestaña Selección

#### Scenario: Excluir una experiencia
- **WHEN** se marca una experiencia como excluida
- **THEN** su id se agrega a `excludeIds` y la experiencia desaparece del preview

#### Scenario: Sin tags
- **WHEN** `filterTags` queda vacío
- **THEN** el preview muestra todas las experiencias visibles (regla de `filterTags` vacío = todo)

#### Scenario: Incluir quita la exclusión
- **WHEN** un ítem está excluido y se pulsa su botón Incluir
- **THEN** su id queda en `includeIds`, sale de `excludeIds` y Excluir deja de estar presionado

#### Scenario: Id en los dos arreglos
- **WHEN** el perfil guardado trae el mismo id en `includeIds` y en `excludeIds`
- **THEN** la fila del ítem muestra Excluir presionado e indica que la exclusión gana

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

### Requirement: Enlaces de seguimiento en la pestaña Publicación
Para un perfil guardado, Publicación SHALL listar sus enlaces (etiqueta editable, portal, aperturas, última apertura y estado), crear uno con etiqueta y portal opcional, copiar su URL absoluta con `?via=` (después de `token` si es `PROTECTED`) y revocarlo tras una confirmación que diga que el link sigue abriendo y no se deshace. SHALL ofrecer copiar `/{slug}?src=<portal>` sin llamar a la API.

#### Scenario: Crear y copiar
- **WHEN** en un perfil `PUBLIC` guardado se crea el enlace «Acme — RR. HH.» y se pulsa copiar
- **THEN** el enlace aparece con 0 aperturas y el portapapeles queda con la URL absoluta del perfil con `?via=<código>`

#### Scenario: Perfil protegido
- **WHEN** el perfil es `PROTECTED` con token `abc` y se copia un enlace
- **THEN** la URL copiada contiene `token=abc` y `via=<código>`

#### Scenario: Revocar
- **WHEN** se revoca un enlace y se confirma
- **THEN** el enlace queda marcado como revocado, sin acción de copiar, y sus aperturas siguen visibles

#### Scenario: Perfil sin guardar
- **WHEN** se abre Publicación en un perfil nuevo sin guardar
- **THEN** el bloque de enlaces indica que hay que guardar primero y no llama a la API

#### Scenario: Link genérico por portal
- **WHEN** se elige el portal `indeed` y se pulsa copiar
- **THEN** el portapapeles queda con la URL absoluta del perfil con `?src=indeed` y no se crea ningún enlace

### Requirement: Compartir en LinkedIn desde la pestaña Publicación
Publicación SHALL ofrecer **Compartir en LinkedIn** solo para un perfil guardado, `PUBLIC` y no archivado; si no, deshabilitado con el motivo. Al pulsarlo SHALL abrir en una pestaña nueva `https://www.linkedin.com/sharing/share-offsite/?url=` con la URL del perfil y el `via` del enlace `LINKEDIN_POST` que devuelve la API, y si la API falla SHALL cerrarla y mostrar el error.

#### Scenario: Compartir un perfil público
- **WHEN** se pulsa Compartir en LinkedIn en un perfil `PUBLIC` guardado
- **THEN** se abre una pestaña con `share-offsite` cuyo `url` es la URL absoluta del perfil con `?via=<código del enlace LinkedIn>`

#### Scenario: Perfil protegido
- **WHEN** el perfil es `PROTECTED`
- **THEN** el botón está deshabilitado y explica que publicaría el token

#### Scenario: Falla la API
- **WHEN** la API responde con error al pedir el enlace
- **THEN** la pestaña nueva se cierra y se muestra el error

### Requirement: Selección de skills y proyectos en el constructor
La pestaña Selección SHALL ofrecer Incluir y Excluir para cada skill, agrupadas por categoría en su orden y con un buscador por nombre, y para cada proyecto. SHALL escribir solo ids de skills y proyectos en los mismos `includeIds`/`excludeIds`, nunca ids de categoría. El buscador MUST NOT cambiar el borrador ni el preview. Cada categoría SHALL indicar cuántas de sus skills están incluidas o excluidas.

#### Scenario: Excluir una skill
- **WHEN** en un perfil con `filterTags: ["java"]` se excluye la skill Kotlin, que matchea por tag
- **THEN** el id de Kotlin queda en `excludeIds` y el preview muestra su categoría sin Kotlin

#### Scenario: Incluir una skill sin tags comunes
- **WHEN** se incluye React en un perfil cuyos tags no coinciden con ninguna skill de Frontend
- **THEN** el id de React queda en `includeIds` y el preview muestra la categoría Frontend con esa sola skill

#### Scenario: Excluir la última skill de una categoría
- **WHEN** se excluye la única skill que una categoría aporta al perfil
- **THEN** la categoría desaparece del preview

#### Scenario: Buscar una skill
- **WHEN** se escribe `kot` en el buscador de skills
- **THEN** solo se lista Kotlin dentro de su categoría, las demás categorías se ocultan y no se pide un preview nuevo

#### Scenario: Búsqueda sin resultados
- **WHEN** se escribe un texto que no coincide con ninguna skill
- **THEN** se indica que ninguna skill coincide y el borrador no cambia

#### Scenario: La búsqueda no ensucia la ficha
- **WHEN** solo se escribe en el buscador y se pulsa *Volver*
- **THEN** se navega sin el diálogo de cambios sin guardar

#### Scenario: Incluir un proyecto
- **WHEN** se incluye un proyecto visible que no comparte tags con el perfil
- **THEN** su id queda en `includeIds` y el preview lo muestra en la sección de proyectos

#### Scenario: Excluir un proyecto
- **WHEN** se excluye un proyecto que matchea por tag
- **THEN** su id queda en `excludeIds` y desaparece del preview

#### Scenario: Overrides guardados por seed o API
- **WHEN** se abre `ejemplo-overrides`, que trae Kotlin excluida y un proyecto incluido desde el seed
- **THEN** Kotlin muestra Excluir presionado, el proyecto muestra Incluir presionado y su categoría indica una skill excluida

### Requirement: Ítems ocultos y referencias huérfanas en la selección
Las experiencias, los proyectos y los repositorios ocultos SHALL listarse marcados como ocultos, con Incluir deshabilitado salvo para quitar una inclusión existente y Excluir habilitado. Los ids de `includeIds`/`excludeIds` sin ítem en las listas MUST conservarse al guardar; con las cuatro listas cargadas (experiencias, skills, proyectos y repositorios), la pestaña SHALL contarlos y ofrecer quitarlos del borrador.

#### Scenario: Proyecto oculto
- **WHEN** la lista de proyectos contiene uno con `visible: false` que no está incluido
- **THEN** se muestra con la insignia de oculto y su botón Incluir está deshabilitado con el motivo

#### Scenario: Quitar la inclusión de una experiencia oculta
- **WHEN** una experiencia oculta ya figura en `includeIds`
- **THEN** su botón Incluir está habilitado y presionado, y al pulsarlo el id sale de `includeIds`

#### Scenario: Referencias huérfanas
- **WHEN** el perfil guardado tiene en `excludeIds` un id que no corresponde a ninguna experiencia, skill, proyecto ni repositorio
- **THEN** la pestaña indica una referencia a un ítem que ya no existe y abrir la ficha no la marca con cambios sin guardar

#### Scenario: Quitar las referencias huérfanas
- **WHEN** se pulsa Quitar en el aviso de referencias huérfanas y se guarda
- **THEN** el `PATCH` lleva `includeIds` y `excludeIds` sin esos ids y conserva los demás

#### Scenario: Una lista no cargó
- **WHEN** la lista de proyectos responde con error
- **THEN** el bloque de proyectos muestra el error con reintento, no se informan referencias huérfanas y guardar no altera los ids existentes

#### Scenario: Un repositorio incluido no es huérfano
- **WHEN** el perfil guardado tiene en `includeIds` el id de un repositorio existente
- **THEN** la pestaña no lo cuenta como referencia huérfana

### Requirement: Contadores del preview en singular y plural
Los contadores del preview (experiencias, categorías de skills y proyectos) SHALL concordar en número con la cantidad: singular para 1 y plural para cualquier otra cantidad, incluido 0. Los contadores son parte del panel y SHALL seguir en español aunque el preview muestre el contenido en inglés.

#### Scenario: Un elemento de cada tipo
- **WHEN** el preview resuelve 1 experiencia, 1 categoría y 1 proyecto
- **THEN** el contador dice «1 experiencia · 1 categoría · 1 proyecto»

#### Scenario: Cero y varios
- **WHEN** el preview resuelve 2 experiencias, 3 categorías y 0 proyectos
- **THEN** el contador dice «2 experiencias · 3 categorías · 0 proyectos»

#### Scenario: Preview en inglés
- **WHEN** el preview muestra la pestaña EN y resuelve 1 proyecto
- **THEN** el contador sigue en español y dice «1 proyecto»

### Requirement: Descarga del JSON Resume en la pestaña Publicación
La pestaña **Publicación** SHALL ofrecer, junto a «Link público», «Descargar JSON Resume» con un enlace **ES** y otro **EN** a la exportación del panel por id. En un perfil sin guardar los enlaces MUST estar deshabilitados con «Guardá el perfil para exportarlo»; con cambios sin guardar SHALL verse «Se exporta la última versión guardada». La vista pública MUST NOT sumar un enlace de descarga.

#### Scenario: Perfil guardado
- **WHEN** el owner abre **Publicación** de un perfil guardado y pulsa **EN**
- **THEN** el navegador descarga `<slug>.en.resume.json` desde `/api/admin/curated-profiles/<id>/resume.json?locale=en`

#### Scenario: Perfil privado
- **WHEN** el perfil es `PRIVATE` y el owner pulsa **ES**
- **THEN** la descarga funciona igual, sin token en la URL

#### Scenario: Perfil nuevo
- **WHEN** el owner crea un perfil y todavía no lo guardó
- **THEN** los dos enlaces están deshabilitados y se ve «Guardá el perfil para exportarlo»

#### Scenario: Cambios sin guardar
- **WHEN** el owner edita el título sin guardar
- **THEN** se ve «Se exporta la última versión guardada» debajo de los enlaces

#### Scenario: Vista pública sin cambios
- **WHEN** se carga la vista pública de cualquier perfil
- **THEN** no hay enlace a `resume.json` y `npm run perf:budget` no cambia de tamaño por este change

### Requirement: Selección de repositorios en el constructor
La pestaña Selección SHALL ofrecer Incluir y Excluir para cada repositorio, mutuamente excluyentes, en los mismos `includeIds`/`excludeIds`. Si el preview trae exactamente 1 repositorio y `sections` no tiene `repositories`, SHALL avisar que la sección se muestra desde 2. El aviso de faltantes SHALL incluir la `description` de cada repositorio seleccionado.

#### Scenario: Incluir un repositorio
- **WHEN** se incluye un repositorio visible que no comparte tags con el perfil
- **THEN** su id queda en `includeIds` y el preview lo cuenta en `repositories`

#### Scenario: Excluir un repositorio
- **WHEN** se pulsa Excluir en un repositorio que figura en `includeIds`
- **THEN** su id sale de `includeIds`, entra en `excludeIds` y deja de estar en el preview

#### Scenario: Aviso del umbral
- **WHEN** se abre `ejemplo-renombrado`, que resuelve 1 repositorio
- **THEN** el bloque Repositorios muestra «La sección Repositorios se muestra desde 2; este perfil resuelve 1»

#### Scenario: Faltante de traducción en un repositorio
- **WHEN** el preview está en EN y un repositorio seleccionado no tiene `description.en`
- **THEN** la pestaña Publicación lista ese repositorio entre los faltantes

### Requirement: Acceso a la creación desde una vacante
El encabezado de `/admin/perfiles` SHALL ofrecer, junto a **Nuevo perfil**, el botón **Desde una vacante**, que lleva a `/admin/perfiles/desde-vacante`. Esa pantalla SHALL mantener activo el ítem **Perfiles curados** de la navegación, que no suma ítems, y el borrador creado SHALL abrirse en la ficha de siempre.

#### Scenario: Botón en Perfiles curados
- **WHEN** el owner pulsa **Desde una vacante** en la lista de perfiles
- **THEN** llega a `/admin/perfiles/desde-vacante` y la navegación sigue marcando **Perfiles curados**

#### Scenario: El borrador se edita en el constructor
- **WHEN** el owner crea un borrador desde una vacante
- **THEN** se abre su ficha en `/admin/perfiles/{id}` con los `filterTags` elegidos y el preview correspondiente

#### Scenario: La navegación no crece
- **WHEN** se renderiza el panel
- **THEN** la barra de navegación tiene los mismos nueve ítems que antes del change
