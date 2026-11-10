# Design — add-json-resume-export

## Context

- **La resolución ya existe y es una sola.** `ResolveCuratedProfileUseCase` hace los pasos 1, 2 y 6 de `CLAUDE.md § ResolveCuratedProfile` (existencia por slug o alias, `resolvability`, visita en segundo plano solo si recibe `viewContext`) y delega los pasos 3-5 y 7 en `CuratedProfileComposer`, que comparten la ruta pública, el head (`GetProfileHeadUseCase`) y el preview del panel. `resolvability(visibility, archivedAt, validToken)` es la tabla de verdad: archivado y `PRIVATE` → `not-found`; `PROTECTED` sin token válido → `unauthorized`.
- **La vista resuelta (`CuratedProfileOutput`) trae todo lo que JSON Resume puede expresar**, ya en el idioma pedido: `profile` (`fullName`, `headline`, `location`, `email`, `phone`, `summary`, `languages[{name, level, detail}]`), `headline` curado, `experiences`, `skillCategories[{name, skills}]`, `projects` (`period` es texto libre, p. ej. `2019 – 2022`), `education`, `certifications` (`year`, `verificationUrl`, `credentialId`, `expiresAt`), `socialLinks`, `sections` (orden final, sin ocultas ni vacías) y `updatedAt` (ISO UTC; `fix-error-contrast-and-date-modified`, D5).
- **`sections` ya es la única definición de «qué se ve».** `completeSections` deja fuera lo oculto y lo vacío; `sectionsWithData` decide qué tiene datos (`contact` = hay email; `presence` = hay enlaces). Los idiomas se pintan dentro de **Contacto** (`Contact.tsx`).
- **Caddy** manda al proxy `/api/*`, `/health*`, `/robots.txt` y `/sitemap.xml`; todo lo demás cae en la SPA con `try_files {path} /index.html`. Un `/resume.json` o `/{slug}/resume.json` hoy devolvería el `index.html` con 200 (`docs/DEPLOY-ARCHITECTURE.md` § 3).
- **Visitas.** `views` y los agregados cuentan solo `HUMAN` (`classify-profile-views`); `kind` es un enum de Prisma (`HUMAN`/`OWNER`/`BOT`).
- **Schema JSON Resume v1.0.0** (`https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json`, leído el 2026-11-07):
  - `$schema: draft-04`, sin `id`. Raíz con `additionalProperties: false`; la propiedad `$schema` está declarada (formato `uri`), así que el documento puede llevarla. Los objetos internos admiten propiedades extra.
  - Fechas `iso8601` con el patrón `AAAA-MM-DD | AAAA-MM | AAAA` (work, education, projects, …), salvo `certificates[].date`, que usa `format: "date"` (fecha completa).
  - Formatos usados: `uri` (todas las `url` y `meta.canonical`), `email` (`basics.email`) y `date`.
  - `meta`: `canonical` (`uri`), `version` (texto semver, ejemplo `v1.0.0`) y `lastModified` (descripción `YYYY-MM-DDThh:mm:ss`, sin `format`).
  - Antes de vendorizarlo, la tarea 1.2 confirma el contenido contra el tag publicado y fija su SHA-256 (riesgo R1).
- **Validadores disponibles.** `ajv@8.18.0` y `ajv-formats@3.0.1` ya están en `backend/package-lock.json` como dependencias de desarrollo transitivas (`@angular-devkit/core`, vía `@nestjs/cli`). Ajv 8 no trae el meta-schema draft-04.
- **Presupuesto del arranque público:** 148,9 KB gzip contra un tope de 155 KB (`fix-error-contrast-and-date-modified`, 5.1).

## Goals / Non-Goals

**Goals:** que un perfil curado se pueda bajar como JSON Resume v1.0.0 válido en ES o EN, con exactamente lo que muestra su página (mismos filtros, overrides, orden y secciones ocultas), con los mismos códigos de acceso que la ruta pública, sin contar como visita y sin dependencias de producción nuevas; y que el owner lo baje desde el panel aunque el perfil sea privado.

