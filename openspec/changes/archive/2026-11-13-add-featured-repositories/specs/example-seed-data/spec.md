## MODIFIED Requirements

### Requirement: Archivo de datos de ejemplo
El repositorio SHALL incluir `docs/examples/cv-data.example.json` con el formato de `docs/cv-data.json` y los campos opcionales del formato extendido. Sus datos MUST ser ficticios: sin personas ni empresas reales, con dominios `example.com`, `example.org` o `example.net` y teléfono del rango `+1 555 01xx`. Las únicas excepciones son los `referrer` de las visitas sintéticas y las `url` de repositorios, que usan `https://github.com/portafolio-ejemplo-ficticio/`.

#### Scenario: Persona ficticia
- **WHEN** se buscan en el archivo el `fullName`, el email y el teléfono de `docs/cv-data.json`
- **THEN** no hay ninguna coincidencia y el email del ejemplo termina en `@example.com`

#### Scenario: URLs del ejemplo
- **WHEN** se recorren las `url` de proyectos y enlaces sociales del ejemplo
- **THEN** todas usan `https://` y un dominio reservado de RFC 2606

#### Scenario: URLs de los repositorios del ejemplo
- **WHEN** se recorren las `url` de `profile.featuredRepositories` del ejemplo
- **THEN** todas empiezan con `https://github.com/portafolio-ejemplo-ficticio/` y cumplen la URL de GitHub canónica

### Requirement: Cobertura de entidades y secciones
Tras cargar el ejemplo, cada tabla de contenido SHALL tener al menos una fila. El perfil `all` SHALL devolver las 10 secciones del catálogo con datos. El ejemplo MUST incluir una experiencia actual, una formación en curso, una certificación sin año, un proyecto con `url`, un enlace con `stats` y un ítem con `visible: false` en experiencias, formación, certificaciones, proyectos, enlaces y repositorios.

#### Scenario: Home completa
- **WHEN** se pide `GET /api/curated-profiles/all` contra la base de ejemplo
- **THEN** `sections` contiene `hero`, `stats`, `experience`, `skills`, `projects`, `repositories`, `education`, `certifications`, `presence` y `contact`

#### Scenario: Ítems ocultos
- **WHEN** se compara `GET /api/admin/experiences` con `GET /api/experiences` en la base de ejemplo
- **THEN** la experiencia con `visible: false` aparece solo en la respuesta del panel

#### Scenario: Repositorio oculto
- **WHEN** se compara `GET /api/admin/featured-repositories` con `GET /api/featured-repositories` en la base de ejemplo
- **THEN** el panel lista 3 repositorios y la ruta pública 2

### Requirement: Cobertura de los mecanismos del perfil curado
Las plantillas del ejemplo SHALL ejercer `filterTags`, `includeRefs` (incluida una sobre un ítem oculto), `excludeRefs`, un `sectionsOrder` distinto del canónico con las 10 secciones, `sectionsHidden`, `themeOverrides` con `colors.accent` oscuro, layout `sidebar`, un preset distinto de `modern-dark`, las tres visibilidades, `listed: false`, archivado, un alias de slug y un perfil que resuelve un solo repositorio.

#### Scenario: Override sobre un ítem oculto
- **WHEN** se resuelve la plantilla cuyo `includeRefs` apunta a la experiencia con `visible: false`
- **THEN** esa experiencia no aparece en el perfil resuelto y las demás referencias incluidas sí

#### Scenario: Visibilidades
- **WHEN** se piden los perfiles `PROTECTED` y `PRIVATE` del ejemplo sin token
- **THEN** el protegido responde 401, con el token documentado responde 200, y el privado responde 404

#### Scenario: Alias y archivado
- **WHEN** se pide el alias de slug del ejemplo y después el perfil archivado
- **THEN** el alias resuelve al perfil renombrado y el archivado responde 404

#### Scenario: Umbral de repositorios
- **WHEN** se resuelve `ejemplo-renombrado` contra la base de ejemplo
- **THEN** `repositories` tiene 1 elemento y `sections` no contiene `repositories`

### Requirement: Referencias estables en los overrides
`includeRefs` y `excludeRefs` SHALL aceptar `experience:<id>`, `project:<id>` y `repository:<id>` (el `id` del JSON) y `skill:<nombre>`. El seed SHALL traducirlas a los ids generados y guardarlas en `includeIds`/`excludeIds`. Una referencia inexistente, o una `skill:` repetida en dos categorías, MUST rechazar el archivo antes de borrar nada.

#### Scenario: Referencia resuelta
- **WHEN** se carga una plantilla con `excludeRefs: ["experience:atlas"]`
- **THEN** su `excludeIds` contiene el id generado para esa experiencia

#### Scenario: Referencia inexistente
- **WHEN** se carga un archivo con `includeRefs: ["project:no-existe"]`
- **THEN** el seed termina con código 1, el mensaje nombra la plantilla y la referencia, y la base no cambia

#### Scenario: Referencia a un repositorio
- **WHEN** se carga `ejemplo-overrides`, con `includeRefs` que contiene `repository:experimento-oculto`
- **THEN** su `includeIds` contiene el id generado para ese repositorio
