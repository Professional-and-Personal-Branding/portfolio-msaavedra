# Design — add-cv-consistency-rules

## Context

Ver `proposal.md`. Estado verificado el 7 de noviembre de 2026 sobre `main` (`e337efd`):

- **No existe nada parecido a `computeYearsOfExperience`.** `yearsOfExperience` se lee y se escribe tal cual: `Profile.yearsOfExperience Int @default(0)`, `validateProfileContent` exige un entero ≥ 0, el hero lo muestra y `frontend/src/shared/lib/stats.ts` lo copia a las estadísticas.
- **Validación al escribir, no al sembrar.** `validateExperience` (YYYY-MM, `current` excluye `endDate`, inicio ≤ fin), `validateEducation` (YYYY-MM o YYYY, comparación a la menor precisión, `inProgress` excluye `endDate`), `validateCertification` (https, `year` YYYY, `expiresAt` AAAA-MM o AAAA), `validateProject` y `validateSocialLink` (URL http(s)) corren en los casos de uso del panel. El seed (`scripts/lib/seed-source.ts`) aplica `validateCertification`, pero de las experiencias solo valida que los campos sean texto: un `2024-13` llega a la base.
- **Faltantes de traducción.** `curated-profile/application/services/detect-missing-translations.ts` implementa la regla D4 de `add-bilingual-builder-parity` (falta = vacío en el idioma pedido y con contenido en otro) para un perfil curado ya compuesto y un solo idioma. Lo usa el preview del constructor.
- **Selección.** `selectByTags` (tags exactos, `excludeIds` gana, `includeIds` fuerza) es puro y está en `curated-profile/domain/services`. Los ids de `includeIds`/`excludeIds` son cuid compartidos entre experiencias, skills y proyectos (`add-builder-skill-project-overrides`).
- **Repositorios.** Todos tienen `findAll()`: experiencias, categorías con sus skills (`include`), educación, certificaciones, proyectos, enlaces sociales y perfiles curados. `ProfileRepository.findOne()` trae los idiomas (`include`). `CuratedProfileModule` exporta solo dos casos de uso, no el token de su repositorio.
- **Panel.** Rutas planas bajo `/admin` (`BackofficeApp.tsx`), navegación en `NAV` (`AdminShell.tsx`). Ninguna pantalla de listas acepta hoy un parámetro para abrir un ítem.
- **Tests.** Jest con `ts-jest`. `fast-check` **no** está en `backend/package.json` ni en `frontend/package.json`.
- **Datos reales** (medidos con un script de solo lectura sobre los dos JSON):
  - `cv-data.json`: `yearsOfExperience = 10` contra 103 meses fusionados (8,58 años); ninguna experiencia `current`; varias superpuestas legítimamente (Eron y K27 en 2023, NSoft de 2019 a 2022 con otras cuatro).
  - De 108 skills del catálogo, 63 no coinciden literalmente con ninguna tecnología de experiencias o proyectos, y 38 tecnologías no están en el catálogo («Java (8-21)» contra «Java», «Node.js» contra «Express.js»).
  - Ninguna plantilla tiene `filterTags` sin coincidencia y ningún logro tiene distinta cantidad en ES y EN.
  - El ejemplo (`cv-data.example.json`) declara 11 años contra 143 meses (11,92) con `asOf` `2026-11`: consistente en ese mes (ver Risks). Tiene una certificación vencida (`2025-12`).

## Goals / Non-Goals

**Goals:** que el owner vea en una pantalla todo lo que contradice al propio CV, con el ítem exacto y un enlace para corregirlo; que las mismas reglas corran sin base contra el archivo del seed y frenen el CI ante un error real; que el cálculo de años sea una función pura, probada por propiedades y reutilizable por la capa 2 y por la carta con evidencia; que nada de esto toque lo público ni escriba en la base.

**Non-Goals:** ver `proposal.md` § Non-goals.

## Decisions

### D1 — Módulo `cv-consistency` con una instantánea propia y reglas puras