**Non-Goals:** ver `proposal.md` § Non-goals.

## Decisions

### D1 — Ruta: `/api/curated-profiles/:slug/resume.json`, sin reescritura en Caddy

- Pública: `GET /api/curated-profiles/:slug/resume.json`, con `?locale=`/`?lang=`/`Accept-Language` como el resto (`@RequestLocale()`), y `X-Access-Token` o `?token=` para `PROTECTED`.
- La home no tiene caso especial: su perfil es `all`, así que es `/api/curated-profiles/all/resume.json`.
- Un alias de slug resuelve igual que en el detalle y responde con `Content-Location: /api/curated-profiles/<canónico>/resume.json`.
- En producción se llega por el mismo origen del sitio (`https://<dominio>/api/curated-profiles/<slug>/resume.json`) porque Caddy ya manda `/api/*` al proxy: **no hay cambios en el `Caddyfile` ni en `DEPLOY-ARCHITECTURE.md`**.
- Con path-to-regexp 8 (Express 5.2, Nest 11.2) el punto de `resume.json` es literal y `:slug` no lo captura; la tarea 3.3 lo confirma con un e2e (un slug con punto no existe: el formato de slug lo prohíbe).

Alternativas descartadas:
- **`/{slug}/resume.json` en el sitio, reescrita por Caddy a la API** (lo que sugiere la fila de la propuesta). Es la URL más linda, pero suma un matcher con `path_regexp` y un `rewrite` al `Caddyfile`, un caso más en el diagrama de § 3 y una ruta que en local (Vite) necesitaría su propio proxy. El dominio es el mismo con o sin `/api`, que es lo que importa para compartirla. Si el owner la quiere, es un agregado de borde sin tocar la API.
- **`/resume.json?slug=&lang=` en la raíz.** Mezcla un recurso por perfil con un parámetro y choca con el fallback de la SPA igual que la anterior.
- **`/api/curated-profiles/:slug?format=json-resume`.** Cambia el contrato de una ruta existente según un parámetro (dos esquemas de respuesta en el mismo path del OpenAPI) y complica `api.d.ts`.

### D2 — Exportar no registra visita

- El caso de uso público llama a `ResolveCuratedProfileUseCase.execute` **sin `viewContext`**: no hay `ProfileView`, no se incrementa `views` y no se lee la sesión del panel. La query de la ruta solo acepta `locale`, `lang` y `token`; `via` y `src` no se declaran ni se usan.
- Razón: `views` mide personas que **leyeron** el perfil. Una descarga de JSON la hacen sobre todo herramientas (un ATS, un generador de PDF, un tema de JSON Resume), y el owner bajándola desde el panel tampoco es una lectura.

Alternativas descartadas:
- **Registrarla como `BOT`.** No es un bot en el sentido de `classifyUserAgent`, ensucia `byKind` y mezcla dos preguntas distintas («¿quién me lee?» y «¿quién me descarga?»).
- **Un `kind` nuevo (`EXPORT`) o una tabla de descargas.** Exige migración del enum y una vista nueva en el Dashboard; queda para cuando haya una pregunta de producto que lo pida.
- **Registrarla como visita normal.** Inflaría `views` con tráfico de máquinas, que es justo lo que corrigió `classify-profile-views`.

### D3 — La vista resuelta manda: se exporta lo que está en `sections`

El mapper recibe `CuratedProfileOutput` (ya filtrado, ordenado y localizado) y nunca vuelve a seleccionar. Una clave del documento sale **solo si la sección de la que viene está en `output.sections`**; así lo oculto y lo vacío se tratan igual que en la página.

| Sección del catálogo | Clave de JSON Resume |
|---|---|
| `hero` | `basics` siempre (ver abajo) |
| `stats` | nada (JSON Resume no tiene años de experiencia ni disponibilidad) |
| `experience` | `work` |
| `skills` | `skills` |
| `projects` | `projects` |
| `education` | `education` |
| `certifications` | `certificates` |
| `presence` | `basics.profiles` |
| `contact` | `basics.email`, `basics.phone` y `languages` (los idiomas se pintan en Contacto) |

