# data-persistence-seed Specification (delta)

## ADDED Requirements

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