- `backend/src/modules/cv-consistency/` con las tres capas. El dominio define `CvSnapshot`, una estructura de datos de solo lectura (sin clases ni métodos) con lo que las reglas miran:
  - `profile`: `id`, `fullName`, `yearsOfExperience` y los textos bilingües;
  - `languages` y `experiences` (`id`, `company`, fechas, `current`, `visible`, `tags`, textos bilingües);
  - `skillCategories` con `skills` (`id`, `name`, `tags`);
  - `education`, `certifications`, `projects` y `socialLinks`;
  - `curatedProfiles`: `id`, `slug`, `archived`, `filterTags`, `includeIds`, `excludeIds` y los textos bilingües.
- Cada regla es una función pura `(snapshot: CvSnapshot, ctx: CvRuleContext) => CvIssue[]`, con `ctx = { asOf: YearMonth }`. `runCvRules(snapshot, ctx)` las aplica todas en un orden fijo y concatena.
- La aplicación traduce entidades a instantánea (`toCvSnapshot`) y el script traduce el archivo del seed (`seedToCvSnapshot`). Las reglas no conocen ni las entidades ni el JSON.
- El dominio de `cv-consistency` puede importar funciones puras de otros dominios (`computeYearsOfExperience`, `selectByTags`, `isMissingTranslation`, los regex de fechas e `isHttpsUrl`). Es la misma dirección que ya usan `curated-profile` y el seed, y el test de arquitectura lo permite (solo prohíbe Nest, Prisma, `application` e `infrastructure` en `domain`).

Alternativas descartadas:
- **Reglas sobre las clases de entidad.** El script tendría que construir entidades desde el JSON con ids inventados y pasar por fábricas que validan: justo lo que el linter tiene que poder mirar roto.
- **Reglas dentro de cada módulo** (`experience` revisa experiencias, etc.). Las reglas cruzadas (años, perfiles curados contra todo el catálogo) no tendrían dueño, y el caso de uso tendría que juntar resultados de siete módulos.
- **Dentro de `curated-profile`.** El linter mira el CV entero, no un perfil; mezclarlo engorda el núcleo del producto.

### D2 — `computeYearsOfExperience` en `profile/domain/services`, por meses inclusivos

```ts
export interface ExperienceInterval { startDate: string; endDate: string | null; current: boolean }
export interface YearsOfExperience { months: number; years: number; remainderMonths: number }
export function computeYearsOfExperience(
  intervals: readonly ExperienceInterval[], asOf: YearMonth,
): YearsOfExperience;
```

- Las fechas son `YYYY-MM`. Un intervalo cubre desde el mes de inicio **hasta el de fin, ambos incluidos**: `2018-02` a `2019-04` son 15 meses.
- Un intervalo `current` (o sin `endDate`) termina en `asOf`. Uno con fechas inválidas, con fin anterior al inicio o que empieza después de `asOf` se ignora: esos casos los reportan las reglas de fechas, no el cálculo. Un `endDate` posterior a `asOf` se recorta a `asOf`.
- Se ordenan por inicio y se fusionan los que se solapan **o son contiguos** (uno termina en `2020-07` y el otro empieza en `2020-08`). `months` es la suma de los tramos fusionados, `years = floor(months / 12)` y `remainderMonths = months % 12`.
- La entrada es una lista genérica: sirve para el total y para cualquier subconjunto (por tag, por tecnología). Es lo que necesitan la carta con evidencia (2.3) y una futura insignia por skill.
- Vive donde lo ubicó la propuesta (§ 5.1). Es puro y no depende de `Profile`.

Alternativas descartadas:
- **Por días con `Date`.** Las fechas del CV son mensuales; los días agregan zona horaria y años bisiestos sin ganar precisión.
- **Meses exclusivos** (fin − inicio). Una experiencia de un solo mes (`2021-06` a `2021-06`) valdría 0.
- **Sumar sin fusionar.** Con trabajos en paralelo, el total superaría el tiempo transcurrido.

### D3 — Regla de años: todas las experiencias, tolerancia de redondeo y severidad `warning`

