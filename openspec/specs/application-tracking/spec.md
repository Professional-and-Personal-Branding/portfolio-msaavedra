# application-tracking Specification

## Purpose
El owner se postula a vacantes en varios portales y necesita saber en qué estado está cada proceso y si la empresa abrió el perfil que mandó. Un registro de postulaciones solo del panel, con una máquina de estados, el vínculo opcional con un perfil curado y un enlace de seguimiento, y un export a CSV, lo resuelve sin guardar datos de contacto de personas.

## Requirements

### Requirement: Datos de una postulación
Una `Application` SHALL tener empresa (1 a 120 caracteres tras recortar), puesto (1 a 160), URL de la vacante opcional (http o https, hasta 2048), portal opcional normalizado como el de los enlaces de seguimiento, notas opcionales (hasta 5000), estado, fecha de postulación y fecha del último cambio de estado. Un valor fuera de esas reglas SHALL dar 400. MUST NOT tener campos de contacto de personas.

#### Scenario: Alta válida
- **WHEN** el administrador crea una postulación con `company: "Globex"`, `role: "Backend Senior"`, `portal: "LinkedIn"` y `jobUrl: "https://globex.example/jobs/1"`
- **THEN** recibe 201 con esos datos, `portal: "linkedin"` y un `id`

#### Scenario: Campos inválidos
- **WHEN** crea una postulación con empresa vacía, con `jobUrl: "ftp://x"` o con `portal: "mi portal!"`
- **THEN** recibe 400 y no se crea nada

#### Scenario: Sin contacto
- **WHEN** crea una postulación con un campo `contactEmail`
- **THEN** recibe 400 por campo desconocido

### Requirement: Estados y transiciones de una postulación
El estado SHALL ser `DRAFT`, `APPLIED`, `INTERVIEWING`, `OFFER`, `ACCEPTED`, `REJECTED` o `WITHDRAWN`. Las transiciones válidas SHALL ser: `DRAFT`→`APPLIED`/`WITHDRAWN`; `APPLIED`→`INTERVIEWING`/`OFFER`/`REJECTED`/`WITHDRAWN`; `INTERVIEWING`→`OFFER`/`REJECTED`/`WITHDRAWN`; `OFFER`→`ACCEPTED`/`REJECTED`/`WITHDRAWN`; `REJECTED` y `WITHDRAWN`→`APPLIED`. `ACCEPTED` SHALL ser final. Al crear se admite cualquier estado.

#### Scenario: Transición válida
- **WHEN** una postulación `APPLIED` pasa a `INTERVIEWING`
- **THEN** la respuesta es 200 con `status: "INTERVIEWING"` y `statusChangedAt` nuevo

#### Scenario: Transición inválida
- **WHEN** una postulación `DRAFT` se pide pasar a `OFFER`, o una `ACCEPTED` a cualquier otro estado
- **THEN** la respuesta es 422 con `error: "Unprocessable Entity"` y la postulación no cambia

#### Scenario: Reabrir
- **WHEN** una postulación `REJECTED` pasa a `APPLIED`
- **THEN** la respuesta es 200 y su `appliedAt` no cambia

#### Scenario: Mismo estado
- **WHEN** se edita una postulación enviando el mismo `status` que ya tiene
- **THEN** la respuesta es 200 y `statusChangedAt` no cambia

#### Scenario: Estado desconocido
- **WHEN** se envía `status: "HIRED"`
- **THEN** la respuesta es 400

### Requirement: Transiciones posibles en la respuesta
Cada postulación de la API SHALL traer `nextStatuses`, la lista de estados a los que puede pasar según la tabla de transiciones del dominio.

#### Scenario: Desde postulada
- **WHEN** se lee una postulación `APPLIED`
- **THEN** `nextStatuses` es `["INTERVIEWING", "OFFER", "REJECTED", "WITHDRAWN"]`

#### Scenario: Final
- **WHEN** se lee una postulación `ACCEPTED`
- **THEN** `nextStatuses` es una lista vacía

### Requirement: Fechas de la postulación
`appliedAt` SHALL ser una fecha `AAAA-MM-DD`, nula en `DRAFT`. Fuera de `DRAFT`, si falta, SHALL tomar la fecha UTC del reloj al crear o al salir de `DRAFT`, y MUST NOT ser posterior al día UTC del reloj más uno. `statusChangedAt` SHALL fijarse al crear y en cada cambio efectivo de estado.

#### Scenario: Fecha automática
- **WHEN** con el reloj en 2026-11-20 una postulación `DRAFT` pasa a `APPLIED` sin `appliedAt`
- **THEN** queda con `appliedAt: "2026-11-20"`

