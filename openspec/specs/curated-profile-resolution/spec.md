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
El sistema SHALL devolver la lista final de secciones visibles: `sectionsOrder` (o, si está vacío, el orden por defecto `hero, stats, experience, skills, education, certifications, contact`) sin las que figuran en `sectionsHidden`. Las secciones ocultas SHALL informarse aparte.

#### Scenario: Orden personalizado con ocultas
- **WHEN** `sectionsOrder = ["hero","skills","experience","contact"]` y `sectionsHidden = ["skills"]`
- **THEN** `sections = ["hero","experience","contact"]` y `hiddenSections = ["skills"]`

#### Scenario: Orden vacío usa el default
- **WHEN** `sectionsOrder = []` y `sectionsHidden = []`
- **THEN** `sections` es el orden por defecto completo

### Requirement: Resultado listo para presentación
La vista resuelta SHALL contener: metadatos del perfil curado (`slug`, `title`, `headline`, `description`, `roleType`, `techFocus`, `accentColor`, `layout`, `visibility`), `sections`/`hiddenSections`, el `theme` resuelto (ver `theme-resolution`), el perfil base (`profile`, misma forma que `public-profile-api`), las `experiences` (misma forma que `public-experience-api`) y `skillCategories[] { name, skills[] }`. Todos los campos traducibles SHALL venir resueltos al locale pedido; la salida MUST NOT contener `accessToken`, `includeIds`, `excludeIds` ni `filterTags`.

#### Scenario: Forma completa
- **WHEN** se resuelve un perfil `PUBLIC`
- **THEN** el resultado tiene las claves `slug, title, headline, description, roleType, techFocus, accentColor, layout, visibility, sections, hiddenSections, theme, profile, experiences, skillCategories`

#### Scenario: Sin datos sensibles ni internos
- **WHEN** se resuelve un perfil `PROTECTED` con token válido
- **THEN** el resultado no contiene `accessToken`, `includeIds`, `excludeIds` ni `filterTags`

#### Scenario: Locale aplicado a todo el árbol
- **WHEN** se resuelve con locale `en`
- **THEN** `title`, `roleType`, `profile.headline`, `experiences[].role` y `skillCategories[].name` vienen en inglés, y ningún valor es un objeto `{es,en}`

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
