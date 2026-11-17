## MODIFIED Requirements

### Requirement: Manual del backoffice por pantalla
El manual SHALL recorrer cada pantalla del panel: login, dashboard, portada con idiomas, experiencias, skills, formación, proyectos y enlaces, perfiles, el constructor con sus cuatro pestañas, la vista previa, la cuenta, las postulaciones, la revisión del CV y las integraciones. Cada campo SHALL tener su etiqueta visible, tipo, obligatoriedad, validación y un ejemplo del archivo de ejemplo, según el código vigente del panel y de la API.

#### Scenario: Campo con validación
- **WHEN** se lee la fila de *Plataforma* en la pantalla Proyectos y enlaces
- **THEN** dice que es obligatoria, que admite solo minúsculas, dígitos y guiones, y da `github` como ejemplo

#### Scenario: Override fuera del constructor
- **WHEN** se lee la pestaña Selección
- **THEN** aclara que incluir y excluir en el panel cubre solo experiencias, y que skills y proyectos se editan por la API

#### Scenario: Pantalla Cuenta
- **WHEN** se lee la pantalla Cuenta
- **THEN** describe los tres campos de contraseña con su regla, cita sus mensajes literales y aclara que el cambio cierra las sesiones de otros dispositivos y que `admin:bootstrap` es la vía de recuperación

#### Scenario: Pantalla Postulaciones
- **WHEN** se lee la pantalla Postulaciones
- **THEN** describe cada campo del diálogo con su regla y sus mensajes literales, la tabla de transiciones de estado, qué significa «Abierto el…», el aviso de no guardar datos de contacto y cómo abrir el CSV en una planilla

#### Scenario: Pantalla Revisión
- **WHEN** se lee la pantalla Revisión
- **THEN** explica las tres severidades, que `yearsOfExperience` se carga a mano y la revisión solo avisa si contradice las fechas, que nada se corrige solo y que `npm run cv:lint` corre las mismas reglas sobre el archivo del seed

#### Scenario: Pantalla Integraciones
- **WHEN** se lee la pantalla Integraciones
- **THEN** explica que **Sincronizar ahora** solo encola y el trabajo corre en el próximo minuto, qué significa cada estado y el aviso de más de 48 h, que la credencial nunca se vuelve a mostrar y que el scheduler y los proveedores se encienden con variables del servidor
