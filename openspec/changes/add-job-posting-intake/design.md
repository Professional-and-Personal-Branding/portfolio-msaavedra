# Design — add-job-posting-intake

## Context

Ver `proposal.md`. Estado verificado el 12 de noviembre de 2026 sobre `main` (`164e4ba`), en la rama `feat/job-posting-intake`:

- **Perfiles curados.** `CreateCuratedProfileUseCase` valida con `validateCuratedProfile` (slug kebab-case, PROTECTED exige token) y `checkReferences` (slug único, incluidos los alias; tema existente) y crea por `CURATED_PROFILE_REPOSITORY`. `DuplicateCuratedProfileUseCase` deja la copia `PRIVATE`, `listed: false` y busca el primer slug libre entre `-2` y `-50` (`MAX_DUPLICATE_SUFFIX`). `headline` es opcional: vacío, el hero usa el del perfil base.
- **Vocabulario de tags.** No existe como concepto del backend. El constructor arma el universo en el cliente con los tags de experiencias, skills y proyectos; la regla `curated.unmatched-filter-tag` de `cv-consistency` usa los de los ítems **visibles** y compara con `matchesAnyTag`, sin normalizar. Los tags son slugs en minúsculas (`java`, `spring-boot`, `dotnet`, `nodejs`, `event-driven`, `iso8583`…).
- **Patrón entre módulos.** `application-tracking` define su propio puerto de lectura (`ApplicationReferenceReader`) con un adaptador Prisma de solo lectura; `curated-profile` consume `PROFILE_VIEW_REPOSITORY`, que exporta `AnalyticsModule`. `test/architecture.spec.ts` ya prueba que `analytics` no escribe `shareLink`.
- **Errores.** `RuleViolationError` (→ 422), `ValidationError` (→ 400), `NotFoundError` (→ 404), `ConflictError` (→ 409); el cuerpo es el estándar de `AllExceptionsFilter`.
- **Límites.** `ThrottlerGuard` global (APP_GUARD) y guards propios para el login y el cambio de contraseña (`CredentialAttemptLimiter`, en `auth/infrastructure`).
- **Dependencias.** Node 22. No hay `nock`, `undici` como paquete, `cheerio` ni parser de HTML. `fast-check`, `supertest` y `ajv` están en `devDependencies`.
- **Panel.** `NAV` de `AdminShell.tsx` tiene **nueve** ítems y la barra entra justa a 1280 px (`add-application-tracking`, D11: 983 de 1008 px).
- **En paralelo.** Otro arquitecto diseña `add-integrations-foundation` (cola Postgres, cron, `SecretCipher`, flags), y la propuesta (§ 5.1) ubicaba `JobPostingSource` en `integrations/application`.

## Goals / Non-Goals

**Goals:** que el owner pegue una URL o un texto y obtenga, en una sola acción síncrona, la vacante normalizada, la cobertura de sus tags y un borrador privado con criterios que solo usan tags que existen; que ninguna URL que escriba pueda hacer que el servidor hable con su red interna; y que los dos módulos queden separados de forma verificable.

**Non-Goals:** ver `proposal.md` § Non-goals.

## Decisions

### D1 — Módulo propio `job-posting`; `curated-profile` crea el borrador

- `backend/src/modules/job-posting/{domain,application,infrastructure}` y `job-posting.module.ts`, importado en `AppModule`.
- `job-posting` **sugiere**: normaliza, detecta y calcula la cobertura. **No escribe en `CuratedProfile`** ni importa nada de `curated-profile`.
- `curated-profile` **crea**: `CreateCuratedProfileFromJobPostingUseCase` (en `curated-profile/application/use-cases/admin/`) recibe por el token Symbol `JOB_POSTING_READER` un puerto de lectura que define y exporta `job-posting` (`job-posting/application/ports/job-posting.reader.ts`), igual que `AnalyticsModule` exporta `PROFILE_VIEW_REPOSITORY`. `CuratedProfileModule` importa `JobPostingModule`; nunca al revés.
- `JobPostingReader.findDraftSource(id): Promise<{ id; title; company; language } | null>`: solo lo que el borrador necesita.

Alternativas descartadas:
- **Que `job-posting` cree el perfil** con `CURATED_PROFILE_REPOSITORY`. Rompe la regla «cada módulo escribe solo su agregado» (§ 2 de la propuesta) y el criterio del change.
- **Que `curated-profile` lea la tabla `JobPosting` con su propio Prisma** (como `application-tracking`). Funciona, pero duplica el conocimiento del esquema de otro módulo; aquí el dueño del dato exporta un lector chico.

### D2 — `JobPostingSource` vive en `job-posting/application/ports`, no en `integrations`

- El puerto es `JobPostingSource { readonly kind; canHandle(url: URL): boolean; fetch(url: URL, signal): Promise<Result<NormalizedPosting, ImportFailure>> }` en `job-posting/application/ports/job-posting-source.ts`, junto con `SafeHttpClient`.
- La importación es **síncrona**: la dispara el owner, espera la respuesta (como máximo 10 s, D9) y no pasa por la cola, el cron ni el cifrado de `add-integrations-foundation`. Este change no depende de él ni lo bloquea.
- El `JobFeedSource` del radar (`add-job-radar`) es otro puerto con otro contrato (`applyUrl` obligatorio, `attribution`, paginación); si algún día comparten código, el que llegue después lo extrae a `shared/`.

Alternativa descartada: **ponerlo en `integrations/application`** como decía § 5.1. Acopla dos changes que se diseñan en paralelo y obliga a esperar a que exista ese módulo.

### D3 — Tres ATS por su API pública de job board