- `profile.years-mismatch` compara `Profile.yearsOfExperience` (Y) con `computeYearsOfExperience(todas las experiencias, asOf)`, **incluidas las ocultas**: ocultar una experiencia de la vista no le quita años a la carrera.
- Y es consistente si `floor(months / 12) ≤ Y ≤ ceil(months / 12)`: admite redondear para arriba o para abajo, nunca más. Con 103 meses valen 8 o 9; el 10 del owner da el aviso.
- Sin experiencias, la regla no emite nada: no hay fechas contra las cuales contrastar.
- Severidad `warning`: puede haber experiencia anterior que no está cargada. El mensaje da los dos números y el owner decide (pregunta 20 = A).
- `params`: `declared`, `months`, `years`, `remainderMonths`. La respuesta del endpoint repite el par declarado y derivado en `experience` (D10).

Alternativas descartadas:
- **Tolerancia de ±1 año.** Con 103 meses aceptaría 7 y 10: un 10 declarado sobre 8 años y 7 meses es exactamente lo que hay que ver.
- **Solo experiencias visibles.** Un perfil con experiencias viejas ocultas daría un aviso falso.
- **`error`.** Bloquearía `cv:lint` en el CI por una decisión editorial, y además dependería del calendario (D11).

### D4 — Catálogo de 14 reglas y significado de las severidades

- **`error`**: el dato viola una regla que la API del panel rechazaría, o rompe el render. Solo puede venir del seed, de SQL directo o de datos anteriores a una validación.
- **`warning`**: probablemente es un descuido y lo ve un reclutador.
- **`info`**: conviene mirarlo, pero suele ser legítimo.

| Código | Sev. | Entidad | Qué detecta |
|---|---|---|---|
| `profile.years-mismatch` | warning | profile | D3 |
| `date.invalid-format` | error | experience, education, certification | `startDate`/`endDate` fuera de YYYY-MM (experiencia) o de YYYY-MM/YYYY (formación); `year` fuera de YYYY o `expiresAt` fuera de AAAA-MM/AAAA (certificación) |
| `date.end-before-start` | error | experience, education | fin anterior al inicio (formación: a la menor precisión, como `validateEducation`) |
| `date.ongoing-with-end` | error | experience, education | `current` o `inProgress` con fecha de fin |
| `experience.multiple-current` | info | experience | más de una experiencia actual y visible: un issue por cada una |
| `i18n.missing-translation` | warning | las de D7 | D7 |
| `i18n.highlights-count-mismatch` | warning | experience | logros con contenido en los dos idiomas pero distinta cantidad |
| `url.invalid` | error | certification, project, socialLink | URL no parseable o no http(s); en certificación, cualquier URL que no sea https |
| `url.not-https` | warning | project, socialLink | URL `http:` válida |
| `certification.expired` | info | certification | visible y con `expiresAt` anterior a `asOf` (misma regla que `certificationValidity` del cliente) |
| `curated.orphan-reference` | warning | curatedProfile | id de `includeIds`/`excludeIds` que no es ninguna experiencia, skill ni proyecto |
| `curated.conflicting-reference` | info | curatedProfile | el mismo id en `includeIds` y `excludeIds` (gana la exclusión) |
| `curated.unmatched-filter-tag` | warning | curatedProfile | un `filterTag` que no tiene ninguna experiencia, skill ni proyecto visible |
| `curated.no-experiences` | warning | curatedProfile | `selectByTags` sobre las experiencias visibles devuelve cero |

- Los códigos son un enum cerrado (`CvIssueCode`) y estables: un cambio de texto no cambia el código. Agregar uno es un cambio de spec.
- Las reglas de perfiles curados reutilizan `selectByTags` y `matchesAnyTag` tal cual, sin normalizar: si el sitio no lo seleccionaría, el linter tampoco.

Alternativa descartada: **solo dos severidades**. `experience.multiple-current` y `certification.expired` son legítimos muy a menudo; si fueran `warning`, el owner aprendería a ignorar la columna.

