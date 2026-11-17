## ADDED Requirements

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
