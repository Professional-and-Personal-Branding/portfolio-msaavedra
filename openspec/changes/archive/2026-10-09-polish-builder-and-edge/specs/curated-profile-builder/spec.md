# curated-profile-builder Specification (delta)

## ADDED Requirements

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

### Requirement: El constructor no envía `accentColor`
El cuerpo que el constructor envía al crear, al guardar y al pedir el preview MUST NOT incluir `accentColor`, y ninguna pestaña lo edita. Al guardar un perfil existente, el valor almacenado SHALL conservarse; en un alta SHALL tomar el default del API.

#### Scenario: Guardar no envía el color
- **WHEN** se edita el título de un perfil con `accentColor` `#5B2C87` y se guarda
- **THEN** el cuerpo del `PATCH` no tiene la clave `accentColor` y el perfil sigue teniendo `#5B2C87`

#### Scenario: Alta sin color
- **WHEN** se crea un perfil nuevo desde el constructor
- **THEN** el cuerpo del `POST` no tiene la clave `accentColor` y el perfil creado tiene `#1A365D`

#### Scenario: Preview sin color
- **WHEN** el constructor pide el preview de un borrador
- **THEN** el cuerpo de `POST /api/admin/curated-profiles/preview` no tiene la clave `accentColor`
