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
La barra superior SHALL ofrecer un menú con los perfiles de `GET /api/curated-profiles` agrupados por `roleType` y mostrando `techFocus`, con el perfil activo resaltado; en móvil SHALL abrirse en un panel lateral.

#### Scenario: Menú agrupado
- **WHEN** se abre el menú
- **THEN** aparecen 14 perfiles agrupados por `roleType` (ej. "Tech Lead", "Backend") y cada uno muestra su `techFocus`

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
