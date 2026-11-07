## MODIFIED Requirements

### Requirement: Manual del backoffice por pantalla
El manual SHALL recorrer cada pantalla del panel: login, dashboard, portada con idiomas, experiencias, skills, formación, proyectos y enlaces, perfiles, el constructor con sus cuatro pestañas, la vista previa y la cuenta. Cada campo SHALL tener su etiqueta visible, tipo, obligatoriedad, validación y un ejemplo del archivo de ejemplo, según el código vigente del panel y de la API.

#### Scenario: Campo con validación
- **WHEN** se lee la fila de *Plataforma* en la pantalla Proyectos y enlaces
- **THEN** dice que es obligatoria, que admite solo minúsculas, dígitos y guiones, y da `github` como ejemplo

#### Scenario: Override fuera del constructor
- **WHEN** se lee la pestaña Selección
- **THEN** aclara que incluir y excluir en el panel cubre solo experiencias, y que skills y proyectos se editan por la API

#### Scenario: Pantalla Cuenta
- **WHEN** se lee la pantalla Cuenta
- **THEN** describe los tres campos de contraseña con su regla, cita sus mensajes literales y aclara que el cambio cierra las sesiones de otros dispositivos y que `admin:bootstrap` es la vía de recuperación
