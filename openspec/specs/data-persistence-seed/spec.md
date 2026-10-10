# data-persistence-seed Specification

## Purpose
Asegura que el esquema de base de datos se aplique exclusivamente mediante migraciones versionadas y que la base pueda poblarse, de forma idempotente y verificable, desde la única fuente de verdad de los datos: `docs/cv-data.json`.

## Requirements

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

### Requirement: Migración del acento de los perfiles al tema
La migración `retire_accent_color` SHALL copiar el `accentColor` de cada perfil curado a `themeOverrides.colors.accent` y después borrar la columna. MUST NOT pisar un `colors.accent` existente, MUST conservar las demás claves de `themeOverrides` y de `colors`, y SHALL tratar `themeOverrides` nulo como objeto vacío. La copia SHALL ser idempotente. Se aplica solo con `prisma migrate deploy`.

#### Scenario: themeOverrides nulo
- **WHEN** se migra un perfil con `accentColor: "#065F46"` y `themeOverrides` nulo
- **THEN** su `themeOverrides` queda `{ "colors": { "accent": "#065F46" } }`

#### Scenario: themeOverrides sin colors
- **WHEN** se migra un perfil con `accentColor: "#9B1C2E"` y `themeOverrides: { "layout": { "radius": "8px" } }`
- **THEN** su `themeOverrides` queda `{ "layout": { "radius": "8px" }, "colors": { "accent": "#9B1C2E" } }`

#### Scenario: colors sin accent
- **WHEN** se migra un perfil con `accentColor: "#0078D4"` y `themeOverrides: { "colors": { "bg": "#000000" } }`
- **THEN** su `themeOverrides.colors` queda `{ "bg": "#000000", "accent": "#0078D4" }`

#### Scenario: El override existente no se pisa
- **WHEN** se migra un perfil con `accentColor: "#0F766E"` y `themeOverrides: { "colors": { "accent": "#f97316" } }`
- **THEN** su `themeOverrides` no cambia

#### Scenario: Columna borrada
- **WHEN** termina `prisma migrate deploy`
- **THEN** la tabla `CuratedProfile` no tiene la columna `accentColor` y `prisma migrate status` no reporta migraciones pendientes

#### Scenario: Base vacía
- **WHEN** la migración se aplica sobre una base sin perfiles curados, como la de producción al nacer
- **THEN** termina sin error y la tabla queda sin la columna

### Requirement: Acento de las plantillas en el tema
Cada plantilla de `profileTemplates` en `docs/cv-data.json` SHALL declarar su acento como `themeOverrides.colors.accent` y MUST NOT tener `accentColor`. El seed SHALL guardar ese `themeOverrides` tal cual, y el perfil `all` SHALL crearse con `colors.accent` igual al del preset `modern-dark`. Tras el seed, cada perfil SHALL tener el mismo `colors.accent` que tendría tras la migración.

#### Scenario: Acento de una plantilla tras el seed
- **WHEN** se ejecuta `npm run seed` sobre una base migrada
- **THEN** `java-senior-backend` tiene `themeOverrides.colors.accent: "#1A365D"` y `fullstack-nest-react` tiene `"#065F46"`

#### Scenario: Verificación del seed
- **WHEN** se ejecuta `npm run seed:verify` tras el seed
- **THEN** la verificación compara el `colors.accent` de cada plantilla con `cv-data.json` y termina con código 0

#### Scenario: Fuente sin el campo retirado
- **WHEN** se busca `accentColor` en `docs/cv-data.json`
- **THEN** no hay ninguna coincidencia

### Requirement: Migración del nivel de idioma a texto bilingüe
La migración `localize_language_level` SHALL cambiar `Language.level` a `JSONB` en la misma fila, sin borrar ni agregar filas. Un nivel conocido en español SHALL quedar `{ es, en }` según la tabla de D2 del change; un código MCER, `{ es: x, en: x }`; cualquier otro texto, `{ es: x }`. El español MUST conservar lo escrito, sin espacios al borde. Se aplica solo con `prisma migrate deploy`.

#### Scenario: Nivel conocido
- **WHEN** se migra un idioma con `level` `"Nativo"`
- **THEN** su `level` queda `{ "es": "Nativo", "en": "Native" }`

#### Scenario: Mayúsculas y espacios
- **WHEN** se migra un idioma con `level` `" avanzado "`
- **THEN** su `level` queda `{ "es": "avanzado", "en": "Advanced" }`

#### Scenario: Código MCER
- **WHEN** se migran idiomas con `level` `"B1-B2"`, `"C1"` y `"B2+"`
- **THEN** quedan `{ "es": "B1-B2", "en": "B1-B2" }`, `{ "es": "C1", "en": "C1" }` y `{ "es": "B2+", "en": "B2+" }`

#### Scenario: Texto desconocido
- **WHEN** se migra un idioma con `level` `"Nivel de supervivencia"`
- **THEN** su `level` queda `{ "es": "Nivel de supervivencia" }`, sin `en`

#### Scenario: Sin pérdida de filas
- **WHEN** termina `prisma migrate deploy` sobre una base con idiomas
- **THEN** la cantidad de filas de `Language` no cambia, la columna `level` es `jsonb` no nula y `prisma migrate status` no reporta pendientes

#### Scenario: Base vacía
- **WHEN** la migración se aplica sobre una base sin idiomas, como la de producción al nacer
- **THEN** termina sin error y la columna queda `jsonb`

### Requirement: Nivel de idioma bilingüe en la fuente del seed
Cada idioma de `profile.languages` en `docs/cv-data.json` SHALL declarar `level` como `{ es, en }`. El seed SHALL guardarlo tal cual y `seed:verify` SHALL comparar el `level` de cada idioma de la base con la fuente. Una base sembrada SHALL tener el mismo `level` que la migración produce para esos valores.

#### Scenario: Nivel tras el seed
- **WHEN** se ejecuta `npm run seed` sobre una base migrada
- **THEN** el idioma `Español` tiene `level: { "es": "Nativo", "en": "Native" }` y `Inglés` tiene `level: { "es": "B1-B2", "en": "B1-B2" }`

#### Scenario: Verificación del seed
- **WHEN** se ejecuta `npm run seed:verify` tras el seed
- **THEN** compara el `level` de cada idioma con `cv-data.json` y termina con código 0

#### Scenario: Verificación con un nivel distinto
- **WHEN** se cambia en la base el `level.en` de un idioma y se ejecuta `npm run seed:verify`
- **THEN** termina con código distinto de 0 nombrando el idioma
