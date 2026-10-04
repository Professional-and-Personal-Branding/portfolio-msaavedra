# curated-profile-builder Specification (delta)

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: El menú de perfiles solo en la home
La vista pública SHALL montar el menú de otros perfiles **únicamente** en la home (`/`). En `/:slug` MUST NOT renderizarse ningún enlace a otro slug de perfil curado, cualquiera sea el valor de `listed` de los demás.

#### Scenario: Un perfil enviado no enumera a los demás
- **WHEN** se abre `/tech-lead-dotnet`
- **THEN** el DOM no contiene ningún enlace a otro slug de perfil curado

#### Scenario: La home sí ofrece el menú
- **WHEN** se abre `/`
- **THEN** el menú lista los perfiles públicos, enumerados y no archivados, agrupados por `roleType`