- **`basics` sale siempre** con `name`, `label`, `url`, `summary` y `location`, aunque `hero` esté oculto: un CV sin nombre no sirve en ningún consumidor, y la página también muestra el nombre en la barra y en el título aunque se oculte el hero. Si `profile` es `null` (base sin perfil), `basics` lleva solo `url`.
- **El orden de `sectionsOrder` no se traslada:** JSON Resume define el orden de sus claves y cada consumidor arma su propia presentación. Lo que sí se conserva es el **orden dentro de cada lista** (cronológico en `work`, `order` en el resto), que es el de la vista resuelta.
- Las claves salen siempre en el mismo orden: `$schema`, `basics`, `work`, `education`, `certificates`, `skills`, `languages`, `projects`, `meta`.
- **Sin valores vacíos:** una lista vacía, un string vacío o un `null` no se emiten (la clave se omite). El documento es válido igual y los temas no pintan encabezados vacíos.

Alternativas descartadas:
- **Usar `hiddenSections` en lugar de `sections`.** Repetiría la regla de «vacío» y podría divergir de `sectionsWithData`.
- **Exportar todo y dejar que el consumidor filtre.** Contradice la razón de ser del perfil curado: el JSON de una vacante tiene que decir lo mismo que su página.
- **Omitir `basics` si `hero` está oculto.** Deja un documento sin identidad.

### D4 — Mapeo campo por campo

URL base: `FRONTEND_URL` sin `/` final (la misma que el sitemap y el head). `profilePath(slug)` es `/` para `all` y `/<slug>` para el resto; se extrae de `sitemap.builder.ts` a un helper compartido (hoy también lo repite `profile-head.renderer.ts`).

| JSON Resume | Origen | Regla |
|---|---|---|
| `$schema` | constante | `https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json` |
| `basics.name` | `profile.fullName` | |
| `basics.label` | `headline` curado, si no `profile.headline` | la misma regla que el hero y la hoja impresa |
| `basics.email` / `basics.phone` | `profile.email` / `profile.phone` | solo con `contact`; `phone` se omite si es `null` |
| `basics.url` | `<base><profilePath(slug canónico)>` | sin `?token=` ni `?lang=` (el canonical del head) |
| `basics.summary` | `profile.summary` | |
| `basics.location` | `{ "address": profile.location }` | texto tal cual, sin partirlo (ver alternativa) |
| `basics.profiles[]` | `socialLinks` | solo con `presence`: `network` = `platform`, `username` = `handle`, `url` = `url` |
| `work[]` | `experiences` | `name` = `company`, `position` = `role`, `location`, `startDate`, `endDate` (se omite si es `null`), `summary`, `highlights` |
| `education[]` | `education` | `institution`, `area` = `degree`, `startDate`, `endDate` (se omite si es `null`) |
| `certificates[]` | `certifications` | `name`, `issuer`, `url` = `verificationUrl`; **`date` se omite** (ver abajo) |
| `skills[]` | `skillCategories` | `name` = nombre de la categoría, `keywords` = sus skills; sin `level` |
| `languages[]` | `profile.languages` | solo con `contact`: `language` = `name`, `fluency` = `level`; `detail` no viaja |
| `projects[]` | `projects` | `name`, `description` = `summary`, `roles` = `[role]`, `keywords` = `technologies`, `url`; `startDate`/`endDate` solo si `period` tiene forma de años (abajo) |
| `meta.canonical` | ruta de este documento | `<base>/api/curated-profiles/<slug canónico>/resume.json?lang=<locale>`, sin token |
| `meta.version` | constante | `"v1.0.0"` (la versión del schema que cumple el documento) |
| `meta.lastModified` | `updatedAt` | `AAAA-MM-DDThh:mm:ss` en UTC (sin milisegundos ni `Z`, como pide la descripción del schema); se omite si es `null` |