| ATS | URLs que reconoce `matchAtsUrl` | Petición | Campos |
|---|---|---|---|
| Greenhouse | `boards.greenhouse.io/{board}/jobs/{id}`, `job-boards.greenhouse.io/{board}/jobs/{id}` (y sus variantes `.eu.`), `…/embed/job_app?for={board}&token={id}` | `GET https://boards-api.greenhouse.io/v1/boards/{board}/jobs/{id}` | `title`, `company_name` (si falta, el `board` humanizado), `location.name`, `content` (HTML escapado dos veces), `absolute_url` → `applyUrl`, `updated_at` |
| Lever | `jobs.lever.co/{site}/{id}`, `jobs.eu.lever.co/{site}/{id}` (con o sin `/apply`) | `GET https://api.lever.co/v0/postings/{site}/{id}` (o `api.eu.lever.co`) | `text`, `categories.location`, `categories.commitment`, `workplaceType`, `descriptionPlain` + `lists[]` + `additionalPlain`, `applyUrl`, `createdAt` (ms); empresa = `site` humanizado |
| Ashby | `jobs.ashbyhq.com/{org}/{id}` (con o sin `/application`) | `GET https://api.ashbyhq.com/posting-api/job-board/{org}?includeCompensation=true` y se elige el `jobs[].id === id` | `title`, `location`, `employmentType`, `workplaceType`/`isRemote`, `descriptionPlain`, `applyUrl`, `publishedAt`, `compensation.compensationTierSummary`; empresa = `org` humanizado |

- `board`, `site`, `org` e `id` se validan con `^[A-Za-z0-9._-]{1,100}$` antes de armar la URL de la API; el host de la API es fijo (no sale de la entrada).
- Ashby no tiene endpoint de una sola vacante: se baja el board completo con el tope de 5 MiB (D9). Si el `id` no está, 422 «no encontramos esa vacante».
- Las rutas exactas y la variante EU de Greenhouse **se confirman contra la documentación oficial al implementar** (docs.greenhouse.io/job-board.html, github.com/lever/postings-api, developers.ashbyhq.com/docs/public-job-posting-api); si una variante no existe, esa URL cae al respaldo JSON-LD y el fixture lo documenta.
- `sourceKey`: `greenhouse:{board}:{id}`, `lever:{site}:{id}`, `ashby:{org}:{id}` (minúsculas).

Alternativa descartada: **leer el HTML de la página del ATS.** Es más frágil que su API pública y oficial.

### D4 — Respaldo JSON-LD sobre cualquier host https público

- Si la URL no es de un ATS ni de un portal cerrado, `JsonLdJobPostingSource` hace un `GET` de la página (HTML, tope 2 MiB) y busca los `<script type="application/ld+json">` (atributos en cualquier orden, mayúsculas indistintas) con un escáner propio, sin parser de HTML: cada bloque se pasa a `JSON.parse`; se aceptan un objeto, un arreglo o `@graph`, y `@type` como texto o arreglo que incluya `JobPosting`. El primero gana.
- Campos: `title`, `hiringOrganization.name`, `jobLocation` (`address.addressLocality`, `addressRegion`, `addressCountry`), `jobLocationType = TELECOMMUTE` → `REMOTE`, `employmentType`, `description` (HTML → texto), `datePosted`, `baseSalary` → texto, `url` o la URL pedida → `applyUrl` si es https.
- Sin bloque `JobPosting` → 422 «No encontramos una vacante en esa página. Pegá el texto de la vacante.»
- `sourceKey`: `jsonld:` + la URL canónica (D14).

Alternativa descartada: **solo una lista de hosts permitidos** (los ATS). Deja afuera las páginas de empleo propias de cada empresa, que son el caso más común del JSON-LD; la guarda de D7–D10 es la que protege, no la lista. (P3, resuelta con la recomendación.)

### D5 — Portales cerrados: lista versionada, sin petición saliente

- `job-posting/domain/closed-portals.ts` exporta una lista de reglas `{ id, label, pattern }` sobre el host normalizado (minúsculas, sin punto final):

| id | Etiqueta | Hosts |
|---|---|---|
| `linkedin` | LinkedIn | `linkedin.com` y subdominios, `lnkd.in` |
| `indeed` | Indeed | `indeed.<cualquier sufijo>` y subdominios (`ar.indeed.com`, `indeed.com.mx`) |
| `glassdoor` | Glassdoor | `glassdoor.<sufijo>` y subdominios |
| `wellfound` | Wellfound | `wellfound.com`, `angel.co` |
| `computrabajo` | Computrabajo | `computrabajo.<sufijo>` y subdominios |
| `bumeran` | Bumeran | `bumeran.<sufijo>` y subdominios |
| `laborum` | Laborum | `laborum.<sufijo>` y subdominios |
| `zonajobs` | ZonaJobs | `zonajobs.<sufijo>` y subdominios |
| `workana` | Workana | `workana.com` |
| `upwork` | Upwork | `upwork.com` |
| `torre` | Torre | `torre.ai`, `torre.co` |
| `getonbrd` | Get on Board | `getonbrd.com`, `getonbrd.cl` |
| `aggregators` | el nombre del sitio | `himalayas.app`, `remotive.com`, `remoteok.com`, `remoteok.io`, `adzuna.<sufijo>`, `jooble.org`, `arbeitnow.com` |

- `<sufijo>` es uno o dos labels de TLD (`com`, `com.ar`, `co.uk`), así `indeed.com.mx` entra y `misindeedjobs.com` no.
- Un host cerrado responde **422** con `«{Etiqueta}» no permite leer sus vacantes. Copiá el texto de la vacante y pegalo en «Texto».` **antes** de cualquier DNS o petición. La regla se aplica también a cada `Location` de un redirect (D8).
- Get on Board está en la lista porque sus ToS de reutilización siguen sin revisar (§ 3 de la propuesta); los agregadores, porque sus términos piden la API y la atribución del radar, no leer el HTML.
- La lista se cambia en código con su test de tabla; agregar un portal no cambia el contrato.