#### Scenario: Borrador con fecha
- **WHEN** se crea una postulación `DRAFT` con `appliedAt`
- **THEN** la respuesta es 400

#### Scenario: Fecha futura
- **WHEN** con el reloj en 2026-11-20 se envía `appliedAt: "2026-11-25"`
- **THEN** la respuesta es 400

### Requirement: Vínculo con un perfil y un enlace de seguimiento
Una postulación SHALL poder referir un perfil curado existente y, solo con perfil, un enlace `MANUAL` de ese perfil, activo o revocado. Un perfil inexistente o un enlace ajeno, de otro tipo o sin perfil SHALL dar 400; un enlace ya asociado a otra postulación, 409. Si el perfil o el enlace se borran, la referencia SHALL quedar nula.

#### Scenario: Enlace del perfil
- **WHEN** se crea una postulación con un perfil y un enlace `MANUAL` de ese perfil
- **THEN** la respuesta es 201 con el `slug` del perfil y la etiqueta del enlace

#### Scenario: Enlace de otro perfil o de LinkedIn
- **WHEN** el enlace pertenece a otro perfil o es `LINKEDIN_POST`
- **THEN** la respuesta es 400 y no se crea nada

#### Scenario: Enlace repetido
- **WHEN** se crea una segunda postulación con el enlace de la primera
- **THEN** la respuesta es 409

#### Scenario: Perfil borrado
- **WHEN** se borra el perfil curado de una postulación
- **THEN** la postulación sigue, sin perfil ni enlace

### Requirement: Apertura del enlace en la postulación
Una postulación con enlace SHALL traer `opens`, `firstOpenedAt` y `lastOpenedAt` del enlace, contando solo visitas `HUMAN` de toda su historia. El listado SHALL resolver las aperturas de todas sus filas con una sola consulta de agregado, sin una consulta por fila.

#### Scenario: Primera apertura humana
- **WHEN** el enlace tiene una visita `OWNER` el día 1 y visitas `HUMAN` los días 3 y 5
- **THEN** la postulación trae `opens: 2`, `firstOpenedAt` del día 3 y `lastOpenedAt` del día 5

#### Scenario: Sin abrir
- **WHEN** el enlace no tiene visitas `HUMAN`
- **THEN** trae `opens: 0`, `firstOpenedAt: null` y `lastOpenedAt: null`

#### Scenario: Sin N+1
- **WHEN** el caso de uso lista diez postulaciones con enlace
- **THEN** pide las aperturas una sola vez, con los diez ids

### Requirement: API de postulaciones del panel
Con sesión de administrador, `/api/admin/applications` SHALL listar (`updatedAt` descendente, filtro `status` con uno o varios estados separados por coma) y crear (201); `/:id` SHALL leer, aceptar `PATCH` parcial (incluido el estado, en una sola escritura) y `DELETE` (204). Un id inexistente SHALL dar 404; sin sesión, 401.

#### Scenario: Filtro por estado
- **WHEN** se pide `GET /api/admin/applications?status=APPLIED,INTERVIEWING`
- **THEN** solo vienen postulaciones en esos dos estados, la editada más recientemente primero

#### Scenario: Edición atómica
- **WHEN** un `PATCH` cambia las notas y pide una transición inválida
- **THEN** la respuesta es 422 y las notas no cambian

#### Scenario: Sin sesión
- **WHEN** un cliente sin sesión pide cualquier ruta de `/api/admin/applications`
- **THEN** recibe 401

#### Scenario: Borrado
- **WHEN** se borra una postulación y se la vuelve a pedir
- **THEN** el borrado da 204 y la lectura 404

### Requirement: Resumen de postulaciones por estado
`GET /api/admin/applications/summary` SHALL devolver `byStatus` con los siete estados (ceros incluidos) y `active`, la suma de `DRAFT`, `APPLIED`, `INTERVIEWING` y `OFFER`.

#### Scenario: Conteos
- **WHEN** hay 2 `APPLIED`, 1 `OFFER` y 3 `REJECTED`
- **THEN** `active` es 3, `byStatus.REJECTED` es 3 y `byStatus.DRAFT` es 0

### Requirement: Exportación a CSV
`GET /api/admin/applications/export` SHALL responder `text/csv; charset=utf-8` con `Content-Disposition: attachment; filename="postulaciones-AAAA-MM-DD.csv"` y `Cache-Control: no-store`, con el mismo filtro y orden que la lista. El cuerpo SHALL empezar con BOM, usar coma, CRLF y todas las celdas entre comillas, con la fila de cabecera de las columnas del diseño.

#### Scenario: Cabeceras y columnas
- **WHEN** con el reloj en 2026-11-20 se exporta con dos postulaciones
- **THEN** el nombre es `postulaciones-2026-11-20.csv`, la primera fila empieza con `"Empresa","Puesto","Estado"` y hay tres filas separadas por CRLF