### D5 — Reglas candidatas que quedan fuera de la capa 1

- **Solapamientos «raros».** En el CV real hay trabajos en paralelo legítimos (consultoría, freelance, NSoft con otras cuatro). No hay un criterio determinista para «raro» que no genere ruido; los solapamientos sí se fusionan en D2.
- **Skills del catálogo sin uso, y tecnologías fuera del catálogo.** Con coincidencia literal dan 63 y 38 hallazgos sobre el CV real, casi todos variantes del mismo nombre. Sin un diccionario de equivalencias no hay regla útil; esa normalización es la del ítem 1.4 (`computeTagCoverage`).
- **Respaldo temporal por skill** («años con X»). Las skills no tienen fechas y sus tags salen de una heurística por categoría (`tagsForSkillCategory`): cualquier número sería discutible. La idea `skills-con-respaldo-temporal` sigue diferida (ROADMAP-1.1 § 5) y este change deja lo que pedía como condición: la función de D2 y su test de propiedades, que también cubre subconjuntos (D14).
- **Más de una experiencia actual como `error`.** Queda como `info` (D4).

### D6 — Qué ítems mira cada regla

- **Fechas y URLs:** todos los ítems, visibles u ocultos. Un dato roto lo es aunque esté oculto, y el panel no deja guardarlo hasta corregirlo.
- **Traducciones, vencidas y `multiple-current`:** solo ítems visibles. Lo oculto no lo ve nadie.
- **Perfiles curados:** todos los no archivados, cualquiera sea su visibilidad (un PRIVATE es el borrador de un envío). Los archivados no se revisan: responden 404.
- **`curated.unmatched-filter-tag` y `curated.no-experiences`:** contra los ítems visibles, como la selección pública. `curated.orphan-reference`: contra todos, porque un id de un ítem oculto no es huérfano.

### D7 — Faltantes de traducción: el mismo predicado del constructor, en los dos idiomas

- Se extrae `isMissingTranslation(field, locale)` a `shared/domain/i18n/missing-translation.ts`, con la misma regla D4 de `add-bilingual-builder-parity`: falta si el idioma está ausente, vacío o es una lista vacía **y** otro idioma tiene contenido; igual al otro idioma no es faltante; un dato plano legado no se reporta. `detectMissingTranslations` pasa a importarlo: sus tests no cambian.
- El linter recorre **los dos idiomas** (`SUPPORTED_LOCALES`) y emite un issue por campo e idioma, con `params.locale`. Cubre los mismos campos que el detector del constructor: perfil base y disponibilidad, idiomas, experiencias, categorías de skills, proyectos, formación, certificaciones, enlaces sociales y perfiles curados. Los nombres de skills son planos y no se revisan.
- `i18n.highlights-count-mismatch` es aparte: si los dos idiomas tienen logros pero distinta cantidad, casi siempre falta traducir uno o sobra otro. Si un idioma está vacío, ya lo reporta `i18n.missing-translation`.

Alternativa descartada: **copiar el predicado.** Dos reglas para «falta la traducción» terminan divergiendo, y el constructor y la revisión mostrarían cosas distintas.

### D8 — Forma de un hallazgo y mensajes resueltos en la aplicación

```ts
interface CvIssue {          // dominio
  code: CvIssueCode; severity: 'error' | 'warning' | 'info';
  entityType: CvEntityType; entityId: string; field: string | null;
  params: Readonly<Record<string, string | number>>;
}
```

- `CvEntityType`: `profile`, `language`, `experience`, `skillCategory`, `skill`, `education`, `certification`, `project`, `socialLink`, `curatedProfile`. `entityId` es el id exacto (cuid en la base, la clave del seed en `cv:lint`, D13).
- El dominio no tiene textos. `application/cv-issue-messages.ts` tiene una plantilla `{ es, en }` por código, con `{param}` interpolado, y un `entityLabel` por tipo: empresa de la experiencia, título de la formación, nombre de la certificación, del proyecto o de la skill, plataforma del enlace, slug del perfil curado, nombre del perfil o del idioma. El mapper resuelve los dos con el `locale` del pedido, como el resto de la API (`docs/I18N.md`: los DTOs de salida vienen resueltos).
- Mensajes en español (literales; el manual y los tests los citan):