Alternativa descartada: **intentar el JSON-LD también en esos portales.** Viola el principio «el respaldo JSON-LD nunca se aplica a esos portales» (§ 2) y sus ToS.

### D6 — Texto pegado: extracción determinística

- Entrada: `text` (50 a 50 000 caracteres tras recortar), y opcionales `title` (≤ 200), `company` (≤ 160) y `url` (https, ≤ 2048, **solo de referencia**: se guarda como `sourceUrl` y **nunca se pide**; sirve para pegar el texto de una vacante de LinkedIn y conservar el enlace).
- `extractFromPastedText` (puro): título = `title` o la primera línea no vacía (≤ 200); modalidad por palabras clave ES/EN (`remoto|remote|100% remote` → `REMOTE`; `híbrido|hybrid` → `HYBRID`; `presencial|on-site|onsite|in office` → `ONSITE`; si hay más de una, gana la primera según ese orden de prioridad: HYBRID > REMOTE > ONSITE, porque «híbrido» suele mencionar «remoto»); tipo de empleo (`full-time|tiempo completo`, `part-time|medio tiempo`, `contract|contrato|freelance`); idioma `es`/`en` por conteo de palabras vacías frecuentes (gana el que tenga al menos el doble; si no, `null`).
- `sourceKey`: `pasted:` + SHA-256 del texto normalizado (espacios colapsados, minúsculas). Pegar lo mismo dos veces reimporta (D14).

Alternativa descartada: **una llamada a un LLM** para el texto libre (§ 5.4 la marcaba opcional). Queda para la Fase 2.0, detrás de `LlmPort`.

### D7 — Política de URL (pura, antes de cualquier red)

`checkUrlPolicy(raw): Result<URL, UrlNotAllowedError>` en `job-posting/domain/services/`:

- Se parsea con `new URL()` (WHATWG): eso ya normaliza `2130706433`, `0x7f.1`, `0177.0.0.1` y similares a la forma decimal con puntos, que la regla siguiente rechaza.
- **Solo `https:`.** `http:` → 422 «Usá una URL que empiece con https://». (P1, resuelta con la recomendación: ningún ATS ni página de empleo seria sirve solo por http, y sin TLS el contenido se puede alterar en el camino.)
- Puerto vacío o `443`; cualquier otro → 422.
- Sin `username` ni `password`.
- Host que no es una IP literal (`net.isIP` sobre el host sin corchetes ≠ 0 → 422), que tiene al menos un punto y que no termina en `.localhost`, `.local`, `.internal`, `.lan`, `.home.arpa`, `.test`, `.example`, `.invalid` ni es `localhost`; el punto final se quita antes.
- Longitud ≤ 2048. El fragmento se descarta.

Alternativa descartada: **permitir http con la misma guarda de IP.** La guarda de red seguiría protegiendo la red interna, pero se pierde integridad sin ningún caso real que lo pida.

### D8 — Redirects: manuales, como máximo 3, y cada salto pasa por todo

- `SafeHttpClient.get(url, { accept, maxBytes })` hace `redirect: manual`. Ante 301, 302, 303, 307 o 308 resuelve `Location` relativa contra la URL actual y vuelve a aplicar **D7, D5 y D9** (incluida la resolución DNS) al destino. Un cuarto redirect → 422 «La página redirige demasiadas veces».
- Un redirect a `http:` (rebaje de protocolo), a una IP literal, a un nombre local, a un portal cerrado o a un host que resuelve a una IP no pública se rechaza igual que si el owner lo hubiera escrito.
- Siempre `GET`, sin cuerpo.

### D9 — Cliente HTTP seguro: IP validada al conectar, límites y cabeceras

- **Implementación sin dependencias nuevas**: `node:https.request` con la opción `lookup` propia. La función llama a `dns.lookup(host, { all: true, verbatim: true })`, valida **todas** las direcciones con `isPublicAddress` y, si alguna no lo es, falla con `BlockedAddressError`; si pasan, entrega la primera al socket. Así la IP validada es la misma a la que se conecta: no hay ventana entre chequear y usar (DNS rebinding). El certificado TLS se valida contra el nombre del host (SNI por defecto de `https`), sin `rejectUnauthorized: false`.
- `isPublicAddress(ip)` (pura, en `job-posting/infrastructure/http/address-policy.ts`) usa `net.BlockList`. Rechaza:
  - IPv4: `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10` (CGNAT), `127.0.0.0/8`, `169.254.0.0/16` (incluye la metadata `169.254.169.254`), `172.16.0.0/12`, `192.0.0.0/24`, `192.0.2.0/24`, `192.88.99.0/24`, `192.168.0.0/16`, `198.18.0.0/15`, `198.51.100.0/24`, `203.0.113.0/24`, `224.0.0.0/4`, `240.0.0.0/4` (incluye `255.255.255.255`).
  - IPv6: `::/128`, `::1/128`, `::/96` (compatibles con IPv4), `64:ff9b::/96` y `64:ff9b:1::/48` (NAT64), `100::/64`, `2001::/23` (incluye Teredo y ORCHID), `2001:db8::/32`, `2002::/16` (6to4), `fc00::/7` (ULA: incluye la red privada de Railway, `*.railway.internal`), `fe80::/10`, `fec0::/10`, `ff00::/8`. Y cualquier dirección fuera de `2000::/3`.
  - **IPv4 mapeada** (`::ffff:a.b.c.d` y su forma hexadecimal `::ffff:7f00:1`): se extrae la IPv4 y se evalúa con las reglas IPv4, de forma explícita (no se confía en cómo `BlockList` trata el mapeo).
