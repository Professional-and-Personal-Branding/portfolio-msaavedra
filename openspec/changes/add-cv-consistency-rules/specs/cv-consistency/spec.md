## ADDED Requirements

### Requirement: Cálculo de los años de experiencia
`computeYearsOfExperience(intervalos, asOf)` SHALL ser una función pura que cuenta meses inclusivos de `YYYY-MM`, fusiona intervalos solapados o contiguos, termina en `asOf` los actuales o sin fin, recorta a `asOf` y descarta los inválidos o con fin anterior al inicio. SHALL devolver `months`, `years = floor(months / 12)` y `remainderMonths`.

#### Scenario: Solapados y contiguos
- **WHEN** los intervalos son `2018-02`–`2019-04`, `2019-01`–`2020-07` y `2020-08`–`2020-12`
- **THEN** el resultado es 35 meses: 2 años y 11 meses

#### Scenario: Experiencia actual
- **WHEN** hay un único intervalo `2025-01` actual y `asOf` es `2026-11`
- **THEN** el resultado es 23 meses

#### Scenario: Un subconjunto nunca supera al total
- **WHEN** se calcula sobre un subconjunto cualquiera de los intervalos
- **THEN** sus meses son menores o iguales que los del conjunto completo

### Requirement: Años declarados contra las fechas
La regla `profile.years-mismatch` (warning) SHALL emitirse si `Profile.yearsOfExperience` queda fuera de `[floor(m/12), ceil(m/12)]`, con `m` los meses de todas las experiencias, visibles u ocultas. Sin experiencias no SHALL emitirse. Sus `params` SHALL ser `declared`, `months`, `years` y `remainderMonths`. El valor declarado MUST NOT modificarse.

#### Scenario: Declarado por encima de las fechas
- **WHEN** el perfil declara 10 años y las experiencias suman 103 meses
- **THEN** hay un issue `profile.years-mismatch` sobre el perfil con `years` 8 y `remainderMonths` 7

#### Scenario: Redondeo aceptado
- **WHEN** las experiencias suman 103 meses y el perfil declara 9
- **THEN** no hay issue de años

### Requirement: Forma de un hallazgo
Cada hallazgo SHALL llevar un `code` del catálogo cerrado, una `severity` (`error`: la API la rechazaría o rompe el render; `warning`: descuido visible; `info`: suele ser legítimo), `entityType`, el `entityId` exacto, `field` o null y `params`. Las reglas SHALL ser funciones puras sin efectos ni textos.

#### Scenario: Ítem exacto
- **WHEN** la experiencia `exp1` tiene `endDate` anterior a `startDate`
- **THEN** el hallazgo es `date.end-before-start`, severidad `error`, `entityType` `experience` y `entityId` `exp1`

### Requirement: Reglas de fechas
SHALL emitirse con severidad `error`: `date.invalid-format` (experiencia fuera de YYYY-MM; formación fuera de YYYY-MM o YYYY; `year` o `expiresAt` de certificación con otro formato), `date.end-before-start` (formación comparada a la menor precisión) y `date.ongoing-with-end` (`current` o `inProgress` con fin), sobre ítems visibles u ocultos.

#### Scenario: Mes inexistente
- **WHEN** una experiencia oculta tiene `startDate` `2024-13`
- **THEN** hay un `date.invalid-format` sobre ella con `field` `startDate`

#### Scenario: Precisiones distintas
- **WHEN** una formación va de `2021-03` a `2021`
- **THEN** no hay `date.end-before-start`

#### Scenario: Actual con fin
- **WHEN** una experiencia tiene `current` verdadero y `endDate` `2024-05`
- **THEN** hay un `date.ongoing-with-end` sobre ella

### Requirement: Varias experiencias actuales
Si hay más de una experiencia visible marcada como actual, SHALL emitirse `experience.multiple-current` (info) sobre cada una, con `params.count`.

#### Scenario: Dos actuales
- **WHEN** dos experiencias visibles tienen `current` verdadero
- **THEN** hay dos issues `experience.multiple-current` con `count` 2

#### Scenario: Una actual oculta
- **WHEN** hay una experiencia actual visible y otra actual oculta
- **THEN** no hay issue `experience.multiple-current`

### Requirement: Reglas de traducción
`i18n.missing-translation` (warning) SHALL emitirse por campo e idioma cuando ese idioma está vacío y otro tiene contenido, en ítems visibles y perfiles curados no archivados, con el mismo predicado y campos que el aviso del constructor. `i18n.highlights-count-mismatch` (warning) SHALL emitirse si los logros tienen contenido en ES y EN con distinta cantidad.

#### Scenario: Falta el inglés
- **WHEN** una experiencia visible tiene `summary.es` y `summary.en` vacío
- **THEN** hay un `i18n.missing-translation` con `field` `summary` y `params.locale` `en`

#### Scenario: Igual en los dos idiomas
- **WHEN** el `roleType` de un perfil curado es `Tech Lead` en ES y en EN
- **THEN** no hay issue de traducción por ese campo

