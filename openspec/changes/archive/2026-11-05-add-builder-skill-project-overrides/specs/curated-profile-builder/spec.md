## MODIFIED Requirements

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

## ADDED Requirements

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
Las experiencias y los proyectos ocultos SHALL listarse marcados como ocultos, con Incluir deshabilitado salvo para quitar una inclusión existente y Excluir habilitado. Los ids de `includeIds`/`excludeIds` sin ítem en las listas MUST conservarse al guardar; con las tres listas cargadas, la pestaña SHALL contarlos y ofrecer quitarlos del borrador.

#### Scenario: Proyecto oculto
- **WHEN** la lista de proyectos contiene uno con `visible: false` que no está incluido
- **THEN** se muestra con la insignia de oculto y su botón Incluir está deshabilitado con el motivo

#### Scenario: Quitar la inclusión de una experiencia oculta
- **WHEN** una experiencia oculta ya figura en `includeIds`
- **THEN** su botón Incluir está habilitado y presionado, y al pulsarlo el id sale de `includeIds`

#### Scenario: Referencias huérfanas
- **WHEN** el perfil guardado tiene en `excludeIds` un id que no corresponde a ninguna experiencia, skill ni proyecto
- **THEN** la pestaña indica una referencia a un ítem que ya no existe y abrir la ficha no la marca con cambios sin guardar

#### Scenario: Quitar las referencias huérfanas
- **WHEN** se pulsa Quitar en el aviso de referencias huérfanas y se guarda
- **THEN** el `PATCH` lleva `includeIds` y `excludeIds` sin esos ids y conserva los demás

#### Scenario: Una lista no cargó
- **WHEN** la lista de proyectos responde con error
- **THEN** el bloque de proyectos muestra el error con reintento, no se informan referencias huérfanas y guardar no altera los ids existentes