- **Plazo**: un `AbortSignal.timeout(10_000)` para la importación completa (DNS, conexión, redirects y cuerpo) y `timeout` de socket de 5 s. Vencido → 422 «La página tardó demasiado en responder».
- **Tamaño**: 2 MiB para HTML y 5 MiB para el JSON de los ATS, contados **después de descomprimir** (se pide `Accept-Encoding: gzip, deflate`, se descomprime con `zlib` y se corta al pasar el tope). Si `Content-Length` ya lo supera, se corta sin leer. Pasado → 422 «La página es demasiado grande».
- **`Content-Type`**: `text/html` o `application/xhtml+xml` para JSON-LD; `application/json` para los ATS. Otro → 422 «La URL no devuelve una página de vacante».
- **Estado**: 404 o 410 → 422 «No encontramos esa vacante (puede estar cerrada)»; otro no 2xx → 422 «La página respondió con un error».
- **Cabeceras**: solo `Accept`, `Accept-Encoding`, `Accept-Language: es, en;q=0.8` y `User-Agent: PortfolioJobIntake/1.0` (genérico, sin datos del owner). Nunca `Cookie`, `Authorization` ni cabeceras de la petición entrante; los `Set-Cookie` se ignoran; sin agente con keep-alive compartido.
- **Logs**: se registra el host, la fuente, el resultado y la duración con el `requestId`; **nunca** la ruta, la query ni el cuerpo (una URL puede llevar tokens).

El cliente se arma en dos capas para poder probarlo sin red:
- `NodeHttpTransport` (infraestructura, `http:` o `https:` según la URL, con `lookup` inyectable): solo transporte, tope, descompresión y plazo.
- `SafeHttpClient` (infraestructura): aplica D7, D5, D8, el `Content-Type` y la clasificación de errores sobre un `HttpTransport` inyectado por el token `HTTP_TRANSPORT`, con el `DnsResolver` inyectado por `DNS_RESOLVER` y la política de direcciones fija (`isPublicAddress`; no es configurable ni inyectable desde el entorno).

Alternativas descartadas:
- **`fetch` global de Node.** No deja validar la IP en el momento de conectar sin importar `undici` como paquete (dependencia nueva) o resolver dos veces (rebinding).
- **`nock`.** No hace falta: el transporte se prueba contra un servidor `http` local y la guarda con un transporte falso (D22).

### D10 — Modelo de amenazas SSRF

| Vector | Defensa |
|---|---|
| IP literal privada o loopback (`https://127.0.0.1`, `https://[::1]`, `https://2130706433`) | D7: ninguna IP literal, después de la normalización WHATWG |
| Nombre que resuelve a privada (`interno.empresa.com → 10.0.0.5`) | D9: `lookup` propio que rechaza si **alguna** dirección no es pública |
| DNS rebinding (primera resolución pública, segunda privada) | D9: una sola resolución, la misma IP validada es la del socket |
| Redirect a privada, a metadata o a `http:` | D8: cada salto pasa por D7, D5 y D9 |
| IPv4 mapeada en IPv6 (`::ffff:169.254.169.254`), NAT64, 6to4 | D9: extracción explícita y rangos IPv6 bloqueados |
| Red privada de Railway (`api.railway.internal`, ULA `fd…`) | D7 (`.internal`) y D9 (`fc00::/7`) |
| Puertos internos (`https://host:5432`) | D7: solo 443 |
| Credenciales en la URL, cookies o sesión reenviadas | D7 y D9: sin `userinfo`, sin `Cookie`/`Authorization`, sin cabeceras de entrada |
| Respuesta enorme o bomba de compresión | D9: tope después de descomprimir y `Content-Length` |
| Slowloris o servidor que no contesta | D9: plazo total 10 s y socket 5 s |
| Abuso del panel como proxy de escaneo | D15: 10 por minuto, solo con sesión; los errores no devuelven el cuerpo remoto ni la IP |
| Fuga de la respuesta remota | Solo se devuelven los campos normalizados; un error nunca incluye el cuerpo remoto |

Riesgo residual: un host público controlado por un atacante puede recibir un `GET` del servidor (es lo que hace la función) y ver la IP de salida de Railway. Es aceptable: lo dispara solo el owner con su sesión.

### D11 — Detección de términos: diccionario versionado más el vocabulario

- `job-posting/domain/term-dictionary.ts`: `TERM_DICTIONARY: ReadonlyArray<{ term: string; aliases: readonly string[] }>`, con `term` en el formato de los tags (`dotnet`, `nodejs`, `spring-boot`, `kubernetes`, `liderazgo`…) y alias ES/EN (`dotnet`: `.net`, `c#`, `asp.net`, `.net core`; `nodejs`: `node.js`, `node`; `microservices`: `microservicios`, `microservices`; `leadership`: `liderazgo`, `leadership`, `team lead`, `tech lead`). Arranca con unos 80 términos: los tags del CV real y del ejemplo más las tecnologías frecuentes que **no** están (para poder decir «sin respaldo»: `kubernetes`, `go`, `rust`, `terraform`…).
- `detectTerms(text, dictionary, vocabulary): string[]` (puro):
  - Normaliza: NFKD sin diacríticos, minúsculas; todo carácter fuera de `[a-z0-9#+.]` pasa a espacio; se colapsan espacios; a cada token se le quita el `.` final (fin de oración) salvo que el token empiece con `.` (`.net`).
  - Un alias o un tag se busca como **secuencia de tokens completa** (`spring boot` son dos tokens; `java` no matchea en `javascript`).
  - Cada tag del vocabulario se busca también por sus propias formas: el slug con guiones como espacios (`spring-boot` → `spring boot`), sin separador (`springboot`) y tal cual.
  - Alias ambiguos de una o dos letras (`go`, `r`, `c`) no se usan solos: `go` se detecta por `golang` o `go lang`.
  - Devuelve términos únicos ordenados: los del diccionario por su `term` y los del vocabulario por su tag.
