## MODIFIED Requirements

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

## ADDED Requirements

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
