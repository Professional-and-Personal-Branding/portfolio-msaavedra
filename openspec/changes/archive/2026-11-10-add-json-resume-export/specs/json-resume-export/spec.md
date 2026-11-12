## ADDED Requirements

### Requirement: Documento válido contra JSON Resume v1.0.0
Todo documento exportado SHALL validar contra el JSON Schema de JSON Resume v1.0.0 vendorizado en el repositorio, con los formatos `uri`, `email` y `date` activos. SHALL llevar `$schema` con la URL del schema del tag `v1.0.0` y MUST NOT llevar claves que el schema no defina, ni strings vacíos, `null` o listas vacías.

#### Scenario: Cada perfil público en los dos idiomas
- **WHEN** el e2e pide el `resume.json` de cada perfil público de la base en `es` y en `en`
- **THEN** todas las respuestas validan contra el schema vendorizado sin errores

#### Scenario: Los formatos están activos
- **WHEN** el test valida un documento de control con `certificates[0].date: "2023"`
- **THEN** la validación falla

#### Scenario: Schema fijado
- **WHEN** corre la suite del backend
- **THEN** el SHA-256 del schema vendorizado coincide con el registrado en su `SOURCE.md`

### Requirement: Misma resolución que la ruta pública
El documento SHALL construirse a partir de la vista resuelta por `CuratedProfileComposer` para el mismo perfil y locale, sin volver a seleccionar: mismos filtros por tags, overrides, orden y secciones. Cada lista del documento SHALL conservar el orden de su lista de origen en la vista resuelta.

#### Scenario: Experiencias filtradas y ordenadas
- **WHEN** se exporta un perfil con `filterTags` y un `excludeIds` sobre una experiencia que comparte tags
- **THEN** `work` tiene exactamente las experiencias de la vista resuelta, sin la excluida, en orden cronológico descendente

#### Scenario: Skills y proyectos con overrides
- **WHEN** un perfil incluye por `includeIds` un proyecto sin tags en común
- **THEN** ese proyecto aparece en `projects` igual que en la vista resuelta

### Requirement: Las secciones ocultas no se exportan
Una clave SHALL emitirse solo si su sección está en `sections` de la vista resuelta: `experience` → `work`, `skills` → `skills`, `projects` → `projects`, `education` → `education`, `certifications` → `certificates`, `presence` → `basics.profiles`, `contact` → `basics.email`, `basics.phone` y `languages`. `basics` SHALL emitirse siempre; `stats` no tiene equivalente.

#### Scenario: Presencia oculta
- **WHEN** se exporta `ejemplo-secciones`, que oculta `stats` y `presence`
- **THEN** `basics` no tiene `profiles` y el resto de las claves con datos sí está

#### Scenario: Contacto oculto
- **WHEN** un perfil oculta `contact`
- **THEN** el documento no tiene `basics.email`, `basics.phone` ni `languages`, y sí `basics.name`

#### Scenario: Hero oculto
- **WHEN** un perfil oculta `hero`
- **THEN** `basics` sigue con `name`, `label`, `url` y `summary`

#### Scenario: Sección sin datos
- **WHEN** la selección de un perfil deja `projects` vacío
- **THEN** el documento no tiene la clave `projects`

### Requirement: Mapeo de basics y meta
`basics.name` SHALL ser el nombre completo; `label`, el `headline` curado o, si está vacío, el del perfil; `url`, la URL pública del perfil sin token ni idioma; `location`, `{ address }` con el texto del perfil. `meta.canonical` SHALL ser la URL del propio documento con `?lang=` y sin token, `meta.version` `"v1.0.0"` y `meta.lastModified` el `updatedAt` en UTC como `AAAA-MM-DDThh:mm:ss`.

#### Scenario: Perfil de la home
- **WHEN** se exporta `all` con `FRONTEND_URL=https://ejemplo.dev` en español
- **THEN** `basics.url` es `https://ejemplo.dev/` y `meta.canonical` es `https://ejemplo.dev/api/curated-profiles/all/resume.json?lang=es`

#### Scenario: Fecha de modificación
- **WHEN** el perfil tiene `updatedAt` `2026-01-15T12:00:00.000Z`
- **THEN** `meta.lastModified` es `2026-01-15T12:00:00`

