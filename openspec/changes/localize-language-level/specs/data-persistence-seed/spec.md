## ADDED Requirements

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