- **Fechas.** `startDate`/`endDate` de experiencias y formación ya son `AAAA-MM` (o `AAAA`), que cumplen el patrón `iso8601`; el mapper las copia sin transformar y el test de validación lo garantiza. Una fecha que no cumpla el patrón se omite (nunca se emite una inválida).
- **`period` de proyectos.** Se interpreta solo si es `AAAA`, `AAAA-MM` o un rango de dos de esos separados por `–`, `—` o `-` con espacios opcionales; un segundo extremo que no sea fecha (`actualidad`, `present`) deja solo `startDate`. Cualquier otra forma no emite fechas. Es una función pura con sus casos de test.
- **`certificates[].date`.** El schema exige fecha completa (`format: "date"`) y la certificación solo guarda el año. Emitir `AAAA-01-01` inventaría un día y mes; emitir `AAAA` deja el documento inválido con validación de formatos. Se omite y el año se pierde en esta versión (pregunta P1, no bloqueante).
- **`basics.location`.** `profile.location` es un texto libre (`Santa Cruz de la Sierra, Bolivia`). Partirlo en `city`/`region`/`countryCode` adivinaría la estructura; `address` lo conserva entero y los temas de JSON Resume lo muestran.
- **`education`: `area` y no `studyType`.** `degree` es el título completo («Ingeniería de Sistemas»); en el schema `studyType` es el nivel («Bachelor») y `area` el campo. Poner el título en `area` es lo que más se acerca y los temas lo muestran como encabezado.

### D5 — Sin claves de extensión

El documento lleva **solo claves definidas por el schema**, aunque los objetos internos admitan propiedades extra. No viajan: tema y `themeOverrides`, `layout`, `filterTags`, `includeIds`/`excludeIds`, `visibility`, `roleType`/`techFocus`, `technologies`, `sector` y `tags` de las experiencias, `credentialId` y `expiresAt` de las certificaciones, `detail` de los idiomas, `stats` y `featured` de los enlaces, `yearsOfExperience`, `availability` y `timezone`.

- Las tecnologías de las experiencias no se pierden del todo: las que son skills ya están en `skills`.
- Razón: el valor del formato es la portabilidad; una clave propia (`x-technologies`) la ignora cualquier consumidor y fija un contrato que habría que mantener.

Alternativa descartada: **`work[].keywords` o un bloque `x-portfolio`** con lo que falta. Ningún tema lo lee y un validador estricto de terceros podría rechazarlo.

### D6 — Cabeceras y caché

- `Content-Type: application/json; charset=utf-8` y `Content-Language: <locale>` (el interceptor existente).
- `Content-Disposition: attachment; filename="<slug canónico>.<locale>.resume.json"`. El slug ya es `[a-z0-9-]`, así que no hace falta `filename*`. Un `fetch` de una herramienta ignora la cabecera; un navegador descarga el archivo con un nombre útil.
- `X-Robots-Tag: noindex`: la página HTML es lo indexable; el JSON sería un duplicado.
- `Cache-Control`: `no-cache` para `PUBLIC` (el navegador revalida; el `ETag` débil de Express permite el 304) y `private, no-store` para `PROTECTED` y para la ruta del panel (el contenido depende de un secreto o de la sesión).
- **Sin caché en el servidor.** `ProfileHeadCache` existe porque el head se pide en cada carga de HTML y la ruta está exenta del límite de peticiones; esta ruta pasa por el límite global y se pide poco. Una edición se ve en la siguiente descarga.
- Errores (401/404) con el formato de `api-platform`, como el detalle.

Alternativa descartada: **`Content-Disposition: inline` o un `?download=1`.** Un parámetro más que documentar para un caso que el atributo `download` del enlace y el nombre del archivo ya resuelven.

### D7 — Ruta del panel por id para cualquier perfil

- `GET /api/admin/curated-profiles/:id/resume.json?locale=`, bajo `JwtAuthGuard` como el resto del controller de admin. Lee el perfil por id (`findById`), compone con `CuratedProfileComposer` y aplica el mismo mapper. Sin `resolvability`: el owner exporta también perfiles `PRIVATE`, `PROTECTED` (sin token) y archivados. Sin visita. Id inexistente → 404.
- Razón: los perfiles dirigidos a una vacante suelen ser `PRIVATE` o `PROTECTED` (y los borradores que creará `add-job-posting-intake` nacen `PRIVATE`), que es justo cuando el owner quiere bajar el JSON para cargarlo en un portal. Con solo la ruta pública, el enlace del panel daría 404 o exigiría meter el token en la URL.
- `meta.canonical` y `basics.url` siguen apuntando a las URLs públicas (sin token), aunque para un `PRIVATE` no resuelvan: son la identidad del documento, no un permiso.