- Se corre al importar sobre `title + description` y se guarda en `JobPosting.detectedTerms`. Reimportar vuelve a correrlo con el diccionario y el vocabulario de ese momento.

Alternativas descartadas:
- **Usar los nombres de las skills como alias de sus tags.** Una skill «PostgreSQL» con tags `backend` y `data` haría detectar `backend` por mencionar PostgreSQL: demasiados falsos positivos genéricos.
- **Diccionario editable desde el panel.** Pide tabla, API y pantalla para algo que se ajusta pocas veces; queda para cuando haga falta (P7, resuelta con la recomendación).

### D12 — `computeTagCoverage` y la sugerencia

- `shared/domain/tag-vocabulary.ts` (puro): `collectTagVocabulary(items: { tags; visible }[]): { tags: string[]; evidence: Map<string, number> }` con los tags de los ítems **visibles** (experiencias y proyectos con `visible`, todas las skills), y la cantidad de ítems que llevan cada uno. Es el mismo criterio que `curated.unmatched-filter-tag`, así una sugerencia nunca dispara ese hallazgo. Lo usan `job-posting` (sugerencia) y `curated-profile` (validación del borrador), cada uno con su lector.
- `computeTagCoverage(detectedTerms, vocabulary): TagCoverage` en `job-posting/domain/services/` (puro):
  - `covered`: los términos detectados que están en el vocabulario, con `evidence` (ítems que lo llevan), ordenados por evidencia desc y tag asc.
  - `uncovered`: los detectados que no están en el vocabulario, ordenados alfabéticamente.
  - `detectedCount`, `coveredCount` y `ratio = coveredCount / detectedCount` redondeado a dos decimales; `null` si no se detectó nada.
  - `suggestedFilterTags`: los primeros 8 de `covered`. **Invariante (propiedad con `fast-check`): siempre ⊆ vocabulario y sin repetidos.**
- `SuggestProfileCriteriaFromPostingUseCase` devuelve **solo** `{ coverage, suggestedFilterTags, suggestedTitle, suggestedSlugBase }` y se calcula en cada `GET` contra el vocabulario vigente (no se guarda): si el owner cambia sus tags, la sugerencia cambia.
- `suggestedTitle` = título de la vacante (≤ 120); `suggestedSlugBase` = `slugifyDraft(company, title)`: NFKD, minúsculas, `[^a-z0-9]+` → `-`, sin guiones extremos, ≤ 60 caracteres cortando en un guion; vacío → `vacante`.

Alternativa descartada: **cobertura ponderada por años o por cantidad de experiencias.** Es más opinable y la propuesta pide una cobertura determinística simple; la evidencia por tag ya se muestra al lado.

### D13 — Texto de la vacante: 90 días y purga perezosa (P5 = B, resuelta)

- **El owner decidió el 2026-11-12: pregunta 5 = B.** La descripción normalizada (`description`, ≤ 20 000 caracteres; si es más larga se corta y `descriptionTruncated = true`) se guarda con `textPurgeAt = importedAt + 90 días`. Es el único «texto crudo» que se guarda: **la respuesta JSON o el HTML remoto nunca se persisten**.
- Purga, sin depender del scheduler de `add-integrations-foundation`:
  - **Perezosa**: `ImportJobPostingUseCase`, `ListJobPostingsUseCase` y `GetJobPostingUseCase` llaman primero a `repo.purgeExpiredText(now)`, un único `UPDATE "JobPosting" SET description = NULL, "descriptionTruncated" = false WHERE "textPurgeAt" <= now AND description IS NOT NULL` (con índice por `textPurgeAt`).
  - **Comando**: `npm run job-postings:purge` (`backend/scripts/purge-job-posting-text.ts`) hace lo mismo e imprime cuántas filas purgó; sirve para correrlo a mano o, cuando exista, desde el cron de `sync`.
- Después de la purga quedan título, empresa, ubicación, modalidad, URLs, fechas y `detectedTerms`: la sugerencia sigue funcionando (D12). La pantalla muestra «El texto se borró el {fecha}» o «El texto se borra el {fecha}».
- Reimportar renueva `importedAt` y `textPurgeAt`.
- El reloj es el puerto `CLOCK` (tests con fecha fija).

Alternativas descartadas:
- **No guardar el texto (P5 = A).** La pantalla no podría mostrar la descripción al volver a la vacante.
- **Guardarlo sin límite (P5 = C).** Acumula texto de terceros, que puede incluir nombres de reclutadores, sin un uso que lo justifique.
- **Esperar el cron de `sync`.** Ata este change a `add-integrations-foundation`.

### D14 — Entidad `JobPosting`, URL canónica y reimportación idempotente

| Campo | Tipo | Regla |
|---|---|---|
| `source` | `JobPostingSourceKind` | `GREENHOUSE`, `LEVER`, `ASHBY`, `JSON_LD`, `PASTED` |
| `sourceKey` | texto único | D3, D4, D6 |
| `sourceUrl` | texto o nulo | URL canónica pedida (o la de referencia del texto pegado) |
| `applyUrl` | texto o nulo | solo https; si no, nulo |
| `title` | texto | 1 a 200 |
| `company` | texto o nulo | ≤ 160 |
| `location` | texto o nulo | ≤ 200 |
| `workplaceType` | `WorkplaceType` o nulo | `REMOTE`, `HYBRID`, `ONSITE` |
| `employmentType` | texto o nulo | ≤ 60 |
| `compensation` | texto o nulo | ≤ 200, tal como lo da la fuente |
| `language` | `es`, `en` o nulo | D6 (también para ATS y JSON-LD, sobre la descripción) |
| `postedAt` | fecha o nula | la de la fuente |
| `description` | texto o nulo | ≤ 20 000; nulo tras la purga |
| `descriptionTruncated` | booleano | |
| `detectedTerms` | texto[] | D11 |
| `importedAt`, `textPurgeAt` | instantes | D13 |
| `createdAt`, `updatedAt` | instantes | Prisma |