| Código | Mensaje |
|---|---|
| `profile.years-mismatch` | «Declarás {declared} años de experiencia, pero las experiencias cargadas suman {years} años y {remainderMonths} meses.» |
| `date.invalid-format` | «{field} no tiene un formato válido ({expected}): «{value}».» |
| `date.end-before-start` | «La fecha de fin ({end}) es anterior a la de inicio ({start}).» |
| `date.ongoing-with-end` | «Está marcada como actual y además tiene fecha de fin ({end}).» |
| `experience.multiple-current` | «Hay {count} experiencias marcadas como actuales.» |
| `i18n.missing-translation` | «Falta el texto en {localeName} de {field}.» |
| `i18n.highlights-count-mismatch` | «Los logros tienen {es} ítems en español y {en} en inglés.» |
| `url.invalid` | «{field} no es una URL válida{httpsOnly}.» (`httpsOnly` = « (tiene que ser https)» en certificaciones) |
| `url.not-https` | «{field} usa http; conviene https.» |
| `certification.expired` | «Venció en {expiresAt}: el sitio la muestra como «Vencida».» |
| `curated.orphan-reference` | «{list} incluye el id {id}, que no corresponde a ninguna experiencia, skill ni proyecto.» |
| `curated.conflicting-reference` | «El id {id} está en includeIds y en excludeIds; gana la exclusión.» |
| `curated.unmatched-filter-tag` | «El tag «{tag}» no coincide con ninguna experiencia, skill ni proyecto visible.» |
| `curated.no-experiences` | «Con sus criterios actuales no muestra ninguna experiencia.» |

- Las plantillas en inglés las escribe la tarea 3.2 con el mismo contenido. Un test exige que cada código tenga plantilla en los dos idiomas y que cada `{param}` de la plantilla exista en los `params` que emite la regla.

Alternativas descartadas:
- **Mensaje en el dominio.** Mezcla presentación e idioma con la regla.
- **Solo el código, traducido en el frontend.** `cv:lint` necesitaría su propio catálogo, y habría dos.

### D9 — `RunCvConsistencyCheckUseCase`: ocho lecturas en paralelo, sin escrituras

- `execute({ locale }): Promise<CvConsistencyReport>`. Inyecta los puertos existentes por token:
  - `PROFILE_REPOSITORY` (`findOne`, con los idiomas);
  - `EXPERIENCE_REPOSITORY` y `SKILL_CATEGORY_REPOSITORY` (las categorías con sus skills);
  - `EDUCATION_REPOSITORY`, `CERTIFICATION_REPOSITORY`, `PROJECT_REPOSITORY` y `SOCIAL_LINK_REPOSITORY`;
  - `CURATED_PROFILE_REPOSITORY`;
  - y `CLOCK`.
- Hace un `Promise.all` con un `findAll`/`findOne` por repositorio, es decir **ocho consultas fijas**, sin importar cuántos ítems haya. Después arma la instantánea, calcula `asOf` (D11), corre `runCvRules` y mapea.
- Nunca llama a métodos de escritura. Un perfil base ausente (base vacía) no es un error: la instantánea queda sin perfil y las reglas que lo necesitan no emiten nada.
- `CuratedProfileModule` exporta `CURATED_PROFILE_REPOSITORY`. `CvConsistencyModule` importa `ProfileModule`, `ExperienceModule`, `SkillModule`, `EducationModule`, `ProjectModule`, `SocialLinkModule`, `CuratedProfileModule` y `AuthModule`; si alguno no exporta su token, la tarea 4.1 agrega el export.

Alternativas descartadas:
- **Una consulta Prisma propia** del módulo. Duplica los mappers de siete módulos y saca a Prisma de `infrastructure/persistence` de cada dueño.
- **Reusar `CuratedProfileComposer`** perfil por perfil. Serían 14 composiciones con sus lecturas: N+1.

