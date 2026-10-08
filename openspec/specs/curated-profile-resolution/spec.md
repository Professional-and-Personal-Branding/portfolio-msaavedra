# curated-profile-resolution Specification

## Purpose
Define cómo se transforma un perfil curado (slug, tags de filtro, overrides, visibilidad, secciones) en una vista resuelta del perfil profesional: qué experiencias y skills entran, en qué orden, quién puede verla y con qué forma se entrega. Es el núcleo del producto y debe ser verificable sin base de datos.

## Requirements

### Requirement: Selección de experiencias por intersección de tags
Dado un perfil curado con `filterTags`, el sistema SHALL incluir una experiencia visible si comparte **al menos un tag** con `filterTags`. Si `filterTags` está vacío, SHALL incluir todas las experiencias visibles. Las experiencias marcadas no visibles MUST NOT incluirse nunca, ni siquiera mediante `includeIds`.

#### Scenario: Intersección con un tag basta
- **WHEN** el perfil tiene `filterTags = ["java", "spring-boot"]` y una experiencia tiene `tags = ["java", "fintech"]`
- **THEN** la experiencia se incluye

#### Scenario: Sin intersección se excluye
- **WHEN** el perfil tiene `filterTags = ["java"]` y una experiencia tiene `tags = ["dotnet", "legacy"]`
- **THEN** la experiencia no se incluye

#### Scenario: filterTags vacío incluye todo
- **WHEN** el perfil tiene `filterTags = []` (perfil `all`)
- **THEN** se incluyen todas las experiencias visibles

#### Scenario: Oculta nunca entra
- **WHEN** una experiencia tiene `visible = false` aunque matchee por tag o figure en `includeIds`
- **THEN** no se incluye

#### Scenario: Datos seed — tech-lead-dotnet
- **WHEN** se resuelve el perfil `tech-lead-dotnet` sobre `cv-data.json`
- **THEN** cada experiencia incluida comparte al menos un tag con `["leadership","dotnet","microservices","migration","microsoft","integration","fullstack"]` y las que no comparten ninguno (ej. `eron-directa24`, `kiwox`) no aparecen

#### Scenario: Datos seed — java no trae .NET puro
- **WHEN** se resuelve `java-senior-backend` (`filterTags = ["java","spring-boot","microservices"]`)
- **THEN** no aparecen experiencias sin el tag `java` ni los otros dos (ej. `ypfb`, `delta-cargo`)

#### Scenario: Datos seed — generalista resuelve la mayoría
- **WHEN** se resuelve `generalist-polyglot`
- **THEN** incluye todas las experiencias visibles de `cv-data.json` (hoy 15)

### Requirement: Overrides de inclusión y exclusión
`excludeIds` SHALL forzar la exclusión de un item aunque matchee por tag. `includeIds` SHALL forzar la inclusión de un item visible aunque no matchee por tag. Si un id figura en ambos, `excludeIds` MUST prevalecer. Ids inexistentes SHALL ignorarse sin error.

#### Scenario: excludeIds prevalece sobre el match
- **WHEN** una experiencia matchea por tag y su id está en `excludeIds`
- **THEN** no se incluye

#### Scenario: includeIds fuerza inclusión
- **WHEN** una experiencia visible no matchea por tag y su id está en `includeIds`
- **THEN** se incluye

#### Scenario: Conflicto entre include y exclude
- **WHEN** el mismo id está en `includeIds` y en `excludeIds`
- **THEN** el item no se incluye

#### Scenario: Id inexistente
- **WHEN** `includeIds` o `excludeIds` contienen un id que no corresponde a ningún item
- **THEN** la resolución termina con éxito ignorando ese id

### Requirement: Selección de skills por categoría
El sistema SHALL aplicar a las skills la misma regla de tags y overrides que a las experiencias (los overrides comparten el mismo espacio de ids). El resultado SHALL agruparse por categoría, conservando el orden de categorías y de skills; una categoría sin skills seleccionadas MUST NOT aparecer.

#### Scenario: Categoría filtrada parcialmente
- **WHEN** una categoría tiene 3 skills y solo 2 comparten tag con `filterTags`
- **THEN** la categoría aparece con exactamente esas 2 skills, en su orden original

#### Scenario: Categoría vacía desaparece
- **WHEN** ninguna skill de una categoría matchea ni está en `includeIds`
- **THEN** la categoría no aparece en el resultado

#### Scenario: Datos seed — all trae todas las categorías
- **WHEN** se resuelve el perfil `all`
- **THEN** aparecen las 12 categorías con sus 108 skills

### Requirement: Orden cronológico de las experiencias
Las experiencias seleccionadas SHALL ordenarse por `startDate` descendente (más reciente primero); a igual `startDate`, por `order` ascendente.

