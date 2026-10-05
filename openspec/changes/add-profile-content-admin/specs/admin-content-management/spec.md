# admin-content-management Specification (delta)

## ADDED Requirements

### Requirement: Administración del perfil base
`GET /api/admin/profile` SHALL devolver el perfil base con sus campos bilingües **crudos** (sin resolver locale), y `PUT /api/admin/profile` SHALL reemplazarlo por completo. Ninguna de las dos rutas SHALL recibir un id: `Profile` es un singleton.

El DTO SHALL exigir `fullName`, `headline`, `summary`, `email` y `location`, y SHALL aceptar `phone`, `timezone`, `yearsOfExperience` y los tres campos de disponibilidad (modalidad, tipo de contrato, fecha de inicio) como opcionales. Un payload con campos desconocidos MUST responder 400, nunca ignorarlos en silencio ni borrar lo que no se mandó por omisión no declarada.

#### Scenario: Editar el titular y verlo en el sitio
- **WHEN** se hace `PUT /api/admin/profile` cambiando `headline` y se abre la home
- **THEN** el hero muestra el titular nuevo sin haber corrido `seed`

#### Scenario: Campos bilingües crudos
- **WHEN** se hace `GET /api/admin/profile`
- **THEN** `headline` y `summary` llegan como objetos `{ es, en }`, no como string resuelto

#### Scenario: Payload con campo desconocido
- **WHEN** se hace `PUT` con una propiedad que no está en el DTO
- **THEN** responde 400 y el perfil queda sin cambios

#### Scenario: Obligatorio vacío
- **WHEN** se hace `PUT` con `email` vacío
- **THEN** responde 400 y el perfil conserva su email anterior

#### Scenario: La disponibilidad llega al hero
- **WHEN** se cambia la fecha de inicio de disponibilidad y se abre un perfil curado
- **THEN** el badge del hero refleja el valor nuevo en el idioma activo

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