### D10 — `GET /api/admin/consistency`

- `@UseGuards(JwtAuthGuard)` (cookie o Bearer), `@RequestLocale()`. Responde **200**:

```json
{
  "asOf": "2026-11",
  "experience": { "declaredYears": 10, "derivedMonths": 103 },
  "summary": { "error": 0, "warning": 1, "info": 0 },
  "issues": [{ "code": "profile.years-mismatch", "severity": "warning",
    "entityType": "profile", "entityId": "…", "entityLabel": "Manuel Saavedra",
    "field": "yearsOfExperience", "message": "Declarás 10 años…",
    "params": { "declared": 10, "months": 103, "years": 8, "remainderMonths": 7 } }]
}
```

- `experience` es `null` si no hay perfil base. Orden de `issues`: severidad (`error`, `warning`, `info`), después `entityType` en el orden de la tabla de D8, después `entityLabel` y, por último, `code`. Así dos corridas iguales devuelven lo mismo.
- `Cache-Control: no-store`. Sin paginación: con el tamaño del CV son decenas de ítems.
- En Swagger, `code`, `severity` y `entityType` van como enums con nombre (`CvIssueCode`, `CvSeverity`, `CvEntityType`) para que `api.d.ts` los tipe. Sin sesión → 401.

Alternativa descartada: **`POST /api/admin/consistency/run`.** No hay estado ni efectos; es una lectura.

### D11 — `asOf` y errores independientes de la fecha

- `asOf` es el mes UTC de `Clock.now()` en la API, y `--as-of` (o el mes UTC actual) en `cv:lint`.
- Solo dependen de `asOf` dos reglas: `profile.years-mismatch` (por las experiencias actuales) y `certification.expired`. Las dos son `warning` o `info`. **Ninguna regla `error` depende de `asOf`**, y un test lo garantiza: corre el fixture con dos `asOf` distintos y compara los errores. Así `cv:lint` no empieza a fallar en el CI un día cualquiera.
- `computeYearsOfExperience` recorta a `asOf`: una fecha futura no suma años.

Alternativa descartada: **zona del owner (`Profile.timezone`)**. Es un texto libre (`GMT-4`); un desfase de horas en el cambio de mes no altera ningún resultado relevante.

### D12 — Pantalla Revisión en `/admin/revision`

- Ítem **Revisión** en `NAV`, después de **Perfiles curados**, con un ícono de lucide (`ListChecks`). La ruta va en `BackofficeApp.tsx`, dentro de `RequireSession`.
- La consulta es `useCvConsistency()` (TanStack Query, `staleTime: 0`, se refresca al entrar). Arriba:
  - el resumen: «{n} errores · {n} avisos · {n} sugerencias», en singular cuando el número es 1 («1 error · 2 avisos · 1 sugerencia»), y «Experiencia: {declared} años declarados; las fechas suman {years} años y {m} meses»;
  - el botón **Volver a revisar**.
- Los hallazgos se agrupan en tres bloques por severidad (**Errores**, **Avisos**, **Sugerencias**) y, dentro de cada uno, por tipo de entidad. Los bloques vacíos no se muestran. Cada fila tiene el `entityLabel`, el mensaje y un enlace **Abrir** (`issue-links.ts`):
  - `profile` y `language` → `/admin/portada`;
  - `experience` → `/admin/experiencias?editar=<id>`;
  - `skillCategory` y `skill` → `/admin/skills?editar=<id>`;
  - `education` y `certification` → `/admin/formacion?editar=<id>`;
  - `project` y `socialLink` → `/admin/proyectos?editar=<id>`;
  - `curatedProfile` → `/admin/perfiles/<id>`.