- Textos planos, no bilingües: es un dato del panel, en el idioma de la vacante (`docs/I18N.md`, campos no traducibles).
- **URL canónica** (`canonicalizeUrl`, pura): sin fragmento, host en minúsculas sin punto final, sin parámetros `utm_*`, `gh_src`, `lever-source`, `ref` y `source`, y el resto ordenado.
- **Reimportar** (mismo `sourceKey`): actualiza todos los campos, `importedAt` y `textPurgeAt`, y responde **200**; nueva → **201**. Un `P2002` por carrera se reintenta una vez como actualización.
- HTML → texto (`htmlToText`, puro): decodifica entidades nombradas comunes y numéricas (dos pasadas para el `content` de Greenhouse), convierte `<br>`, `</p>`, `</li>` y encabezados en saltos de línea, `<li>` en «• », quita el resto de etiquetas y el contenido de `<script>` y `<style>`, y colapsa espacios. Sin dependencias.

### D15 — Límite propio de la importación

- `POST /api/admin/job-postings` lleva `@Throttle({ default: { limit: 10, ttl: 60_000 } })`: **10 importaciones por minuto por IP**, con su propio contador del `ThrottlerGuard` global (las demás rutas siguen con el límite global). Pasarlo → 429 con `Retry-After`.
- Va además con `JwtAuthGuard`: una petición sin sesión da 401 y no sale ninguna petición.
- Constantes en código, sin variables de entorno nuevas (no se toca `env.validation.ts`, que también modifica `add-integrations-foundation`).

Alternativa descartada: **un guard propio como el del cambio de contraseña.** Ese guard existe para no gastar el cupo con peticiones anónimas sobre credenciales; aquí una petición anónima no hace nada costoso y el decorador estándar alcanza.

### D16 — Errores de importación: 422 con un mensaje accionable

- `ImportFailure` es una subclase de `RuleViolationError` (→ 422) con un `reason` interno (`closed-portal`, `url-not-allowed`, `blocked-address`, `too-many-redirects`, `timeout`, `too-large`, `unexpected-content-type`, `not-found`, `upstream-error`, `no-posting-found`, `unparseable`) que va al log, no al cuerpo.
- El cuerpo es el estándar (`statusCode`, `error: "Unprocessable Entity"`, `message`). Todos los mensajes de una URL terminan en «Pegá el texto de la vacante.» salvo el de portal cerrado (D5), que ya lo dice.
- `blocked-address` usa un mensaje genérico, «La URL apunta a una dirección que no está permitida. Pegá el texto de la vacante.», sin la IP resuelta.
- 400 queda para la forma de la entrada (`url` y `text` juntos o ninguno, `url` que no es URL, texto fuera de 50 a 50 000).

Alternativa descartada: **502 para las fallas del sitio remoto.** Es más preciso pero pide una base de error nueva y su mapeo en `api-platform`, y para el panel la acción es la misma: pegar el texto.

### D17 — Borrador desde `curated-profile`

- `POST /api/admin/curated-profiles/from-job-posting` con `{ jobPostingId, filterTags: string[] (1 a 20), title?: string (1 a 120), slug?: string }`.
- `CreateCuratedProfileFromJobPostingUseCase`:
  1. `JOB_POSTING_READER.findDraftSource(jobPostingId)`; nula → 404.
  2. `filterTags` sin repetidos y **cada uno en el vocabulario** (`TAG_VOCABULARY_READER` propio de `curated-profile`, con `collectTagVocabulary`); si no → 400 que nombra los tags desconocidos. Vacío → 400. El owner puede elegir cualquier tag del vocabulario, no solo los sugeridos.
  3. Slug: el dado (kebab-case; ocupado → 409, como al crear) o `slugifyDraft(company, title)` con el primer libre entre la base y `-2` … `-50` (mismo límite que duplicar); sin libre → 409.
  4. Crea con el camino de `CreateCuratedProfileUseCase` (`validateCuratedProfile` y `checkReferences`): `title = { es: t, en: t }` (`t` = `title` o el de la vacante), `headline` vacío (hereda el del perfil base), `description`, `roleType`, `techFocus` y `themeId` nulos, `includeIds` y `excludeIds` vacíos, layout `classic`, secciones por defecto, **`visibility: PRIVATE`, `listed: false`** y sin token.
- Responde 201 con `AdminCuratedProfileOutput`. La vacante no se modifica.
- `CuratedProfile` no guarda un vínculo con la vacante (D21).

### D18 — Pantalla «Crear desde una vacante»

