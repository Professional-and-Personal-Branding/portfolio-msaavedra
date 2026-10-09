# admin-content-management Specification (delta)

## ADDED Requirements

### Requirement: La Portada avisa antes de descartar cambios sin guardar
Mientras el formulario de la Portada muestra "Cambios sin guardar", la página SHALL pedir confirmación antes de salir, con el mismo diálogo y el mismo aviso nativo que el constructor de perfiles curados. Cambiar solo la query de la URL (el `?lang=` de la vista previa) MUST NOT contar como salir. Un guardado exitoso SHALL dejar la página limpia.

#### Scenario: Ir a otra sección con cambios
- **WHEN** se edita el titular de la Portada y se elige *Experiencias* en el menú lateral
- **THEN** aparece el diálogo de cambios sin guardar y la ruta sigue siendo `/admin/portada`

#### Scenario: Cambiar el idioma de la vista previa
- **WHEN** hay cambios sin guardar y se cambia el idioma de la vista previa
- **THEN** no aparece el diálogo, la URL cambia su `?lang=` y el borrador se conserva

#### Scenario: Recargar con cambios
- **WHEN** hay cambios sin guardar y se dispara `beforeunload`
- **THEN** el evento queda cancelado (`defaultPrevented`)

#### Scenario: Guardar limpia la página
- **WHEN** se guarda con éxito y se navega a otra sección
- **THEN** no aparece el diálogo

### Requirement: Los formularios en diálogo avisan antes de descartar cambios
Los formularios en diálogo del panel (experiencia, categoría, skill, formación, certificación, proyecto, enlace social e idioma) SHALL pedir confirmación, con *Seguir editando* y *Descartar*, al intentar cerrarlos con cambios sin guardar por *Cancelar*, *Escape*, un clic fuera o la X. Sin cambios MUST cerrarse directo. El cierre que sigue a un guardado exitoso MUST NOT pedir confirmación. Con el diálogo abierto y con cambios, recargar SHALL disparar el aviso nativo.

#### Scenario: Escape con cambios
- **WHEN** se edita la empresa de una experiencia y se pulsa *Escape*
- **THEN** aparece el aviso de cambios sin guardar y el formulario sigue abierto con la empresa editada

#### Scenario: Clic fuera o la X con cambios
- **WHEN** se edita el nombre de una skill y se hace clic fuera del diálogo, o en la X
- **THEN** aparece el aviso y el formulario sigue abierto

#### Scenario: Cancelar con cambios
- **WHEN** se edita el nivel de un idioma y se pulsa *Cancelar*
- **THEN** aparece el aviso y el formulario sigue abierto

#### Scenario: Seguir editando
- **WHEN** en el aviso se elige *Seguir editando*
- **THEN** el aviso se cierra y el formulario sigue abierto con los valores editados

#### Scenario: Descartar
- **WHEN** en el aviso se elige *Descartar*
- **THEN** el formulario se cierra, no se envió ninguna petición de guardado y al reabrir la ficha muestra los valores guardados

#### Scenario: Sin cambios cierra directo
- **WHEN** se abre la edición de una certificación y se pulsa *Cancelar*, *Escape* o la X sin tocar nada
- **THEN** el formulario se cierra sin aviso

#### Scenario: Guardar cierra sin aviso
- **WHEN** se guarda con éxito un proyecto editado
- **THEN** el formulario se cierra sin aviso

#### Scenario: Un guardado fallido sigue con cambios
- **WHEN** guardar un enlace social responde 400 y se pulsa *Escape*
- **THEN** aparece el aviso de cambios sin guardar

#### Scenario: Recargar con un formulario abierto
- **WHEN** un formulario en diálogo tiene cambios y se dispara `beforeunload`
- **THEN** el evento queda cancelado (`defaultPrevented`); con el formulario cerrado o sin cambios, no

### Requirement: Qué cuenta como cambio en un formulario en diálogo
Un formulario en diálogo SHALL tener cambios cuando el cuerpo que enviaría *Guardar* difiere del que resulta de sus valores al abrirse (los de la ficha, o los vacíos en un alta). Lo que el guardado recorta (espacios al borde) MUST NOT contar. En un enlace social, el texto de `stats` SHALL compararse recortado, porque un JSON inválido no llega al cuerpo. Lo escrito en un campo de chips sin agregarlo MUST NOT contar.

#### Scenario: Volver al valor original
- **WHEN** se cambia el título de una formación y se lo vuelve a escribir igual que estaba, y se pulsa *Escape*
- **THEN** el formulario se cierra sin aviso

#### Scenario: Espacios al borde
- **WHEN** solo se agrega un espacio al final del nombre de un proyecto y se pulsa *Cancelar*
- **THEN** el formulario se cierra sin aviso

#### Scenario: Alta sin tocar nada
- **WHEN** se abre *Nueva categoría* y se cierra sin escribir
- **THEN** el formulario se cierra sin aviso

#### Scenario: Estadísticas inválidas
- **WHEN** en un enlace social sin estadísticas se escribe un JSON inválido en `stats` y se pulsa *Escape*
- **THEN** aparece el aviso de cambios sin guardar
