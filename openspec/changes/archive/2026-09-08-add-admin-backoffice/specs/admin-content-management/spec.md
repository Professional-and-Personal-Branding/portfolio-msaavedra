## Purpose

Editar el contenido del portafolio sin tocar la base ni `curl`: experiencias y skills, con sus textos en los dos idiomas y feedback claro de cada operación.

## ADDED Requirements

### Requirement: Listado de experiencias
`/admin/experiencias` SHALL listar todas las experiencias de `GET /api/admin/experiences` (incluidas las ocultas) mostrando empresa, rol en español, período, orden, visibilidad y tags, en el orden canónico (`startDate` desc, `order` asc). Las ocultas SHALL distinguirse visualmente.

#### Scenario: Listado
- **WHEN** la API devuelve 15 experiencias, una de ellas con `visible: false`
- **THEN** se listan las 15 y la oculta aparece marcada como no visible

#### Scenario: Error de carga
- **WHEN** la API falla
- **THEN** se muestra un mensaje de error con acción de reintentar

### Requirement: Alta y edición de experiencias
El formulario SHALL permitir editar `company`, `role` (ES/EN), `startDate`, `endDate`, `current`, `location`, `summary` (ES/EN), `highlights` (lista, ES/EN), `technologies`, `tags`, `sector`, `order` y `visible`; SHALL validar en cliente los campos obligatorios (`company`, `role.es`, `startDate`, `location`, `summary.es`) antes de enviar, y guardar con `POST` o `PATCH` según corresponda. Marcar `current` SHALL vaciar y deshabilitar `endDate`.

#### Scenario: Crear
- **WHEN** se completa el formulario y se guarda
- **THEN** se envía `POST /api/admin/experiences` con el cuerpo bilingüe, se muestra un aviso de éxito y la nueva experiencia aparece en el listado

#### Scenario: Editar
- **WHEN** se abre una experiencia existente, se cambia el rol en inglés y se guarda
- **THEN** se envía `PATCH /api/admin/experiences/{id}` con el campo modificado y el listado refleja el cambio

#### Scenario: Validación
- **WHEN** se intenta guardar sin empresa y sin el rol en español
- **THEN** no se llama a la API y ambos campos muestran su mensaje de error

#### Scenario: Actual
- **WHEN** se marca `current`
- **THEN** `endDate` queda vacío y deshabilitado, y el cuerpo enviado lleva `endDate: null`

### Requirement: Borrado con confirmación
Borrar una experiencia, una categoría o una skill SHALL pedir confirmación explícita indicando qué se va a borrar, y solo entonces llamar al `DELETE`. Cancelar MUST NOT llamar a la API.

#### Scenario: Confirmar
- **WHEN** se pulsa borrar y se confirma
- **THEN** se llama a `DELETE /api/admin/experiences/{id}` y la fila desaparece del listado

#### Scenario: Cancelar
- **WHEN** se pulsa borrar y se cancela
- **THEN** no se llama a la API y la fila sigue en el listado

### Requirement: Gestión de skills por categoría
`/admin/skills` SHALL listar las categorías de `GET /api/admin/skill-categories` con sus skills, y permitir: crear y editar categorías (nombre ES/EN, orden), crear y editar skills dentro de una categoría (nombre, tags, orden) y borrar ambas. Borrar una categoría SHALL advertir que también borra sus skills.

#### Scenario: Crear skill
- **WHEN** se agrega una skill a una categoría
- **THEN** se llama a `POST /api/admin/skill-categories/{categoryId}/skills` y la skill aparece bajo esa categoría

#### Scenario: Editar skill
- **WHEN** se cambian los tags de una skill
- **THEN** se llama a `PATCH /api/admin/skills/{id}` y los nuevos tags se muestran

#### Scenario: Aviso al borrar una categoría
- **WHEN** se pide borrar una categoría con 4 skills
- **THEN** la confirmación advierte que se borrarán también sus 4 skills

### Requirement: Campos bilingües y listas
Los campos traducibles SHALL editarse con pestañas ES/EN sobre el mismo campo, siendo `es` obligatorio y `en` opcional; los campos de lista (`technologies`, `tags`, `sector`, `highlights`) SHALL editarse como elementos individuales que se agregan y se quitan, sin pedirle al usuario que escriba JSON ni separadores.

#### Scenario: Traducción opcional
- **WHEN** se guarda una experiencia con `summary.es` y sin `summary.en`
- **THEN** la petición se envía sin `en` y la vista pública en inglés cae al español

#### Scenario: Editar una lista
- **WHEN** se agrega la tecnología "Kafka" y se quita "jQuery"
- **THEN** el cuerpo enviado incluye "Kafka" y no incluye "jQuery"

### Requirement: Feedback de cada operación
Toda operación de escritura SHALL mostrar un aviso de éxito o de error y, al terminar con éxito, refrescar los datos afectados. Mientras la operación está en curso, el control que la disparó SHALL quedar deshabilitado.

#### Scenario: Error del servidor
- **WHEN** un `PATCH` responde 400 con un mensaje de validación
- **THEN** se muestra ese mensaje, el formulario conserva lo escrito y no se cierra