- Ruta `/admin/perfiles/desde-vacante` (estática, por delante de `perfiles/:id`), dentro de `RequireSession`/`AdminLayout`; el ítem activo de la navegación sigue siendo **Perfiles curados**. Se llega con el botón **Desde una vacante** (ícono `FileSearch`) del encabezado de Perfiles curados, junto a **Nuevo perfil**. **Sin ítem nuevo en `NAV`** (la barra tiene nueve y entra justa).
- **Formulario** (RHF + Zod, `job-postings/job-posting-form.ts`) con un grupo de radio «Origen»: **URL** (campo «URL de la vacante», ayuda «Greenhouse, Lever, Ashby o la página de empleo de la empresa. LinkedIn, Indeed y otros portales no se pueden leer: usá Texto.») o **Texto** (área «Texto de la vacante» y los opcionales «Título», «Empresa» y «URL de referencia»). Botón **Analizar vacante**, deshabilitado y con `aria-busy` mientras espera.
- Ante un 422 de portal cerrado, el mensaje va en una región `role="alert"` con el botón **Pegar el texto**, que cambia a Texto y copia la URL a «URL de referencia».
- **Resultado** (al importar o al abrir `?vacante={id}`): título, empresa, ubicación, modalidad, fuente, «Ver la vacante» (`applyUrl`, `target="_blank"` y `rel="noopener noreferrer"`), la descripción en un `<details>` y la fecha de purga (D13).
- **Cobertura**: «Cubre {n} de {m} requisitos detectados ({p} %)» o «No detectamos requisitos conocidos en esta vacante»; lista **Con respaldo en tus datos** con una casilla por tag (los sugeridos marcados) y «en {k} ítems»; lista **Sin respaldo** con los términos sin casilla.
- **Borrador**: «Título del perfil» (prellenado) y «Slug (opcional)» con la ayuda «Si lo dejás vacío, se arma con la empresa y el puesto.»; botón **Crear borrador**, que lleva a `/admin/perfiles/{id}` con el toast «Borrador creado. Es privado hasta que lo publiques.».
- **Vacantes importadas**: tabla con Puesto y empresa, Fuente, Importada y acciones **Abrir** (pone `?vacante={id}`) y **Borrar** (con `ConfirmDialog`); vacía: «Todavía no importaste vacantes».
- Mensajes literales (los cita el manual; `manual:check` los busca en `frontend/src`):
  - `Pegá la URL de la vacante` · `Usá una URL que empiece con https://`
  - `Pegá al menos 50 caracteres del texto de la vacante` · `Usá como máximo 50000 caracteres`
  - `Elegí al menos un tag`
  - toasts: `Vacante importada`, `Vacante actualizada` (200), `Vacante borrada`, `Borrador creado. Es privado hasta que lo publiques.`
  - 429: `Hiciste muchas importaciones seguidas. Esperá un minuto.`
  - los 422 se muestran con el `message` del servidor (D5, D16).
- Estado solo en la URL y en memoria; sin `localStorage` ni `sessionStorage`.

Alternativas descartadas:
- **Ítem «Vacantes» en la barra.** Sería el décimo y la barra ya no entra a 1280 px sin rediseñarla.
- **Un diálogo dentro de Perfiles curados.** El resultado (cobertura, descripción, borrador) no entra cómodo en un diálogo y no tendría URL propia.

### D19 — Test de arquitectura

Se suman a `test/architecture.spec.ts`:
1. Ningún archivo de `modules/job-posting` importa una ruta que contenga `curated-profile/` (más estricto que «sus repositorios»).
2. Ningún archivo de `modules/job-posting` contiene `.curatedProfile.(create|createMany|update|updateMany|upsert|delete|deleteMany)`.
3. Los archivos de `modules/curated-profile` solo importan de `job-posting/` rutas bajo `job-posting/application/ports/`.
4. Ningún archivo de `modules/curated-profile`, salvo `curated-profile.module.ts` y el caso de uso de D17, importa algo de `job-posting/` (la ruta pública y el preview no dependen de terceros).

Cada regla con su autocontrol (un archivo sonda que la viola), como el que ya existe.

### D20 — Migración aditiva, sin dependencias nuevas

```prisma
enum JobPostingSourceKind { GREENHOUSE LEVER ASHBY JSON_LD PASTED }
enum WorkplaceType { REMOTE HYBRID ONSITE }

model JobPosting {
  id                   String               @id @default(cuid())
  source               JobPostingSourceKind
  sourceKey            String               @unique
  sourceUrl            String?
  applyUrl             String?
  title                String
  company              String?
  location             String?
  workplaceType        WorkplaceType?
  employmentType       String?
  compensation         String?
  language             String?
  postedAt             DateTime?
  description          String?
  descriptionTruncated Boolean              @default(false)
  detectedTerms        String[]             @default([])
  importedAt           DateTime
  textPurgeAt          DateTime
  createdAt            DateTime             @default(now())
  updatedAt            DateTime             @updatedAt

  @@index([importedAt])
  @@index([textPurgeAt])
}
```

- Sin relaciones con tablas existentes: la migración es `CREATE TYPE`, `CREATE TABLE` e índices; ningún `ALTER`, `UPDATE` ni `DROP`.
- Todo lo necesario está en Node 22 y `package.json`.

### D21 — Lo que queda para después (P8 y P6, resueltas con la recomendación)

- **Vínculo borrador ↔ vacante** (`CuratedProfile.sourceJobPostingId`): no entra. Tocaría el modelo y el contrato de `CuratedProfile`, que otros changes cambian en paralelo, para un dato que hoy ninguna pantalla usa. Lo retoma `add-ai-vacancy-to-profile` si lo necesita.
- **Crear una postulación desde la vacante**: no entra. Sería un tercer módulo involucrado; el owner puede copiar la URL al diálogo de Postulaciones.

### D22 — Estrategia de pruebas sin red