#### Scenario: Más reciente primero
- **WHEN** se seleccionan experiencias con `startDate` `2021-06`, `2026-03`, `2019-01`
- **THEN** el resultado es `2026-03`, `2021-06`, `2019-01`

#### Scenario: Desempate por order
- **WHEN** dos experiencias comparten `startDate` y tienen `order` 5 y 2
- **THEN** la de `order` 2 aparece primero

### Requirement: Visibilidad y control de acceso
Un perfil `PUBLIC` SHALL resolverse sin credenciales. Un perfil `PRIVATE` o un slug inexistente MUST producir el mismo error "no encontrado" (no se revela su existencia). Un perfil `PROTECTED` SHALL resolverse solo si el token de acceso presentado coincide exactamente con su `accessToken`; en caso contrario MUST producir un error de acceso denegado distinto del "no encontrado". La comparación del token MUST ser en tiempo constante.

#### Scenario: Público sin token
- **WHEN** se resuelve un perfil `PUBLIC` sin token
- **THEN** se obtiene la vista resuelta

#### Scenario: Privado se comporta como inexistente
- **WHEN** se resuelve un perfil `PRIVATE`, con o sin token
- **THEN** se obtiene el error "perfil curado no encontrado"

#### Scenario: Slug inexistente
- **WHEN** se resuelve un slug que no existe
- **THEN** se obtiene el error "perfil curado no encontrado"

#### Scenario: Protegido sin token o con token incorrecto
- **WHEN** se resuelve un perfil `PROTECTED` sin token o con un token distinto
- **THEN** se obtiene el error "acceso denegado"

#### Scenario: Protegido con token válido
- **WHEN** se resuelve un perfil `PROTECTED` con el token exacto
- **THEN** se obtiene la vista resuelta

### Requirement: Secciones ordenadas y ocultas
La resolución SHALL devolver el orden final, con relleno aplicado: el composer SHALL devolver en `sections` el orden **final** que se renderiza. Para eso, después de aplicar `sectionsOrder` y `sectionsHidden`, SHALL agregar al final las secciones del catálogo que (a) tengan datos tras el filtrado, (b) no estén ocultas y (c) no figuren ya en el orden. El relleno MUST NOT duplicar ids ni reordenar los que ya venían. Una sección sin datos MUST NOT aparecer en `sections`, aunque figure en `sectionsOrder`. El cliente MUST NOT recalcular el orden ni completarlo. Las secciones de `sectionsHidden` MUST NOT figurar en `sections` y SHALL informarse aparte, sin duplicados, en `hiddenSections`.

#### Scenario: Orden vacío usa el default
- **WHEN** `sectionsOrder = []`, `sectionsHidden = []` y hay datos en todas las colecciones
- **THEN** `sections` es el catálogo completo, en orden canónico

#### Scenario: Orden personalizado con ocultas
- **WHEN** `sectionsOrder = ["hero","skills","experience","contact"]`, `sectionsHidden = ["skills"]` y hay datos en todas las colecciones
- **THEN** `sections` empieza con `["hero","experience","contact"]`, no contiene `skills`, sigue con el relleno en orden canónico, y `hiddenSections = ["skills"]`

#### Scenario: Sección con datos omitida del orden
- **WHEN** un perfil declara `sectionsOrder: ["hero", "experience"]`, tiene proyectos que pasan el filtro y no oculta nada
- **THEN** `sections` empieza con `hero` y `experience`, e incluye `projects` después de ellas

#### Scenario: Sección sin datos no se rellena
- **WHEN** un perfil declara `sectionsOrder: ["hero"]` y ningún proyecto pasa el filtro
- **THEN** `sections` no contiene `projects`

#### Scenario: Sección oculta no se rellena
- **WHEN** un perfil declara `sectionsOrder: ["hero"]`, `sectionsHidden: ["projects"]` y tiene proyectos que pasan el filtro
- **THEN** `sections` no contiene `projects` y `hiddenSections` sí

#### Scenario: El orden declarado no se altera
- **WHEN** un perfil declara `sectionsOrder: ["contact", "hero", "experience"]`
- **THEN** esos tres ids aparecen en `sections` en ese mismo orden, antes de cualquier id agregado por relleno

#### Scenario: Id repetido en el orden
- **WHEN** un perfil declara `sectionsOrder: ["hero", "hero", "experience"]`
- **THEN** `sections` contiene `hero` una sola vez

### Requirement: Resultado listo para presentación
La vista resuelta SHALL contener: metadatos del perfil curado (`slug`, `title`, `headline`, `description`, `roleType`, `techFocus`, `accentColor`, `layout`, `visibility`), `sections`/`hiddenSections`, el `theme` resuelto (ver `theme-resolution`), el perfil base (`profile`, misma forma que `public-profile-api`), las `experiences` (misma forma que `public-experience-api`), `skillCategories[] { name, skills[] }`, `projects` (seleccionados por tags/overrides), `education`, `certifications` y `socialLinks` (misma forma que `public-portfolio-sections-api`). Todos los campos traducibles SHALL venir resueltos al locale pedido; la salida MUST NOT contener `accessToken`, `includeIds`, `excludeIds` ni `filterTags`.

