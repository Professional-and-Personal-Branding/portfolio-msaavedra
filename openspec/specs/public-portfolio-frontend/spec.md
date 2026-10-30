# public-portfolio-frontend Specification

## Purpose
La cara visible del producto: una SPA que muestra la home y cada perfil curado consumiendo la API real, con navegación por perfiles, acceso a perfiles protegidos y comportamiento correcto en móvil y escritorio.

## Requirements

### Requirement: Home consumiendo la API real
`/` SHALL renderizar el perfil curado `all` obtenido de `GET /api/curated-profiles/all` (perfil base, experiencias, skills, proyectos, educación, certificaciones, presencia y contacto) con su tema. MUST NOT existir datos de portafolio hardcodeados en el frontend.

#### Scenario: Home
- **WHEN** se abre `/` con el backend seedeado
- **THEN** se muestran el nombre del perfil base, 15 experiencias y 12 categorías de skills provenientes de la API

#### Scenario: Sin datos hardcodeados
- **WHEN** se busca en `frontend/src` el texto "Novacomp" o "Saavedra"
- **THEN** no aparece en el código fuente (solo en tests con datos mock)

### Requirement: Vista curada por slug
`/:slug` SHALL renderizar el perfil curado resuelto por la API con sus experiencias filtradas, tema y secciones. Un slug inexistente o `PRIVATE` SHALL mostrar una página 404 propia.

#### Scenario: Perfil curado
- **WHEN** se abre `/tech-lead-dotnet`
- **THEN** se muestran su título, 13 experiencias y el tema `modern-dark`

#### Scenario: 404
- **WHEN** se abre `/no-existe`
- **THEN** se muestra la página "perfil no encontrado" con enlace a la home

### Requirement: Navegación por perfiles curados
La barra superior SHALL ofrecer el menú de perfiles **únicamente en la home** (`/`), con los perfiles de `GET /api/curated-profiles` —públicos, enumerados y no archivados— agrupados por `roleType` y mostrando `techFocus`; en móvil SHALL abrirse en un panel lateral. En `/:slug` MUST NOT renderizarse ningún enlace a otro slug de perfil curado, cualquiera sea el valor de `listed` de los demás: un perfil enviado no ofrece navegación a los otros.

#### Scenario: Menú agrupado
- **WHEN** se abre el menú en la home
- **THEN** aparecen los perfiles del listado público agrupados por `roleType` (ej. "Tech Lead", "Backend") y cada uno muestra su `techFocus`

#### Scenario: Un perfil enviado no enumera a los demás
- **WHEN** se abre `/tech-lead-dotnet`
- **THEN** el DOM no contiene ningún enlace a otro slug de perfil curado

#### Scenario: La home sí ofrece el menú
- **WHEN** se abre `/`
- **THEN** el menú lista los perfiles públicos, enumerados y no archivados, agrupados por `roleType`

### Requirement: Perfiles protegidos
Si la API responde 401 para `/:slug`, el frontend SHALL mostrar un formulario para ingresar el token; al enviarlo SHALL reintentar con `X-Access-Token` y, si es válido, renderizar el perfil y reflejar `?token=` en la URL para compartir. `?token=` presente en la URL SHALL usarse automáticamente.

#### Scenario: Token por URL
- **WHEN** se abre `/dotnet-backend?token=<válido>` y el perfil es PROTECTED
- **THEN** se renderiza el perfil sin pedir el token

#### Scenario: Token incorrecto
- **WHEN** se envía un token incorrecto en el formulario
- **THEN** se muestra un mensaje de error y el formulario permanece

### Requirement: Estados de carga y error
Mientras carga, la vista SHALL mostrar esqueletos; ante un error de red o 5xx SHALL mostrar un mensaje con acción de reintentar.

#### Scenario: Error de red
- **WHEN** la API no responde
- **THEN** se muestra un estado de error con botón "Reintentar" que vuelve a pedir los datos

### Requirement: Responsive
La vista SHALL ser usable en 375 px y en 1280 px: sin desbordes horizontales, menú accesible en móvil y grillas que colapsan a una columna.