- **`?editar=<id>`**: cuando la lista termina de cargar, la pantalla busca el id entre sus ítems, abre el diálogo de edición correspondiente y saca el parámetro de la URL (`replace`). Si no lo encuentra, muestra el toast «El ítem ya no existe.» y no abre nada. El diálogo conserva su aviso de cambios sin guardar.
- Sin hallazgos se muestra «No hay hallazgos: el CV es consistente.». Ante un error de la API, el estado de error común del panel (`states.tsx`) con reintento.
- La severidad se distingue por texto e ícono, no solo por color, con los tokens del panel que ya pasan AA (`fix-admin-contrast`).

Alternativas descartadas:
- **Tarjeta en el Dashboard.** Sumaría ocho consultas a cada carga del Dashboard; queda como posible mejora (non-goal).
- **Resaltar la fila** en lugar de abrir el diálogo. Obliga a buscar el ítem y hacer un clic más; el diálogo ya existe y tiene su guard.

### D13 — `npm run cv:lint` sobre el archivo del seed, con códigos de salida para el CI

- `backend/scripts/cv-lint.ts` (`tsx`).
  - Opciones: `--file <ruta>` (por defecto `../docs/cv-data.json`), `--as-of AAAA-MM`, `--locale es|en` (por defecto `es`) y `--format text|json` (por defecto `text`).
  - Lee el archivo con `readSeedFile` y `parseSeedSource`, lo traduce con `seedToCvSnapshot` y corre `runCvRules`.
  - No abre la base ni lee `DATABASE_URL`.
- **Ids del archivo:** la clave del seed cuando existe (`experience:novacomp`, el `slug` de las plantillas y de `all`) o una posicional (`certification#4`, `skill#3.2`). Las referencias de `includeIds`/`excludeIds` (`experience:key`) se resuelven contra esas claves.
- **Salida:** una línea por hallazgo, `SEVERIDAD código entidad id: mensaje`, y un resumen final. `--format json` imprime `{ asOf, experience, summary, issues }`, igual que el endpoint.
- **Códigos de salida:**
  - **0** sin errores (los avisos y sugerencias no fallan);
  - **1** con al menos un `error`;
  - **2** si el archivo no existe o `parseSeedSource` lo rechaza (imprime sus errores, como el seed).
- **CI:** el job `backend` corre `npm run cv:lint` y `npm run cv:lint -- --file ../docs/examples/cv-data.example.json` después de `typecheck`. Los dos archivos hoy dan 0 errores (medido en el Context).

Alternativas descartadas:
- **Contra la base.** El CI tendría que levantar y sembrar Postgres para un chequeo que no lo necesita, y para la base de producción ya está el panel.
- **Fallar también con avisos.** El de años es editorial (D3) y haría fallar el CI con los datos actuales del owner.

### D14 — `fast-check` como devDependency del backend

- Se agrega `fast-check` a `devDependencies` del backend (la última versión estable compatible con Node 22 y Jest 30 al implementar, fijada con `~` y verificada con `npm view fast-check version engines`). No entra en `dependencies` ni en la imagen de producción (`npm ci --omit=dev` no lo instala; si el build de Railway instala dev, igual no se importa fuera de `*.spec.ts`).
- Propiedades (semilla fija en el CI, `numRuns: 200`; ante un fallo, la semilla queda en el mensaje):
  1. `months` está entre el intervalo válido más largo y el lapso entre el primer inicio y el último fin.
  2. El resultado no cambia al permutar o duplicar intervalos.
  3. Con intervalos disjuntos y no contiguos, `months` es la suma de sus largos.
  4. **Monotonía:** el resultado de un subconjunto (por ejemplo, las experiencias con un tag) nunca supera al del total. Es la garantía de que ningún «años con X» puede contradecir las fechas.
  5. **Regla de años:** `profile.years-mismatch` aparece si y solo si el declarado está fuera de `[floor, ceil]` de los meses derivados, y sus `params` coinciden con `computeYearsOfExperience`.
- Fixture de errores sembrados (`cv-rules.seeded.fixture.ts`): una instantánea limpia (0 errores y 0 avisos) más una mutación por cada código del catálogo. El test exige el 100 %: cada mutación produce su código sobre el `entityId` y el `field` esperados, y no produce otros `error`.