#### Scenario: Forma completa
- **WHEN** se resuelve un perfil `PUBLIC`
- **THEN** el resultado tiene las claves `slug, title, headline, description, roleType, techFocus, accentColor, layout, visibility, sections, hiddenSections, theme, profile, experiences, skillCategories, projects, education, certifications, socialLinks`

#### Scenario: Sin datos sensibles ni internos
- **WHEN** se resuelve un perfil `PROTECTED` con token válido
- **THEN** el resultado no contiene `accessToken`, `includeIds`, `excludeIds` ni `filterTags`

#### Scenario: Locale aplicado a todo el árbol
- **WHEN** se resuelve con locale `en`
- **THEN** `title`, `roleType`, `profile.headline`, `experiences[].role`, `skillCategories[].name`, `projects[].role`, `education[].degree`, `certifications[].name` y `socialLinks[].label` vienen en inglés, y ningún valor es un objeto `{es,en}`

### Requirement: Lógica testeable sin base de datos
La selección, el orden, el control de acceso y las secciones SHALL implementarse como reglas de dominio/aplicación ejecutables con repositorios sustitutos, sin conexión a base de datos.

#### Scenario: Suite unitaria del núcleo
- **WHEN** se ejecuta la suite unitaria del módulo con repositorios mock
- **THEN** todos los escenarios de esta capacidad pasan sin `DATABASE_URL`

### Requirement: Registro de visita al resolver por la ruta pública
Una resolución exitosa solicitada por la ruta pública SHALL registrar la visita según `profile-view-analytics` (paso 6 del núcleo en `CLAUDE.md`). La resolución invocada sin contexto de visita (tests unitarios, usos internos) MUST NOT registrar nada. El registro MUST NOT modificar el resultado devuelto ni convertir un éxito en error.

#### Scenario: Con contexto de visita
- **WHEN** el caso de uso se ejecuta con `viewContext` (locale, referrer, userAgent, ipHash) y el perfil es accesible
- **THEN** se registra una visita y el resultado es el mismo que sin contexto

#### Scenario: Sin contexto de visita
- **WHEN** el caso de uso se ejecuta sin `viewContext`
- **THEN** no se registra ninguna visita

#### Scenario: Fallo del registro
- **WHEN** el repositorio de visitas falla al registrar
- **THEN** el caso de uso devuelve igualmente el resultado exitoso

### Requirement: Selección de proyectos por tags
Los proyectos visibles SHALL seleccionarse con la misma regla que las experiencias: intersección con `filterTags` (vacío = todos), `excludeIds` prevalece e `includeIds` fuerza la inclusión; comparten el espacio de ids de los overrides. El resultado SHALL ordenarse por `order` ascendente.

#### Scenario: Proyecto con intersección
- **WHEN** el perfil tiene `filterTags = ["java"]` y un proyecto tiene `tags = ["erp", "java"]`
- **THEN** el proyecto se incluye

#### Scenario: Sin intersección
- **WHEN** el perfil tiene `filterTags = ["devops"]` y ningún proyecto comparte tag
- **THEN** `projects` es un array vacío

#### Scenario: Override sobre un proyecto
- **WHEN** el id de un proyecto que matchea figura en `excludeIds`
- **THEN** no se incluye

#### Scenario: Datos seed
- **WHEN** se resuelve `tech-lead-dotnet`
- **THEN** `projects` contiene los 2 proyectos del JSON (ambos intersectan) y `devops-platform` devuelve 0

### Requirement: Secciones informativas sin filtrar
La vista resuelta SHALL incluir educación, certificaciones y enlaces sociales visibles, sin filtrado por tags (no tienen tags), ordenados por `order` y resueltos al locale, con la misma forma que `public-portfolio-sections-api`.

#### Scenario: Conteos seed
- **WHEN** se resuelve cualquier perfil `PUBLIC`
- **THEN** `education` tiene 6 elementos, `certifications` 8 y `socialLinks` 3

### Requirement: Catálogo canónico de secciones
El dominio SHALL declarar **un único** catálogo de secciones, `SECTION_IDS`, con estos nueve ids en este orden canónico: `hero`, `stats`, `experience`, `skills`, `projects`, `education`, `certifications`, `presence`, `contact`. `DEFAULT_SECTIONS` SHALL ser ese mismo catálogo. Ningún otro módulo, ni el frontend, SHALL declarar una lista propia de secciones: el contrato OpenAPI es el único transporte del catálogo hacia el cliente.

