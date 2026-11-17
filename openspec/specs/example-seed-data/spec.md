# example-seed-data Specification

## Purpose
Que exista un conjunto de datos de ejemplo, ficticio y bilingüe, donde se vean todas las entidades, todas las secciones y todos los mecanismos del perfil curado, para aprender a poblar el contenido y como base de referencia del manual. El ejemplo solo se puede cargar en una base descartable y nunca sobre la base del owner.

## Requirements

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

### Requirement: Carga con archivo alternativo
`npm run seed -- --file <ruta>` SHALL cargar el archivo indicado, con la ruta resuelta contra el directorio actual, y `npm run seed:example` SHALL cargar el ejemplo. Antes de cualquier borrado, el seed MUST validar el archivo completo. Si no existe, no es JSON o no cumple el formato, SHALL salir con código 1, nombrar el campo y no escribir nada.

#### Scenario: Archivo inválido
- **WHEN** se ejecuta `npm run seed -- --file` con una plantilla `PROTECTED` sin `accessToken`
- **THEN** el seed termina con código 1, el mensaje nombra `accessToken` y los conteos de la base no cambian

#### Scenario: Ruta inexistente
- **WHEN** se ejecuta `npm run seed -- --file no-existe.json`
- **THEN** el seed termina con código 1 sin conectarse a borrar ninguna tabla

### Requirement: Negativa a cargar sobre una base no descartable
Con `--file`, antes de borrar nada, el seed MUST exigir `SEED_DISPOSABLE_DB=1`, `NODE_ENV` distinto de `production` y una base sin filas de `Profile` o cuyo único `Profile` tenga el `fullName` del archivo. Si falla alguna, SHALL salir con código 2, explicar cuál falló y mostrar la base de destino sin contraseña.

#### Scenario: Base con el perfil del owner
- **WHEN** se ejecuta `npm run seed:example` con `SEED_DISPOSABLE_DB=1` contra una base sembrada con `docs/cv-data.json`
- **THEN** el seed termina con código 2 y los conteos y el `Profile` de esa base no cambian

#### Scenario: Sin la variable
- **WHEN** se ejecuta `npm run seed:example` sin `SEED_DISPOSABLE_DB=1` contra una base vacía
- **THEN** el seed termina con código 2 y la base sigue vacía

#### Scenario: Recarga del ejemplo
- **WHEN** se ejecuta `npm run seed:example` dos veces seguidas con `SEED_DISPOSABLE_DB=1` sobre una base migrada vacía
- **THEN** las dos terminan con código 0 y `npm run seed:example:verify` reporta los mismos conteos

### Requirement: Verificación del ejemplo
`npm run seed:verify -- --file <ruta>` y `npm run seed:example:verify` SHALL comparar la base con el archivo: los conteos de cada tabla (`CuratedProfileSlugAlias` y `ProfileView` incluidas) y, por plantilla, visibilidad, `listed`, archivado, layout, tema, secciones, alias e ids de los overrides. Terminan con 0 si todo coincide, o con 1 nombrando lo que difiere.

#### Scenario: Verificación tras la carga
- **WHEN** se ejecuta `npm run seed:example:verify` justo después de `npm run seed:example`
- **THEN** termina con código 0

#### Scenario: Un mecanismo distinto
- **WHEN** se cambia en la base el `listed` del perfil dirigido y se ejecuta `npm run seed:example:verify`
- **THEN** termina con código 1 nombrando el slug y el campo

### Requirement: Visitas sintéticas deterministas
`exampleViews` SHALL generar `count` visitas por entrada. La visita *i* cae `i % daysBack` días antes de la carga, con `locales[i % n]`, `referrers[i % m]`, `userAgent: "example-seed"` e `ipHash: null`. El seed SHALL dejar el contador `views` del perfil igual a su total. Sin `exampleViews` no se crea ninguna visita.

#### Scenario: Dashboard con datos
- **WHEN** se abre `/admin` en el rango de 30 días tras cargar el ejemplo
- **THEN** el total de visitas es la suma de los `count` y la tabla por origen lista los `referrers` del archivo

#### Scenario: Visitas del archivado
- **WHEN** se lee la analítica del perfil archivado del ejemplo
- **THEN** conserva sus visitas sintéticas aunque su slug responda 404

### Requirement: Traducciones completas salvo un faltante deliberado
Todo campo bilingüe del ejemplo SHALL tener `es` y `en`, salvo `description.en` del perfil `PRIVATE`, que falta a propósito. Un test sin base SHALL comprobar con `detectMissingTranslations` que ese es el único faltante en ES y en EN para `all` y cada plantilla.

#### Scenario: Único faltante
- **WHEN** corre el test de traducciones sobre `docs/examples/cv-data.example.json`
- **THEN** reporta solo `curatedProfile.description` en EN del perfil privado

### Requirement: Guía campo por campo
`docs/DATA-POPULATION.md` SHALL documentar cada campo del formato, extendido incluido, con su tipo, si es obligatorio, su valor por defecto, un ejemplo del archivo, dónde se ve y qué pantalla del panel lo edita (o "solo por la API" o "solo en el seed"). También SHALL explicar paso a paso cómo crear, sembrar y borrar la base de ejemplo.

#### Scenario: Campo documentado
- **WHEN** se toma cualquier clave de `docs/examples/cv-data.example.json`
- **THEN** la guía tiene una fila para ella con las seis columnas completas

#### Scenario: Override solo por la API
- **WHEN** se lee la fila de `includeRefs` en la guía
- **THEN** dice que el constructor solo ofrece incluir y excluir experiencias, y que skills y proyectos se editan por la API

### Requirement: Certificaciones verificables en el ejemplo
El ejemplo SHALL incluir una certificación visible con `verificationUrl` https de un dominio de RFC 2606, `credentialId` y `expiresAt` futuro, y otra visible con `expiresAt` pasado y sin `verificationUrl`. Los conteos de certificaciones del ejemplo MUST NOT cambiar por esto.

#### Scenario: Credencial vigente
- **WHEN** se pide `GET /api/certifications` contra la base de ejemplo
- **THEN** una certificación trae `verificationUrl` con `https://` y dominio `example.org`, `credentialId` no nulo y `expiresAt` posterior a 2026

#### Scenario: Credencial vencida sin enlace
- **WHEN** se abre `/` contra la base de ejemplo con la fecha del navegador en octubre de 2026
- **THEN** una certificación muestra «Vencida» y no tiene enlace «Ver credencial»

#### Scenario: Verificación del ejemplo
- **WHEN** se ejecuta `npm run seed:example:verify` justo después de `npm run seed:example`
- **THEN** termina con código 0 y compara también los campos de credencial