- **Fuentes**: fixtures sanitizados y ficticios (empresa «Acme Ejemplo», sin nombres ni emails reales) en `job-posting/infrastructure/sources/__fixtures__/`, con la forma documentada de cada API y una nota de fecha y fuente; una suite de contrato `describeJobPostingSourceContract(name, factory, cases)` que corre cada fuente con un `SafeHttpClient` falso: título no vacío, `applyUrl` https o nulo, `sourceKey` estable, descripción ≤ 20 000 y sin etiquetas HTML.
- **Guarda**: tests de tabla de `checkUrlPolicy`, `classifyClosedPortal` e `isPublicAddress` (cada rango de D9 con el primer y el último valor, y vecinos públicos), y de `SafeHttpClient` con un `HttpTransport` y un `DnsResolver` falsos (redirect a privada, a `http:`, a portal cerrado, cuarto redirect, `Content-Type`, 404).
- **Transporte**: `NodeHttpTransport` contra un `http.createServer` local en `127.0.0.1` con un `lookup` de prueba que mapea `acme.test` → `127.0.0.1` (el transporte no aplica política; la política está en `SafeHttpClient`): tope con y sin `Content-Length`, gzip que se expande por encima del tope, plazo vencido y que no envía `Cookie`.
- **Integración de la guarda real**: `SafeHttpClient` con el `NodeHttpTransport` real y un resolver que devuelve `127.0.0.1`: rechaza **sin que el servidor local reciba ninguna conexión**.
- **e2e**: los módulos de prueba de Nest sobrescriben `HTTP_TRANSPORT` y `DNS_RESOLVER`; ningún test sale a internet.

## Risks / Trade-offs

- **[Las APIs de los ATS cambian]** → fuentes aisladas, suite de contrato y fixtures fechados; si una falla, la pantalla ofrece pegar el texto.
- **[Ashby baja el board completo]** → tope de 5 MiB; un board más grande da 422 con «Pegá el texto».
- **[Falsos positivos en la detección]** (`react` como verbo, `lead` genérico) → el owner elige las casillas; los alias ambiguos cortos no se usan solos (D11).
- **[Diccionario incompleto]** → un término que no conoce ni el diccionario ni el vocabulario no aparece ni como «sin respaldo»; se amplía en código con su test.
- **[El texto de la vacante puede tener datos de terceros]** (nombre o email del reclutador) → se guarda 90 días (P5 = B), solo en el panel, nunca en logs ni en la ruta pública.
- **[Un sitio público controlado por terceros recibe el GET]** → riesgo residual aceptado (D10).
- **[`net.BlockList` y las IPv4 mapeadas]** → extracción explícita con test (D9), sin depender del comportamiento de la versión de Node.
- **[Límite en memoria]** → el contador de `@nestjs/throttler` es por instancia; con una sola réplica en Railway alcanza.
- **[Regex sobre entrada remota]** (revisión de seguridad 12.2, hallazgo alto) → las regex con `[\s\S]*?` o `[^>]*` son cuadráticas con entradas patológicas (100 KB de `<a ` tardaban unos 4 s; 2 MiB, horas) y el `AbortSignal` no corta código síncrono. `htmlToText` corta su entrada a 100 000 caracteres (5 veces `MAX_DESCRIPTION_LENGTH`) y es un recorrido lineal (`indexOf`; una etiqueta es `<` + letra + `[^<>]*` + `>`; comentario, `<script>` o `<style>` sin cierre descartan el resto); el escáner de JSON-LD también es lineal y termina si no hay cierre. Test de tiempo con 2 MiB patológicos (`redos.spec.ts`, umbral 500 ms; medido: pocos ms).
- **[Título del texto pegado]** → sin `title`, el título es la primera línea del texto crudo: sobrevive a la purga de 90 días y se copia al perfil curado. Se acepta (decisión de la sesión principal); el campo **Título** de la pantalla lo aclara.
- **[Purga sin cron]** → la purga es perezosa (al listar, leer o importar); `npm run job-postings:purge` existe pero ningún cron lo corre todavía. Pendiente para el deploy (cron de Railway).
- **[Changes en paralelo]** → `schema.prisma` (modelos nuevos al final del archivo en este change y en `add-integrations-foundation`), `app.module.ts`, `architecture.spec.ts`, `docs/MANUAL.md` (TC-51 reservado; la pantalla B17 puede chocar), `index.html`, `capture-manual.mjs`, `check-a11y.mjs`, `CHANGELOG.md`, `ARCHITECTURE.md` y los generados `openapi.json`/`api.d.ts` (se regeneran después del merge). Se resuelven en el merge sin renumerar TC-51.

## Migration Plan

1. **Migración** `<timestamp>_add_job_posting_intake`: generada con `prisma migrate dev --create-only` contra una base descartable (`portfolio_intake_check`) y revisada a mano (solo `CREATE TYPE`, `CREATE TABLE` y `CREATE INDEX`).
2. **Deploy:** corre en el `preDeployCommand`. Sin backfill: la tabla nace vacía.
3. **Base local del owner (`portfolio`, 5434):** la migra él con `npm run prisma:migrate`; ninguna tarea la toca.
4. **Rollback:** revertir el código deja la tabla sin uso; quitarla exige una migración inversa con `DROP TABLE` y `DROP TYPE` (pierde las vacantes importadas; ningún perfil curado depende de ellas).

## Open Questions

Ninguna bloqueante. Todas quedaron resueltas: P14 = A (2026-11-07) y P5 = B (2026-11-12) por el owner; el resto, con la recomendación, por indicación del owner del 2026-11-12 (revisables en un change posterior sin romper este contrato):

- **P1 — ¿Se acepta `http://`?** A) Solo https. B) También http con la misma guarda. **Resuelta: A** (D7).
- **P3 — ¿JSON-LD en cualquier host o solo en una lista?** A) Cualquier host https público no cerrado. B) Solo una lista de hosts. **Resuelta: A** (D4).
- **P4 — Portales cerrados.** ¿Get on Board y los agregadores entran en la lista? **Resuelta: sí**, hasta revisar sus términos (D5).
- **P8 — Vínculo del borrador con la vacante.** **Resuelta: no en este change** (D21).
- **P6 — Postulación desde la vacante.** **Resuelta: no en este change** (D21).
- **P7 — Diccionario de términos editable desde el panel.** **Resuelta: no, versionado en código** (D11).