#### Scenario: Móvil
- **WHEN** el viewport es de 375 px de ancho
- **THEN** no hay scroll horizontal, la grilla de skills es de una columna y el menú se abre desde un botón

### Requirement: Calidad de construcción
`npm run typecheck`, `npm run lint`, `npm run test` y `npm run build` del frontend SHALL pasar; el bundle inicial de producción SHALL ser menor a 400 KB gzip.

#### Scenario: Build
- **WHEN** se ejecuta `npm run build`
- **THEN** termina con código 0 y el reporte de Vite muestra un JS inicial menor a 400 KB gzip

### Requirement: El escritor de metadatos del cliente es idempotente
`applyDocumentMeta` SHALL reutilizar la etiqueta existente de cada clave de metadato (por `name` o `property`, aunque no lleve el marcador `data-managed-meta`) y marcarla como gestionada al escribirla. Tras aplicarse sobre un head ya poblado por el servidor, el documento MUST contener **exactamente una** etiqueta por clave, un solo `<link rel="canonical">` y un solo `<script type="application/ld+json">`.

`restoreDocumentMeta` SHALL seguir limpiando únicamente lo marcado como gestionado.

#### Scenario: Head pre-poblado por el servidor
- **WHEN** el documento ya trae `og:title`, `description` y `canonical` del fragmento del servidor y el cliente resuelve el perfil
- **THEN** esas mismas etiquetas se actualizan y no se agrega ninguna duplicada

#### Scenario: Navegación entre perfiles sin recargar
- **WHEN** se navega de un perfil a otro dentro de la SPA
- **THEN** cada clave de metadato sigue teniendo una sola etiqueta, con los valores del perfil nuevo

#### Scenario: Head vacío (desarrollo, sin borde)
- **WHEN** el documento no trae metadatos del servidor
- **THEN** el cliente los crea y el resultado es el mismo que antes de este change

#### Scenario: Los textos del cliente y del servidor coinciden
- **WHEN** se comparan el fragmento del backend y el resultado de `metaFromProfile` para el mismo perfil e idioma
- **THEN** título, descripción y canonical son iguales

### Requirement: Certificación verificable en la sección pública
Cada certificación con `verificationUrl` SHALL mostrar un enlace «Ver credencial» («View credential» en inglés) con `target="_blank"`, `rel="noopener noreferrer"` y un nombre accesible que incluye el nombre de la certificación. SHALL mostrar el `credentialId` si existe y, según `expiresAt` y la fecha del navegador, «Válida hasta» con el mes o «Vencida». Sin esos datos la tarjeta MUST quedar como antes. MUST NOT sumar recursos de otros orígenes.

#### Scenario: Enlace a la credencial
- **WHEN** se abre `/` con una certificación que tiene `verificationUrl: "https://example.org/c/1"`
- **THEN** su tarjeta tiene un enlace «Ver credencial» a esa URL con `target="_blank"` y `rel="noopener noreferrer"`

#### Scenario: Nombre accesible propio
- **WHEN** dos certificaciones de la sección tienen enlace
- **THEN** cada enlace tiene un nombre accesible distinto que empieza con «Ver credencial» y nombra su certificación

#### Scenario: En inglés
- **WHEN** se abre `/?lang=en` con la misma certificación
- **THEN** el enlace dice «View credential» y apunta a la misma URL

#### Scenario: Vigente y vencida
- **WHEN** con la fecha del navegador en octubre de 2026 una certificación tiene `expiresAt: "2029-06"` y otra `expiresAt: "2025-12"`
- **THEN** la primera muestra «Válida hasta» con junio de 2029 y la segunda muestra «Vencida»

#### Scenario: Sin credencial
- **WHEN** una certificación no tiene `verificationUrl`, `credentialId` ni `expiresAt`
- **THEN** su tarjeta muestra solo nombre, emisor y año, sin enlace

#### Scenario: Presupuesto del arranque
- **WHEN** se corre `npm run perf:budget` sobre el build con este cambio
- **THEN** el arranque público sigue en 155 KB gzip o menos y en un solo JS de módulo
