## Purpose

Asegura que el esquema de base de datos se aplique exclusivamente mediante migraciones versionadas y que la base pueda poblarse, de forma idempotente y verificable, desde la única fuente de verdad de los datos: `docs/cv-data.json`.

## ADDED Requirements

### Requirement: Esquema aplicado mediante migraciones versionadas
El esquema SHALL crearse y evolucionar únicamente con migraciones versionadas en `backend/prisma/migrations/`. El repositorio MUST contener la migración inicial `init` y ningún script del proyecto MUST invocar `prisma db push`.

#### Scenario: Migración inicial versionada
- **WHEN** se ejecuta `npm run prisma:migrate` contra una base vacía
- **THEN** existe `backend/prisma/migrations/<timestamp>_init/migration.sql` con las 14 tablas del schema y `prisma migrate status` reporta la base al día

#### Scenario: Sin db push en scripts
- **WHEN** se inspeccionan los scripts de `backend/package.json`
- **THEN** ninguno contiene `db push`

### Requirement: Seed completo desde cv-data.json
`npm run seed` SHALL cargar la totalidad de `docs/cv-data.json` en la base y terminar con código 0. Los conteos resultantes MUST coincidir con la fuente: 1 `Profile`, 2 `Language`, 15 `Experience`, 12 `SkillCategory`, 108 `Skill`, 6 `Education`, 8 `Certification`, 2 `Project`, 3 `SocialLink`, 0 `FeaturedRepository` (ninguno marcado visible), 5 `Theme`, 14 `CuratedProfile` (13 plantillas + `all`), 0 `ProfileView`.

#### Scenario: Conteos tras el seed
- **WHEN** se ejecuta `npm run seed` sobre una base migrada y luego `npm run seed:verify`
- **THEN** la verificación reporta los conteos indicados y termina con código 0

#### Scenario: Datos bilingües preservados
- **WHEN** se lee la experiencia con `company = "Novacomp"` tras el seed
- **THEN** `role`, `summary` y `highlights` contienen las claves `es` y `en`

### Requirement: Seed idempotente
Ejecutar el seed varias veces SHALL dejar la base en el mismo estado (limpia y recarga), sin duplicar filas.

#### Scenario: Doble ejecución
- **WHEN** se ejecuta `npm run seed` dos veces consecutivas
- **THEN** `npm run seed:verify` reporta exactamente los mismos conteos que tras una sola ejecución

### Requirement: Seed falla claramente sin esquema
Si la base no tiene las tablas (migración no aplicada), el seed MUST terminar con código distinto de 0 y un mensaje que indique el problema.

#### Scenario: Base sin migrar
- **WHEN** se ejecuta `npm run seed` contra una base sin tablas
- **THEN** el proceso termina con código distinto de 0 y el error menciona la tabla inexistente