#### Scenario: Orden vacío usa el catálogo completo
- **WHEN** un perfil curado tiene `sectionsOrder` vacío y datos en todas las colecciones
- **THEN** `sections` contiene los nueve ids en el orden canónico

#### Scenario: El catálogo del backend y el tipo del frontend no pueden divergir
- **WHEN** se agrega un id al catálogo del backend y se regeneran los tipos
- **THEN** el frontend no compila hasta que el registro de secciones implemente ese id

### Requirement: Tabla de verdad de la resolución de ruta
La decisión de si un slug resuelve SHALL tomarse en **una única** función pura de dominio sobre `(visibility, archivedAt, token presente y válido)`, y ningún caso de uso ni controller SHALL replicarla. Un perfil **archivado** MUST resolver siempre como inexistente, cualquiera sea su visibilidad y aunque se presente un token válido; MUST NOT devolver 401, porque un 401 confirmaría que el slug existió.

| `visibility` | `archivedAt` | sin token | con token válido |
|---|---|---|---|
| `PUBLIC` | null | 200 | 200 |
| `PUBLIC` | fecha | 404 | 404 |
| `PROTECTED` | null | 401 | 200 |
| `PROTECTED` | fecha | 404 | 404 |
| `PRIVATE` | null | 404 | 404 |
| `PRIVATE` | fecha | 404 | 404 |

#### Scenario: Público archivado
- **WHEN** un perfil `PUBLIC` se archiva y se pide `GET /api/curated-profiles/{slug}`
- **THEN** responde 404, sin distinguirse de un slug inexistente

#### Scenario: Protegido archivado con token válido
- **WHEN** un perfil `PROTECTED` archivado se pide con su `?token=` correcto
- **THEN** responde 404 y no 401 ni 200

#### Scenario: Protegido no archivado sigue igual
- **WHEN** un perfil `PROTECTED` no archivado se pide sin token y luego con token válido
- **THEN** responde 401 y después 200

#### Scenario: Desarchivar restituye el comportamiento
- **WHEN** un perfil `PUBLIC` archivado se desarchiva y se vuelve a pedir
- **THEN** responde 200 con el mismo contenido que antes de archivarse

#### Scenario: Los doce casos están cubiertos
- **WHEN** se ejecuta la tabla de verdad como test
- **THEN** las seis combinaciones de `visibility` × `archivedAt`, con y sin token, dan el resultado de la tabla

### Requirement: Un perfil archivado conserva sus visitas
Archivar MUST NOT borrar `ProfileView` ni reiniciar `views`. Un perfil archivado SHALL seguir apareciendo en la analítica agregada, identificable como archivado. Mientras está archivado, la ruta pública no resuelve, así que MUST NOT registrarse ninguna visita nueva.

#### Scenario: Las visitas sobreviven
- **WHEN** un perfil con visitas se archiva y se consulta `GET /api/admin/analytics/views` en un rango que las incluye
- **THEN** sus visitas siguen contando en `total` y el perfil sigue en `byProfile`

#### Scenario: No se registran visitas nuevas
- **WHEN** se pide el slug de un perfil archivado
- **THEN** responde 404 y no se crea ningún `ProfileView`

### Requirement: Resolución por slug anterior
Al renombrarse el `slug` de un perfil, el anterior SHALL registrarse como alias en la misma transacción. La búsqueda por slug SHALL consultar primero los slugs vigentes y después los alias. Cuando resuelve por un alias, la respuesta MUST contener el **slug canónico** del perfil y SHALL incluir la cabecera `Content-Location` con la ruta canónica. Un alias MUST NOT colisionar con el slug vigente de otro perfil ni con otro alias; si el slug vuelve a usarse para el mismo perfil, su alias SHALL eliminarse.

#### Scenario: El link viejo sigue funcionando
- **WHEN** un perfil pasa de `acme-tech-lead` a `acme-lead` y se pide el slug anterior
- **THEN** responde 200 con el perfil, su cuerpo trae `slug: "acme-lead"` y `Content-Location` apunta a la ruta canónica

#### Scenario: El alias no se indexa
- **WHEN** se pide `GET /sitemap.xml` después del renombrado
- **THEN** figura solo la URL canónica y no la del alias

#### Scenario: Colisión de slug con un alias existente
- **WHEN** se intenta crear un perfil con un slug que es alias de otro
- **THEN** responde 409 y no se crea

#### Scenario: Reusar el slug propio borra el alias
- **WHEN** un perfil vuelve a su slug anterior
- **THEN** ese alias desaparece y no queda duplicado

#### Scenario: Un alias de un perfil archivado no resuelve
- **WHEN** se pide el alias de un perfil que está archivado
- **THEN** responde 404, igual que su slug canónico