#### Scenario: Logros desparejos
- **WHEN** una experiencia tiene 4 logros en ES y 3 en EN
- **THEN** hay un `i18n.highlights-count-mismatch` con `params` `es` 4 y `en` 3

### Requirement: Reglas de URLs y vencimiento
SHALL emitirse `url.invalid` (error) para una URL no parseable o no http(s) en proyectos y enlaces, y para una no https en `verificationUrl`; `url.not-https` (warning) para un `http:` válido en proyectos y enlaces; y `certification.expired` (info) para una certificación visible con `expiresAt` anterior a `asOf`.

#### Scenario: Proyecto en http
- **WHEN** un proyecto tiene `url` `http://ejemplo.com`
- **THEN** hay un `url.not-https` sobre el proyecto con `field` `url`

#### Scenario: Verificación sin https
- **WHEN** una certificación tiene `verificationUrl` `http://emisor.example/x`
- **THEN** hay un `url.invalid` de severidad `error` sobre ella

#### Scenario: Vencida
- **WHEN** una certificación visible tiene `expiresAt` `2025-12` y `asOf` es `2026-11`
- **THEN** hay un `certification.expired` sobre ella

### Requirement: Reglas de los perfiles curados
Sobre perfiles no archivados SHALL emitirse: `curated.orphan-reference` (warning) por id de `includeIds`/`excludeIds` sin experiencia, skill ni proyecto; `curated.conflicting-reference` (info) por id en ambas listas; `curated.unmatched-filter-tag` (warning) por tag sin ítem visible que lo tenga; y `curated.no-experiences` (warning) si `selectByTags` no devuelve experiencias visibles.

#### Scenario: Referencia huérfana
- **WHEN** un perfil tiene en `excludeIds` un id que no existe
- **THEN** hay un `curated.orphan-reference` sobre el perfil con ese id y `list` `excludeIds`

#### Scenario: Id de un ítem oculto
- **WHEN** `includeIds` tiene el id de una experiencia oculta
- **THEN** no hay `curated.orphan-reference` por ese id

#### Scenario: Tag sin coincidencias
- **WHEN** un perfil tiene el `filterTag` `cobol` y ningún ítem visible lo tiene
- **THEN** hay un `curated.unmatched-filter-tag` con `tag` `cobol`

#### Scenario: Perfil archivado
- **WHEN** un perfil archivado tiene referencias huérfanas
- **THEN** no hay hallazgos sobre ese perfil

### Requirement: Errores independientes de la fecha
Ninguna regla de severidad `error` MUST depender de `asOf`. `asOf` SHALL ser el mes UTC del reloj inyectado en la API y `--as-of` o el mes UTC actual en la línea de comandos.

#### Scenario: Dos meses distintos
- **WHEN** se corren las reglas sobre el mismo contenido con `asOf` `2026-11` y `2031-01`
- **THEN** los hallazgos de severidad `error` son idénticos

### Requirement: Revisión del CV por la API del panel
`GET /api/admin/consistency` SHALL exigir sesión de administrador, leer el contenido con una consulta por repositorio sin escribir nada y responder 200 con `asOf`, `experience` (declarado y meses, o null), `summary` y `issues` con `message` y `entityLabel` resueltos en el idioma pedido, ordenados por severidad, entidad, etiqueta y código, con `Cache-Control: no-store`.

#### Scenario: Sin sesión
- **WHEN** se pide `GET /api/admin/consistency` sin cookie ni Bearer
- **THEN** la respuesta es 401

#### Scenario: Mensaje en inglés
- **WHEN** se pide con `?locale=en` y hay un issue de años
- **THEN** su `message` está en inglés y `code` sigue siendo `profile.years-mismatch`

#### Scenario: Sin consultas por ítem
- **WHEN** el caso de uso corre sobre 15 experiencias y 14 perfiles curados
- **THEN** cada repositorio se consulta una sola vez y ninguno recibe una escritura

### Requirement: Revisión del CV desde la línea de comandos
`npm run cv:lint` SHALL correr las mismas reglas sobre un archivo del seed (por defecto `docs/cv-data.json`, otro con `--file`) sin abrir la base, y salir con 0 sin errores, 1 con algún `error` y 2 si el archivo no existe o el parser del seed lo rechaza. Los avisos y sugerencias MUST NOT cambiar el código de salida.

#### Scenario: Error sembrado
- **WHEN** se corre sobre una copia del ejemplo con una experiencia `current` y `endDate`
- **THEN** imprime un `date.ongoing-with-end` con la clave de esa experiencia y sale con 1

#### Scenario: Solo avisos
- **WHEN** el archivo solo produce el aviso de años
- **THEN** imprime el aviso y sale con 0

#### Scenario: Archivo inexistente
- **WHEN** se pasa `--file` con una ruta que no existe
- **THEN** sale con 2 sin correr reglas
