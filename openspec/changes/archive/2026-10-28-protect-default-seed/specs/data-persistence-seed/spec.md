# data-persistence-seed Specification (delta)

## ADDED Requirements

### Requirement: Negativa a sobrescribir una base con contenido
Sin `--file`, `npm run seed` SHALL contar antes de escribir las filas de las 13 tablas que limpia (no `AdminUser`). Con todas en cero SHALL cargar sin flags. Con alguna fila MUST terminar con código 2 sin escribir, salvo `--overwrite`. Con `NODE_ENV=production` y contenido MUST exigir además `SEED_ALLOW_PRODUCTION=1`. Si un conteo falla MUST terminar con código 1 sin borrar. `--overwrite` con `--file` MUST terminar con código 1 sin conectarse.

#### Scenario: Base vacía
- **WHEN** se ejecuta `npm run seed` sin flags sobre una base recién migrada, sin filas o solo con `AdminUser`
- **THEN** el seed termina con código 0 y `npm run seed:verify` reporta los conteos de *Seed completo desde cv-data.json*

#### Scenario: Base con contenido sin --overwrite
- **WHEN** se ejecuta `npm run seed` sobre una base que tiene al menos una fila en alguna de las tablas que el seed limpia, por ejemplo solo `Experience`
- **THEN** termina con código 2, el mensaje muestra el destino como `host:puerto/base` sin contraseña, los conteos de las tablas con filas, un `pg_dump` sin contraseña, `npm run seed -- --overwrite` y «No se escribió nada.», y los conteos de la base no cambian

#### Scenario: --overwrite local
- **WHEN** se ejecuta `npm run seed -- --overwrite` sobre una base con contenido y `NODE_ENV` distinto de `production`
- **THEN** el log avisa qué tablas se borran, el seed termina con código 0 y `npm run seed:verify` termina con código 0

#### Scenario: Producción con la base vacía
- **WHEN** se ejecuta `npm run seed` sin flags con `NODE_ENV=production` sobre una base recién migrada
- **THEN** el seed termina con código 0

#### Scenario: Producción sin SEED_ALLOW_PRODUCTION
- **WHEN** se ejecuta `npm run seed -- --overwrite` con `NODE_ENV=production`, sin `SEED_ALLOW_PRODUCTION=1`, sobre una base con contenido
- **THEN** termina con código 2, el mensaje dice que falta `SEED_ALLOW_PRODUCTION=1` y los conteos de la base no cambian

#### Scenario: Producción con la variable y sin --overwrite
- **WHEN** se ejecuta `npm run seed` con `NODE_ENV=production` y `SEED_ALLOW_PRODUCTION=1`, sin `--overwrite`, sobre una base con contenido
- **THEN** termina con código 2 y los conteos de la base no cambian

#### Scenario: Producción con las dos llaves
- **WHEN** se ejecuta `npm run seed -- --overwrite` con `NODE_ENV=production` y `SEED_ALLOW_PRODUCTION=1` sobre una base con contenido
- **THEN** el seed termina con código 0 y `npm run seed:verify` termina con código 0

#### Scenario: Falla al contar
- **WHEN** se ejecuta `npm run seed -- --overwrite` contra una base sin migrar
- **THEN** termina con código 1, el error nombra la tabla inexistente, el mensaje dice «No se escribió nada.» y no se ejecuta ningún `deleteMany`

#### Scenario: --overwrite con --file
- **WHEN** se ejecuta `npm run seed -- --overwrite --file ../docs/examples/cv-data.example.json`
- **THEN** termina con código 1 con un mensaje que dice que `--overwrite` no se combina con `--file`, sin leer el archivo ni conectarse a la base

#### Scenario: Mismas escrituras con la base vacía
- **WHEN** se ejecuta el seed por defecto con un cliente de Prisma simulado que devuelve 0 en cada conteo
- **THEN** las primeras 13 llamadas son los conteos, ninguna escritura las precede, y las escrituras coinciden en cantidad (79) y en digest con la instantánea anterior al formato extendido

## MODIFIED Requirements

### Requirement: Seed completo desde cv-data.json
`npm run seed` SHALL cargar la totalidad de `docs/cv-data.json` en una base migrada sin contenido (con contenido, solo con `--overwrite`) y terminar con código 0. Los conteos MUST coincidir con la fuente: 1 `Profile`, 2 `Language`, 15 `Experience`, 12 `SkillCategory`, 108 `Skill`, 6 `Education`, 8 `Certification`, 2 `Project`, 3 `SocialLink`, 0 `FeaturedRepository` (ninguno visible), 5 `Theme`, 14 `CuratedProfile` (13 plantillas + `all`), 0 `ProfileView`.

#### Scenario: Conteos tras el seed
- **WHEN** se ejecuta `npm run seed` sobre una base migrada y luego `npm run seed:verify`
- **THEN** la verificación reporta los conteos indicados y termina con código 0

#### Scenario: Datos bilingües preservados
- **WHEN** se lee la experiencia con `company = "Novacomp"` tras el seed
- **THEN** `role`, `summary` y `highlights` contienen las claves `es` y `en`

### Requirement: Seed idempotente
Ejecutar el seed varias veces SHALL dejar la base en el mismo estado, sin duplicar filas. Una recarga con `--overwrite` SHALL limpiar y recargar. Una segunda ejecución sin `--overwrite` MUST negarse sin cambiar la base.

#### Scenario: Doble ejecución
- **WHEN** se ejecuta `npm run seed` y después `npm run seed -- --overwrite`
- **THEN** `npm run seed:verify` reporta exactamente los mismos conteos que tras una sola ejecución

#### Scenario: Segunda ejecución sin --overwrite
- **WHEN** se ejecuta `npm run seed` dos veces consecutivas sin flags
- **THEN** la segunda termina con código 2 y `npm run seed:verify` reporta los mismos conteos que tras la primera