#### Scenario: Protegido sin token en las URLs
- **WHEN** se exporta un perfil `PROTECTED` con `?token=<correcto>`
- **THEN** ni `basics.url` ni `meta.canonical` contienen el token

### Requirement: Mapeo de las listas
`work` SHALL tomar empresa, rol, ubicación, fechas, resumen y logros; `education`, institución, título como `area` y fechas; `certificates`, nombre, emisor y `verificationUrl` como `url`, sin `date`; `skills`, una entrada por categoría con sus skills en `keywords`; `languages`, idioma y nivel; `projects`, nombre, resumen, rol, tecnologías y URL. Un `endDate` nulo y una fecha que no cumpla `iso8601` MUST omitirse.

#### Scenario: Experiencia en curso
- **WHEN** una experiencia tiene `endDate: null`
- **THEN** su entrada de `work` no tiene `endDate`

#### Scenario: Certificación con año
- **WHEN** una certificación tiene `year: "2023"` y `verificationUrl`
- **THEN** su entrada tiene `url` igual a la `verificationUrl` y no tiene `date`

#### Scenario: Período de un proyecto
- **WHEN** un proyecto tiene `period: "2019 – 2022"` y otro `period: "Proyecto personal"`
- **THEN** el primero tiene `startDate: "2019"` y `endDate: "2022"`, y el segundo no tiene fechas

### Requirement: Exportar no registra visita
Las rutas de exportación MUST NOT registrar un `ProfileView` ni cambiar `views` ni `CuratedProfile.updatedAt`, y la ruta pública MUST NOT leer la sesión del panel ni los parámetros `via` y `src`.

#### Scenario: Descarga pública
- **WHEN** un cliente descarga dos veces el `resume.json` de `tech-lead-dotnet`
- **THEN** la cantidad de filas de `ProfileView` del perfil, `views` y `updatedAt` no cambian

#### Scenario: Con parámetros de atribución
- **WHEN** un cliente pide el `resume.json` con `?via=<código activo>&src=indeed`
- **THEN** recibe 200 y no se registra ninguna visita

### Requirement: Cabeceras de la exportación
La respuesta 200 SHALL llevar `Content-Type: application/json; charset=utf-8`, `Content-Language`, `Content-Disposition: attachment; filename="<slug canónico>.<locale>.resume.json"` y `X-Robots-Tag: noindex`; `Cache-Control` SHALL ser `no-cache` para un perfil `PUBLIC` y `private, no-store` para uno `PROTECTED` y para la ruta del panel. El servidor MUST NOT cachear el documento.

#### Scenario: Perfil público
- **WHEN** un cliente descarga `GET /api/curated-profiles/tech-lead-dotnet/resume.json?lang=en`
- **THEN** recibe `Content-Disposition: attachment; filename="tech-lead-dotnet.en.resume.json"`, `X-Robots-Tag: noindex` y `Cache-Control: no-cache`

#### Scenario: Perfil protegido
- **WHEN** un cliente descarga el `resume.json` de un perfil `PROTECTED` con el token correcto
- **THEN** recibe `Cache-Control: private, no-store`

#### Scenario: Edición visible en la siguiente descarga
- **WHEN** el owner cambia el `headline` de un perfil y un cliente vuelve a descargarlo
- **THEN** `basics.label` trae el valor nuevo

### Requirement: Exportación desde el panel
`GET /api/admin/curated-profiles/:id/resume.json` SHALL exigir sesión de administrador y devolver el documento de lo guardado del perfil en el locale pedido, para cualquier visibilidad y también archivado, con el mismo composer y el mismo mapper que la ruta pública y sin registrar visita. Un id inexistente MUST dar 404 y sin sesión MUST dar 401.

#### Scenario: Perfil privado
- **WHEN** el administrador pide la exportación de `ejemplo-borrador` (`PRIVATE`) por su id
- **THEN** recibe 200 con un documento válido

#### Scenario: Sin sesión
- **WHEN** un cliente sin sesión pide `GET /api/admin/curated-profiles/<id>/resume.json`
- **THEN** recibe 401

#### Scenario: Paridad con la ruta pública
- **WHEN** el administrador exporta por id un perfil `PUBLIC` y un cliente anónimo lo exporta por slug, en el mismo locale
- **THEN** los dos documentos son iguales
