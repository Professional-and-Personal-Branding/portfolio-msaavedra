## MODIFIED Requirements

### Requirement: El panel agrupa el contenido por frecuencia de cambio
El backoffice SHALL ofrecer `/admin/portada` (perfil base, contacto, disponibilidad e idiomas), `/admin/formacion` (educación y certificaciones) y `/admin/proyectos` (proyectos, repositorios destacados y enlaces sociales). La página de portada SHALL mostrar una vista previa del hero resuelta por el backend antes de guardar.

#### Scenario: Previsualizar antes de guardar
- **WHEN** se edita el titular en `/admin/portada` sin guardar
- **THEN** la vista previa del hero muestra el texto nuevo y el perfil publicado sigue con el anterior

#### Scenario: Navegación completa
- **WHEN** se abre el panel
- **THEN** la navegación ofrece Dashboard, Portada, Experiencias, Skills, Formación, Proyectos y Perfiles curados

#### Scenario: Repositorios dentro de Proyectos
- **WHEN** se abre `/admin/proyectos`
- **THEN** la página muestra los bloques Proyectos, Repositorios y Enlaces, en ese orden

## ADDED Requirements

### Requirement: Repositorios en la página Proyectos
El bloque Repositorios SHALL listar todos los repositorios (ocultos marcados) y ofrecer alta, edición y borrado con confirmación en un diálogo con Nombre, URL de GitHub, Lenguaje, Descripción ES/EN, Tecnologías, Tags, Orden y Visible en el sitio. SHALL validar la URL con la regla del dominio antes de enviar y mostrar los errores 400 y 409 de la API junto al campo.

#### Scenario: URL fuera de forma
- **WHEN** se escribe `https://gitlab.com/a/b` en URL y se intenta guardar
- **THEN** el diálogo muestra «La URL tiene que ser https://github.com/<usuario>/<repositorio>» y no envía nada

#### Scenario: Repositorio repetido
- **WHEN** se guarda un repositorio con la URL de otro ya cargado y la API responde 409
- **THEN** el campo URL muestra «Ese repositorio ya está cargado» y el diálogo sigue abierto con los datos

#### Scenario: Nombre propuesto desde la URL
- **WHEN** con Nombre vacío se escribe `https://github.com/octo-org/api-reservas` y se sale del campo
- **THEN** Nombre pasa a `api-reservas` y se puede editar

#### Scenario: Alta visible en el sitio
- **WHEN** se crean dos repositorios visibles sin tags en una base sin repositorios y se abre `/`
- **THEN** la home muestra la sección de repositorios con los dos