Alternativas descartadas:
- **Solo la ruta pública y, en el panel, sumar el token para `PROTECTED`.** No cubre `PRIVATE` ni archivados, y deja el token en el historial del navegador.
- **Exportar el borrador sin guardar desde el preview (`POST`).** Un archivo que no coincide con nada publicado; el preview existe para mirar, no para distribuir.

### D8 — Dónde está el enlace: constructor sí, vista pública no

- En la pestaña **Publicación** del constructor, debajo de «Link público»: «Descargar JSON Resume» con dos enlaces, **ES** y **EN** (`<a href download>` a la ruta del panel con `?locale=`). Con la sesión en cookie y el mismo origen, el navegador la envía sola.
- Perfil nuevo sin guardar: los enlaces se muestran deshabilitados con el texto «Guardá el perfil para exportarlo». Con cambios sin guardar: debajo, «Se exporta la última versión guardada».
- **La vista pública no suma botón.** Cabría en el presupuesto (un enlace y un ícono son centenares de bytes), pero el público de la página es una persona que lee y para ella ya están la página y «Imprimir / Guardar PDF»; el JSON sirve a herramientas, y quien lo necesita recibe la URL. Además, en un `PROTECTED` el enlace tendría que propagar el token en la URL.
- No va en la lista de perfiles: la fila ya tiene cuatro acciones y el constructor es donde se publica.

Alternativas descartadas:
- **Botón en la barra pública junto a Imprimir.** Ver arriba; queda como agregado chico si el owner lo pide.
- **`<link rel="alternate" type="application/json">` en el head.** Cambiaría el fragmento y su paridad con el cliente (`profile-head.consistency`) sin un consumidor conocido.

### D9 — Validación: schema vendorizado y `ajv` como devDependency explícita

- El schema publicado se copia a `backend/test/fixtures/json-resume/schema-v1.0.0.json`, byte a byte, con `SOURCE.md` al lado (URL del tag, fecha de la copia, SHA-256 y licencia del repositorio de origen, a confirmar en la tarea 1.2). Un test fija el SHA-256: cambiar el archivo obliga a decidirlo.
- `ajv@8.18.0` y `ajv-formats@3.0.1` pasan a `devDependencies` del backend **con las versiones exactas que ya resuelve el lockfile**: no se descarga ningún paquete nuevo; solo se declara lo que se importa (si no, el test depende de una dependencia transitiva de `@nestjs/cli` que puede desaparecer en cualquier actualización).
- **Draft-04 con Ajv 8:** el test compila una copia del schema sin la clave `$schema`. Las palabras clave que usa (`type`, `properties`, `items`, `additionalProperties`, `pattern`, `format`, `definitions` con `$ref` local, `additionalItems`) se comportan igual en el dialecto por defecto de Ajv 8; `strict: false` evita que Ajv rechace `additionalItems` sin `items` en forma de tupla. `ajv-formats` con `uri`, `email` y `date`.
- Dónde se valida: (a) test unitario del mapper con una vista resuelta de fixture que ejercita cada rama (perfil completo, `contact` y `presence` ocultos, `profile: null`, `period` raro, `updatedAt: null`); (b) e2e que pide `resume.json` de **cada perfil público** de la base del e2e en `es` y en `en` y valida cada respuesta; (c) un control: un documento con `certificates[].date: "2023"` debe fallar (prueba que los formatos están activos).
- Producción no usa Ajv: el tipo `JsonResumeOutput` (interfaz TypeScript escrita a mano) y los tests sostienen la forma.

