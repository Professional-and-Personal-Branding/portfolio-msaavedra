# admin-content-management Specification

## Purpose
Editar el contenido del portafolio sin tocar la base ni `curl`: experiencias y skills, con sus textos en los dos idiomas y feedback claro de cada operación.

## Requirements

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

### Requirement: Administración del perfil base
`GET /api/admin/profile` SHALL devolver el perfil base con sus campos bilingües **crudos** (sin resolver locale), y `PUT /api/admin/profile` SHALL reemplazarlo por completo. Ninguna de las dos rutas SHALL recibir un id: `Profile` es un singleton.

#### Scenario: Editar el titular y verlo en el sitio
- **WHEN** se hace `PUT /api/admin/profile` cambiando `headline` y se abre la home
- **THEN** el hero muestra el titular nuevo sin haber corrido `seed`

#### Scenario: Campos bilingües crudos
- **WHEN** se hace `GET /api/admin/profile`
- **THEN** `headline` y `summary` llegan como objetos `{ es, en }`, no como string resuelto

#### Scenario: La disponibilidad llega al hero
- **WHEN** se cambia la fecha de inicio de disponibilidad y se abre un perfil curado
- **THEN** el badge del hero refleja el valor nuevo en el idioma activo

### Requirement: Validación del reemplazo del perfil base
El DTO del `PUT` SHALL exigir `fullName`, `headline`, `summary`, `email` y `location`, y SHALL aceptar `phone`, `timezone`, `yearsOfExperience` y los tres campos de disponibilidad (modalidad, tipo de contrato, fecha de inicio) como opcionales. Un payload con campos desconocidos MUST responder 400, nunca ignorarlos en silencio ni borrar lo que no se mandó por omisión no declarada.

#### Scenario: Payload con campo desconocido
- **WHEN** se hace `PUT` con una propiedad que no está en el DTO
- **THEN** responde 400 y el perfil queda sin cambios

#### Scenario: Obligatorio vacío
- **WHEN** se hace `PUT` con `email` vacío
- **THEN** responde 400 y el perfil conserva su email anterior

### Requirement: Administración de idiomas, enlaces sociales, formación y proyectos
El backoffice SHALL exponer el juego completo de administración para `Language`, `SocialLink`, `Education`, `Certification` y `Project`, siguiendo el mismo contrato que experiencias: listado crudo que **incluye los no visibles**, creación, detalle, edición parcial y borrado, todos autenticados y con validación de whitelist.

El listado crudo MUST devolver los campos bilingües sin resolver y MUST incluir `visible` y `order`, para que el panel pueda administrarlos.

#### Scenario: Crear un proyecto con su enlace
- **WHEN** se crea un `Project` con `url` y se abre un perfil curado cuyos `filterTags` intersectan sus tags
- **THEN** el proyecto aparece en la sección de proyectos con su enlace

#### Scenario: Ocultar sin borrar
- **WHEN** una certificación se marca `visible: false`
- **THEN** desaparece de la vista pública y sigue apareciendo en el listado del panel

#### Scenario: Listado crudo incluye ocultos
- **WHEN** se pide `GET /api/admin/education` con una formación oculta
- **THEN** figura en la respuesta con `visible: false`

#### Scenario: Borrado con confirmación
- **WHEN** se borra un enlace social desde el panel
- **THEN** se pide confirmación y, al aceptar, desaparece de la vista pública

#### Scenario: Campos desconocidos rechazados
- **WHEN** se hace `POST` de cualquiera de las cinco entidades con un campo fuera del DTO
- **THEN** responde 400

### Requirement: El panel agrupa el contenido por frecuencia de cambio
El backoffice SHALL ofrecer `/admin/portada` (perfil base, contacto, disponibilidad e idiomas), `/admin/formacion` (educación y certificaciones) y `/admin/proyectos` (proyectos y enlaces sociales). La página de portada SHALL mostrar una vista previa del hero resuelta por el backend antes de guardar.

#### Scenario: Previsualizar antes de guardar
- **WHEN** se edita el titular en `/admin/portada` sin guardar
- **THEN** la vista previa del hero muestra el texto nuevo y el perfil publicado sigue con el anterior

#### Scenario: Navegación completa
- **WHEN** se abre el panel
- **THEN** la navegación ofrece Dashboard, Portada, Experiencias, Skills, Formación, Proyectos y Perfiles curados

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