Alternativa descartada: **solo tests tabulares.** La ficha de la propuesta pide fast-check de forma explícita, y la regla de años tiene fronteras (contigüidad, solapamientos anidados, actual hasta `asOf`) donde una tabla deja casos sin probar.

### D15 — Sin migraciones ni configuración nueva

Sin cambios en `schema.prisma`, sin variables de entorno y sin dependencias de runtime. El contrato suma una ruta y tres enums: se regeneran `backend/openapi.json` y `api.d.ts`, y el test de deriva lo controla.

## Risks / Trade-offs

- **[Aviso de años con los datos reales]** → aparece en la primera corrida (10 contra 8 años y 7 meses). Es el objetivo de la pregunta 20 = A, no un falso positivo. El mensaje aclara que se cuentan las experiencias cargadas.
- **[Muchos faltantes de traducción]** → si el owner tiene muchos campos sin inglés, la lista puede ser larga. Se agrupa por entidad y severidad; no se resume en una sola línea porque cada fila enlaza a su ítem.
- **[Reglas y validadores que divergen]** → las reglas `error` reutilizan los regex y predicados exportados por los validadores (`YEAR_MONTH_REGEX`, `EDUCATION_DATE_REGEX`, `isHttpsUrl`, `isHttpUrl`) en lugar de copiarlos. Un test cruza cada mutación `error` del fixture con el validador del módulo: si el validador la acepta, el test falla.
- **[Ids posicionales en `cv:lint`]** → cambian si se reordena el archivo. Solo identifican la línea en una corrida; el panel usa cuid.
- **[`?editar=` en cuatro pantallas]** → es la parte más ancha del frontend. Se implementa con un hook común (`useEditParam`) y un test por pantalla.
- **[`fast-check` en la imagen]** → `backend/railway.json` construye con Nixpacks; la tarea 7.3 verifica que el build de producción no lo empaquete en `dist/` (solo los specs lo importan, y `nest build` los excluye).
- **[El ejemplo cambia de resultado con el calendario]** → `cv-data.example.json` declara 11 años y su experiencia `cobalto` es actual desde 2025-02: con `asOf` `2026-11` suma 143 meses (sin aviso), y desde `2026-12` suma 144 o más y aparece el aviso de años. Es correcto y no afecta al CI (es `warning`, D11). TC-47 lo contempla, y los tests usan un `asOf` fijo.
- **[Costo del endpoint]** → ocho consultas sin filtro sobre tablas de decenas de filas; despreciable. Sin caché, para que el resultado siempre refleje la última edición.

## Migration Plan

1. Sin migración de base. El deploy suma la ruta y la pantalla.
2. CI: el paso `cv:lint` entra en el mismo PR. Si al implementarlo aparece un `error` en `cv-data.json`, se informa al owner antes de tocar el archivo: el change no corrige datos por su cuenta.
3. Rollback: revertir el código. No queda estado.

## Open Questions

Ninguna bloqueante. Las dos no bloqueantes quedaron resueltas el 2026-11-07 (P1 → A, P2 → A). Detalle:

1. **Tarjeta resumen en el Dashboard** (D12 la deja fuera). Opciones:
   - A) No, por ahora.
   - B) Una tarjeta con los tres contadores que enlaza a Revisión.

   **Recomiendo A**, y revisar B después de unas semanas de uso. **[no bloqueante]**

   **Resuelta el 2026-11-07: A** (sin tarjeta en el Dashboard).

2. **`yearsOfExperience` del ejemplo** (Risks). Desde diciembre de 2026 el ejemplo da el aviso de años. Opciones:
   - A) Dejarlo: sirve para mostrar el aviso en el manual.
   - B) Subirlo a 12 en el mismo PR.

   **Recomiendo A**: los datos de ejemplo no se tocan en este change, y TC-47 fuerza el aviso de todos modos con un valor propio. **[no bloqueante]**

   **Resuelta el 2026-11-07: A** (no se toca el `yearsOfExperience` del ejemplo).