Alternativas descartadas:
- **`ajv-draft-04`.** Un paquete nuevo solo para el dialecto, cuando las palabras clave del schema no lo necesitan.
- **El paquete npm del schema (`resume-schema` / `@jsonresume/schema`).** Trae su propio validador y dependencias, y su versión npm no coincide 1:1 con el tag `v1.0.0`; el archivo vendorizado con hash es más simple y no depende de la red en el CI.
- **Descargar el schema en cada corrida.** El CI dependería de GitHub y de que el tag no se mueva.

### D10 — Contrato OpenAPI y manual

- Las dos rutas se documentan con `@ApiProduces('application/json')`, `locale`, `X-Access-Token` y `token` (solo la pública), 200/401/404 (la del panel 200/401/404 por sesión e id) y las cabeceras de D6. El cuerpo 200 se declara como **objeto** con descripción y `externalDocs` al schema de JSON Resume, sin una clase Swagger que copie el schema: el contrato es el estándar externo, y duplicarlo en decoradores crearía una segunda fuente que se desactualiza. `openapi.json` y `api.d.ts` se regeneran; el test de deriva del frontend pasa.
- TC-48 en `docs/MANUAL.md` y `docs/manual/index.html` (`manual:check` exige que estén alineados), sobre la base de ejemplo: descarga desde el constructor y los cuatro códigos por `curl` (ver `verification.md`). Sin captura nueva obligatoria (el enlace es texto en una pestaña ya capturada); si `manual:capture` regenera la de **Publicación**, se acepta.

## Risks / Trade-offs

- **R1 — El schema vendorizado difiere del publicado.** La lectura de esta propuesta se hizo sobre el tag `v1.0.0`; la tarea 1.2 lo descarga de nuevo, compara y fija el SHA-256. Si el tag tuviera otra forma (p. ej. `meta.lastModified` con `format`), se ajusta D4 antes de seguir.
- **R2 — Consumidores que esperan `certificates[].date`.** Algunos temas lo muestran; sin él, la certificación sale sin año (P1).
- **R3 — `period` de proyectos con formas no previstas.** La función solo reconoce años; lo demás pierde las fechas, nunca emite una inválida. El test con los `period` de `cv-data.json` y del ejemplo lo cubre.
- **R4 — Un perfil `PUBLIC` cuyo JSON alguien referencia y después pasa a `PRIVATE`.** Responde 404, como la página: es el comportamiento buscado.
- **R5 — Tráfico de herramientas que piden el JSON seguido.** Pasa por el límite global de peticiones y no toca la analítica; no hay caché de servidor que invalidar.
- **R6 — `phone` y `email` en un archivo descargable.** Ya están en la página (`contact`) y en la API pública; ocultar Contacto los saca también del JSON (D3).

## Migration Plan

Sin migraciones ni datos nuevos. Despliegue normal (`preDeployCommand` sin cambios). Rollback: revertir el PR; ningún dato depende de la ruta.

## Open Questions

- **P1 [resuelta 2026-11-07: A] — Año de las certificaciones.** Opciones: **A)** omitir `date` (esta propuesta; documento válido, sin año); **B)** `date: "AAAA-01-01"` (válido, pero afirma un día que no se conoce); **C)** `date: "AAAA"` (lo aceptan muchos temas, pero no valida con formatos). Recomendación: **A** ahora; si el owner quiere el año, el camino limpio es un change que guarde la fecha completa de emisión (`issuedAt` `AAAA-MM-DD`), con migración.
- **P2 [resuelta 2026-11-07: no] — Ruta en el sitio fuera de `/api`.** Si el owner prefiere `/{slug}/resume.json` (la fila de la propuesta), es un agregado al `Caddyfile` sin tocar la API (D1). Recomendación: no por ahora; actualizar la fila de `docs/PROPUESTA-FEATURES.md` § 6.2 a la ruta de D1 cuando se archive (ese archivo lo edita otro change en paralelo).

**Resolución (owner, 2026-11-07).** P1 → **A**: las certificaciones salen sin `date`; un `issuedAt` completo sería otro change. P2 → **no**: no hay ruta en el sitio fuera de `/api`; la URL es la de D1.