#### Scenario: Comillas y saltos de línea
- **WHEN** las notas son `dijo "ok"` seguido de un salto de línea y `fin`
- **THEN** la celda es `"dijo ""ok""` + salto + `fin"` y el archivo sigue teniendo una fila por postulación al leerlo con un parser RFC 4180

#### Scenario: Sin sesión
- **WHEN** se pide el export sin sesión
- **THEN** la respuesta es 401 y no es un CSV

### Requirement: CSV sin fórmulas ejecutables
Toda celda del CSV que empiece con `=`, `+`, `-`, `@`, tabulación o retorno de carro SHALL llevar un apóstrofo delante, de modo que una planilla la muestre como texto. El resto del contenido MUST NOT alterarse.

#### Scenario: Fórmula en la empresa
- **WHEN** la empresa es `=HYPERLINK("http://x","clic")`
- **THEN** la celda es `"'=HYPERLINK(""http://x"",""clic"")"`

#### Scenario: Texto normal
- **WHEN** el puesto es `Backend Senior`
- **THEN** la celda es `"Backend Senior"`, sin apóstrofo

### Requirement: Postulaciones solo en el panel
El módulo MUST NOT exponer rutas fuera de `/api/admin/`, y ningún dato de una postulación SHALL aparecer en la respuesta pública de un perfil, en el head, en el sitemap ni en el CSV de otra ruta.

#### Scenario: Ruta pública inexistente
- **WHEN** se pide `GET /api/applications`
- **THEN** la respuesta es 404

#### Scenario: El perfil público no cambia
- **WHEN** se pide `GET /api/curated-profiles/:slug` de un perfil con postulaciones
- **THEN** el cuerpo es idéntico al de antes de crearlas

### Requirement: Pantalla Postulaciones
`/admin/postulaciones` SHALL requerir sesión, figurar en la navegación del panel y listar las postulaciones con empresa, puesto, estado, portal, perfil, «Abierto el…» o «Sin abrir» y fecha de postulación. El filtro de estado (`Activas` por defecto, `Todas` o uno) SHALL vivir en la URL, sin `localStorage`. Borrar SHALL pedir confirmación.

#### Scenario: Filtro en la URL
- **WHEN** se elige el filtro *En entrevistas* y se recarga la página
- **THEN** la URL lleva `?estado=interviewing`, se pide `status=INTERVIEWING` y el filtro sigue elegido

#### Scenario: Abierto el
- **WHEN** una postulación tiene un enlace con `firstOpenedAt` del 12 de noviembre de 2026
- **THEN** su fila muestra «Abierto el 12/11/2026»

#### Scenario: Vacío
- **WHEN** no hay postulaciones y el filtro es `Todas`
- **THEN** se muestra «Todavía no registraste postulaciones»

### Requirement: Diálogo de una postulación
El diálogo SHALL usar React Hook Form y Zod con las reglas de la API y mensajes literales, ofrecer al editar solo el estado actual y sus `nextStatuses`, ocultar la fecha con *Por postular* y listar en Enlace solo los enlaces `MANUAL` del perfil elegido. Un 422 o un 409 SHALL mostrar su mensaje sin cerrar el diálogo.

#### Scenario: Validación en el cliente
- **WHEN** se guarda sin empresa y con `jobUrl: "globex.example"`
- **THEN** se ven «Escribí la empresa» y «Usá una URL que empiece con http:// o https://» y no se llama a la API

#### Scenario: Estados ofrecidos
- **WHEN** se edita una postulación `INTERVIEWING`
- **THEN** el selector ofrece En entrevistas, Oferta, Rechazada y Retirada

#### Scenario: Conflicto de estado
- **WHEN** la API responde 422 al guardar
- **THEN** se ve «Ese cambio de estado no está permitido. Elegí uno de la lista.» y el diálogo sigue abierto

### Requirement: Descarga del CSV desde el panel
El botón **Exportar CSV** SHALL descargar el export con el filtro vigente usando la sesión, con el nombre de `Content-Disposition`. Un error SHALL mostrar «No se pudo exportar. Intentá de nuevo.» y MUST NOT guardar un archivo.

#### Scenario: Descarga con filtro
- **WHEN** con el filtro `Activas` se pulsa **Exportar CSV**
- **THEN** se pide `/api/admin/applications/export?status=DRAFT,APPLIED,INTERVIEWING,OFFER` y se descarga `postulaciones-<fecha>.csv`

#### Scenario: Error
- **WHEN** el export responde 500
- **THEN** se ve «No se pudo exportar. Intentá de nuevo.» y no se descarga nada
