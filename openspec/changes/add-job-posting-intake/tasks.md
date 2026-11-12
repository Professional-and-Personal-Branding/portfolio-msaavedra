# Tasks — add-job-posting-intake

> Referencias: `proposal.md`, `design.md` (D1–D22) y los deltas de `specs/` (`job-posting-intake`, `admin-curated-profile-crud`, `curated-profile-builder`, `api-rate-limiting`, `platform-manual`). La evidencia va en `verification/`, como en `add-application-tracking`.
>
> **Rama:** `feat/job-posting-intake` desde `main`. **TC-51** es de este change; si otro change toma B17 en `docs/MANUAL.md`, se usa la siguiente pantalla libre y se resuelve en el merge sin renumerar TC-51.
>
> **Orden:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12. Cada grupo de código va en el mismo commit que sus tests. Las fuentes (4.2 a 4.4) pueden repartirse entre varios `implementador` en paralelo una vez cerrados 2, 3 y 4.1.
>
> **Red:** **ningún test sale a internet.** Los fixtures son ficticios y sanitizados («Acme Ejemplo», sin nombres ni emails reales), con la forma documentada de cada API y una nota de fecha y fuente en el encabezado.
>
> **Bases:**
> - `portfolio` (la del owner, `localhost:5434`): **ninguna** tarea le aplica la migración ni le escribe.
> - Los e2e corren contra la base de e2e de siempre (migrada y sembrada), nunca contra `portfolio`.
> - `portfolio_intake_check`: base descartable **nueva** en el mismo contenedor, para generar la migración (3.1) y para la app real (10), sembrada con el ejemplo; borrada al terminar.
>
> Antes de cada comando que escriba en una base, correr `npm run prisma:status` y confirmar el destino. Las credenciales del administrador de prueba se generan en la terminal y nunca se imprimen ni se escriben en `verification/`.

## 1. Punto de partida

- [ ] 1.1 Confirmar en la rama: no existen el modelo `JobPosting` ni el módulo `job-posting`; `NAV` tiene nueve ítems; `RuleViolationError` mapea a 422; no hay `nock`, `undici` ni parser de HTML en `package.json`. Verificar: `npm test`, `npm run test:e2e` y `npm run lint` en `backend/` y `npm test` en `frontend/` verdes antes de tocar nada; conteos en `verification/1.1-punto-de-partida.txt`.

## 2. Dominio puro (D5, D6, D7, D11, D12, D14)

- [ ] 2.1 `shared/domain/tag-vocabulary.ts`: `collectTagVocabulary` (D12). Verificar: `tag-vocabulary.spec.ts` (experiencia oculta no aporta, proyecto oculto no aporta, skills siempre aportan, evidencia por tag, orden estable).
- [ ] 2.2 `job-posting/domain/services/check-url-policy.ts` (D7) y `canonicalize-url.ts` (D14). Verificar: test de tabla con `http:`, puerto 5432, `user:pass@`, `127.0.0.1`, `2130706433`, `0x7f.1`, `[::1]`, `[::ffff:127.0.0.1]`, `localhost`, `x.localhost`, `api.railway.internal`, `nas.local`, `intranet` (sin punto), `acme.test`, host con punto final, URL de 2049 caracteres → rechazo; `https://careers.acme-ejemplo.com/job/1` → ok; canónica sin fragmento ni `utm_*`/`gh_src`/`lever-source`/`ref`/`source` y con la query ordenada.
- [ ] 2.3 `job-posting/domain/closed-portals.ts` y `classifyClosedPortal` (D5). Verificar: test de tabla con cada regla de D5 (incluidos `www.linkedin.com`, `lnkd.in`, `ar.indeed.com`, `indeed.com.mx`, `glassdoor.co.uk`, `angel.co`), y negativos `misindeedjobs.com`, `linkedin.com.acme-ejemplo.com`, `boards.greenhouse.io`.
- [ ] 2.4 `match-ats-url.ts` (D3): reconoce las URLs de la tabla de D3 y valida `board`/`site`/`org`/`id` con `^[A-Za-z0-9._-]{1,100}$`. Verificar: test de tabla con cada patrón, con y sin `/apply` o `/application`, el `embed/job_app` de Greenhouse, un id con `../` (rechazo) y una URL de empresa (sin ATS).
- [ ] 2.5 `term-dictionary.ts` (unos 80 términos, D11) y `detect-terms.ts`. Verificar: `detect-terms.spec.ts`: `.NET Core y C#` → `dotnet`; `JavaScript` no da `java`; `Spring Boot` y `springboot` → `spring-boot` del vocabulario; `go` suelto no detecta y `Golang` sí; tildes (`microservicios` y `Microservícios`); punto final de oración (`Kubernetes.`); orden y unicidad del resultado.
- [ ] 2.6 `compute-tag-coverage.ts` (D12) y `slugify-draft.ts`. Verificar: tests de ejemplo (2 de 4 → 0,5; nada detectado → `null`; tope de 8 sugeridos; orden por evidencia y tag) y una propiedad con `fast-check`: los sugeridos ⊆ vocabulario, sin repetidos, `coveredCount + uncovered.length = detectedCount`; `slugifyDraft` cumple `SLUG_REGEX`, ≤ 60 y da `vacante` con entrada vacía.
- [ ] 2.7 `extract-from-pasted-text.ts` y `html-to-text.ts` (D6, D14). Verificar: tests de modalidad (la prioridad HYBRID > REMOTE > ONSITE), tipo de empleo, idioma (`es`, `en` y `null` cuando no hay el doble), título por primera línea; `htmlToText` con entidades nombradas y numéricas, doble escape de Greenhouse, `<script>`/`<style>` descartados, listas con «• » y sin etiquetas en la salida.
- [ ] 2.8 Entidad `JobPosting`, errores (`ImportFailure extends RuleViolationError` con `reason`, `JobPostingNotFoundError`), puertos `JobPostingRepository` (incluye `purgeExpiredText(now)`) y `TagVocabularyReader` con tokens Symbol. Verificar: `npm run typecheck` y el test de arquitectura existente (sin Nest ni Prisma en `domain/`).

## 3. Persistencia y migración (D13, D14, D20)

- [ ] 3.1 `schema.prisma`: enums `JobPostingSourceKind` y `WorkplaceType` y el modelo `JobPosting` de D20, al final del archivo. Migración `<timestamp>_add_job_posting_intake` con `prisma migrate dev --create-only` **contra `portfolio_intake_check`**, revisada a mano: solo `CREATE TYPE`, `CREATE TABLE` y `CREATE INDEX`/`CREATE UNIQUE INDEX`. Verificar: el SQL en `verification/3.1-migracion.sql`; `npm run prisma:generate` y `npm run typecheck` verdes; `prisma migrate diff --from-url <portfolio_intake_check> --to-schema-datamodel prisma/schema.prisma --exit-code` sin diferencias.
- [ ] 3.2 `PrismaJobPostingRepository` (`upsertBySourceKey` que devuelve si era nueva, con un reintento ante `P2002`; `list` por `importedAt` desc; `findById`; `delete` con `P2025` → `false`; `purgeExpiredText` como un único `updateMany`) y `PrismaTagVocabularyReader` (solo lectura de tags y visibilidad). Verificar: cubiertos por los e2e de 7.

## 4. Cliente HTTP seguro y fuentes (D3, D4, D8, D9, D10, D22)

- [ ] 4.1 `infrastructure/http/`: `address-policy.ts` (`isPublicAddress` con `net.BlockList` y la extracción explícita de IPv4 mapeadas), `node-http-transport.ts` (`lookup` inyectable, `AbortSignal`, timeout de socket, `Accept-Encoding: gzip, deflate` y descompresión con tope posterior, sin keep-alive compartido) y `safe-http-client.ts` (D7, D5, D8, `Content-Type`, estados y clasificación en `ImportFailure`), con los tokens `HTTP_TRANSPORT` y `DNS_RESOLVER`. Verificar:
  - `address-policy.spec.ts`: el primer y el último valor de cada rango de D9 rechazados; `169.254.169.254`, `::ffff:169.254.169.254`, `::ffff:7f00:1`, `64:ff9b::a00:1`, `2002:c0a8:0101::1`, `fd12:3456::1`, `fe80::1` rechazados; `93.184.216.34` y `2606:4700::1111` aceptados.
  - `safe-http-client.spec.ts` (transporte y resolver falsos): redirect a host que resuelve a `172.16.0.10`, a `http:`, a `lnkd.in` y a IP literal → 422 sin pedir el destino; cuarto redirect → 422; `Location` relativa resuelta; `application/pdf` → 422; 404 y 410 → «No encontramos esa vacante (puede estar cerrada)»; 500 → «La página respondió con un error»; un resolver que devuelve una pública y una privada → rechazo; los errores no incluyen la IP ni el cuerpo remoto.
  - `node-http-transport.spec.ts` (servidor `http` local, `lookup` de prueba `acme.test` → `127.0.0.1`): tope con `Content-Length` grande (corta sin leer), sin `Content-Length` (corta al pasar), gzip de 100 KB que se expande a 3 MiB → corta; plazo vencido con un servidor que no termina; la petición recibida no trae `Cookie` ni `Authorization` y es `GET`.
  - Integración: `SafeHttpClient` con el transporte real y un resolver que devuelve `127.0.0.1` rechaza y **el servidor local registra 0 conexiones**.
- [ ] 4.2 `GreenhouseSource` con fixtures `greenhouse-job.json` (con `content` doblemente escapado) y `greenhouse-no-company.json`. Verificar: `describeJobPostingSourceContract` (título no vacío, `applyUrl` https o nulo, `sourceKey` estable, descripción ≤ 20 000 y sin etiquetas) más casos propios (empresa humanizada del `board` si falta `company_name`; la URL pedida a la API usa el host fijo).
- [ ] 4.3 `LeverSource` con fixture `lever-posting.json` (incluye `lists[]` y `workplaceType: hybrid`). Verificar: la suite de contrato; descripción = `descriptionPlain` + listas + `additionalPlain`; `createdAt` en ms → fecha; `jobs.eu.lever.co` → `api.eu.lever.co`.
- [ ] 4.4 `AshbySource` con fixture `ashby-board.json` (tres vacantes, una con `compensation`). Verificar: la suite de contrato; elige el id pedido; id ausente → 422; usa el tope de 5 MiB; la petición lleva `includeCompensation=true`.
- [ ] 4.5 `JsonLdJobPostingSource` con fixtures HTML `jsonld-graph.html` (dentro de `@graph`, `@type` como arreglo), `jsonld-array.html`, `jsonld-invalid-then-valid.html` (el primer bloque no es JSON válido) y `no-jsonld.html`. Verificar: la suite de contrato; `TELECOMMUTE` → `REMOTE`; `baseSalary` → texto; sin bloque → 422 «No encontramos una vacante en esa página. Pegá el texto de la vacante.»; un `url` `http:` en el JSON-LD deja `applyUrl` nulo.
- [ ] 4.6 Confirmar contra la documentación oficial de los tres ATS las rutas de la API y la variante EU de Greenhouse (D3) y anotar el resultado y la fecha en el encabezado de cada fixture. Verificar: nota en `verification/4.6-ats-docs.md` con el enlace y lo que se confirmó o se descartó.

## 5. Aplicación (D1, D2, D12, D13, D16)

- [ ] 5.1 DTOs de salida (`JobPostingOutput` con `textPurgeAt` y `textPurged`, `JobPostingSuggestionOutput`) y mapper. Verificar: tests del mapper (fechas ISO, `description` nula tras la purga).
- [ ] 5.2 Casos de uso, un `execute()` cada uno: `ImportJobPostingUseCase` (purga, URL o texto, elección de fuente, detección, upsert; devuelve si era nueva), `ListJobPostingsUseCase`, `GetJobPostingUseCase`, `DeleteJobPostingUseCase` y `SuggestProfileCriteriaFromPostingUseCase`, con repositorio, lector de vocabulario, fuentes y `CLOCK` por token. Verificar: specs con dobles: (a) un portal cerrado no llama a ninguna fuente; (b) el texto pegado con URL de referencia no llama a ninguna fuente; (c) list, get e import llaman a `purgeExpiredText` con el reloj; (d) `textPurgeAt` = importación + 90 días y reimportar lo renueva; (e) la sugerencia usa el vocabulario del momento del `GET`; (f) la descripción de 25 000 caracteres se corta a 20 000 con `descriptionTruncated`.
- [ ] 5.3 Puerto `JobPostingReader` (`job-posting/application/ports/job-posting.reader.ts`, token `JOB_POSTING_READER`) y su adaptador, exportado por `JobPostingModule`. Verificar: `npm run typecheck`.

## 6. HTTP, módulo y borrador (D15, D16, D17, D19)

- [ ] 6.1 DTOs de entrada (`ImportJobPostingDto` con `url` XOR `text` y los opcionales de D6) y `AdminJobPostingController` bajo `admin/job-postings` con `JwtAuthGuard`, `adminValidationPipe`, `@Throttle({ default: { limit: 10, ttl: 60_000 } })` solo en `POST`, 201/200 según la importación, Swagger con 400, 401, 404, 422 y 429. `JobPostingModule` cablea los tokens (transporte y resolver reales, política fija) y `AppModule` lo importa. Verificar: `npm run typecheck`, `npm run lint` y los e2e de 7.
- [ ] 6.2 `curated-profile`: `TagVocabularyReader` propio (Prisma, solo lectura) con `collectTagVocabulary`, `CreateCuratedProfileFromJobPostingUseCase` (D17) y la ruta `POST /api/admin/curated-profiles/from-job-posting` (declarada antes de `:id`), con `CuratedProfileModule` importando `JobPostingModule`. Verificar: spec del caso de uso con dobles: vacante inexistente → 404 sin escribir; tag fuera del vocabulario → 400 que lo nombra, sin escribir; vacío o repetidos → 400; slug derivado con sufijo libre y `-51` → 409; el perfil creado es `PRIVATE`, `listed: false`, sin token y con `headline` vacío.
- [ ] 6.3 `test/architecture.spec.ts`: las cuatro reglas de D19, cada una con su sonda de autocontrol. Verificar: `npm test` verde; con una sonda temporal en `modules/job-posting` que importa `../curated-profile/domain/...` el test falla (salida en `verification/6.3-arquitectura.txt`).
- [ ] 6.4 `backend/scripts/purge-job-posting-text.ts` y el script `job-postings:purge` en `package.json` (imprime la cantidad purgada; código 0; 1 ante error de base). Verificar: test unitario del script con el repositorio simulado y una corrida contra `portfolio_intake_check` con dos vacantes vencidas a mano (salida en `verification/6.4-purga.txt`).

## 7. E2e (`backend/test/job-postings.e2e-spec.ts`)

> Sobrescribe `HTTP_TRANSPORT` (sirve los fixtures por URL y registra cada petición) y `DNS_RESOLVER` (mapa fijo de hosts a IPs); crea y borra sus propias vacantes y perfiles.

- [ ] 7.1 Importación: Greenhouse, Lever, Ashby y JSON-LD → 201 con los campos normalizados; misma URL con `?utm_source=x#apply` → 200 y una sola fila; texto pegado → 201 y repetido → 200; `url` y `text` juntos → 400; texto de 49 caracteres → 400; sin sesión → 401 en las cinco rutas y **0 peticiones** registradas. Verificar: `npm run test:e2e` verde.
- [ ] 7.2 SSRF y portales: LinkedIn, `lnkd.in`, `ar.indeed.com` → 422 con **0 peticiones**; `http:` → 422; `https://2130706433/` → 422; host que resuelve a `10.0.0.5` → 422 sin la IP en el cuerpo; redirect 301 a un host que resuelve a `172.16.0.10` → 422 y el destino nunca se pide; cuatro redirects → 422; JSON-LD ausente → 422 con el mensaje literal. Verificar: `npm run test:e2e` verde.
- [ ] 7.3 Límite: once `POST` seguidos con sesión → el undécimo 429 con `Retry-After` y sin llegar al transporte; después, `GET /api/admin/job-postings` → 200. Verificar: `npm run test:e2e` verde.
- [ ] 7.4 Sugerencia, purga y borrador: la sugerencia solo trae tags del vocabulario; ocultar la experiencia de un tag lo pasa a «sin respaldo»; con el `CLOCK` a +91 días, `GET` devuelve `description: null` y la sugerencia sigue; `from-job-posting` crea un perfil `PRIVATE` no enumerado (ausente del sitemap y 404 en la ruta pública), tag inventado → 400, slug elegido ocupado → 409, vacante inexistente → 404; borrar la vacante → 204 y el perfil sigue igual. Verificar: `npm run test:e2e` verde.
- [ ] 7.5 Sin rutas públicas: `GET /api/job-postings` → 404; `GET /api/curated-profiles/:slug` de un perfil existente devuelve el mismo cuerpo antes y después de importar vacantes; `sitemap.xml` sin cambios. Verificar: `npm run test:e2e` verde; salida completa en `verification/7-e2e.txt`.

## 8. Contrato

- [ ] 8.1 `npm run openapi:export` y, en `frontend/`, `npm run api:types`: aparecen las cinco rutas de `/api/admin/job-postings`, `POST /api/admin/curated-profiles/from-job-posting`, los enums y las respuestas 422 y 429. Verificar: el test de deriva del frontend verde y `git diff --exit-code` tras un segundo export.

## 9. Panel (D18)

- [ ] 9.1 `job-postings/job-posting-form.ts` (Zod) con los mensajes literales de D18. Verificar: `job-posting-form.spec.ts` (URL vacía, `http://`, texto de 49 y de 50 001 caracteres, URL de referencia `http:`, cero tags elegidos).
- [ ] 9.2 Hooks (`use-job-postings-api.ts`: importar, lista, detalle, sugerencia, borrar y crear borrador) y `JobPostingIntakePage.tsx` con `IntakeForm`, `PostingSummary`, `CoverageList` y `ImportedPostingsTable`; ruta `perfiles/desde-vacante` en `BackofficeApp.tsx` antes de `perfiles/:id`; botón **Desde una vacante** en `ProfilesPage.tsx`. Verificar: `JobPostingIntakePage.test.tsx` con la API simulada: los sugeridos marcados y los sin respaldo sin casilla; «Cubre 2 de 4 requisitos detectados (50 %)»; 422 de portal cerrado en `role="alert"` y **Pegar el texto** que cambia a Texto con la URL en «URL de referencia»; 429 con su mensaje literal; 200 muestra «Vacante actualizada»; **Crear borrador** manda solo los tags marcados y navega a `/admin/perfiles/{id}`; cero tags → «Elegí al menos un tag» sin llamada; `?vacante={id}` abre el análisis al recargar; borrar pide confirmación; «Todavía no importaste vacantes»; `localStorage` y `sessionStorage` sin cambios. `ProfilesPage.test.tsx` ampliado con el botón y `AdminLayout.responsive.test.tsx` sigue con nueve ítems.
- [ ] 9.3 `npm run lint`, `npm run typecheck`, `npm run build` y `npm run perf:budget` en `frontend/`: el código va en el chunk del panel y el arranque público no cambia. Verificar: tamaño del arranque en `verification/9.3-perf-budget.txt` (igual al de `main`).

## 10. App real

- [ ] 10.1 Sobre `portfolio_intake_check` migrada y sembrada con el ejemplo: API de la rama y la imagen de `frontend/Dockerfile`; administrador creado con `admin:bootstrap` y una contraseña aleatoria de la terminal. Verificar: `npm run prisma:status` contra esa base antes de escribir; nota en `verification/10.1-entorno.txt` sin credenciales.
- [ ] 10.2 TC-51 completo según `verification.md` (a escribir en esta tarea a partir de los escenarios de la spec): texto pegado de punta a punta en Chrome; URL de LinkedIn → **Pegar el texto**; `https://127.0.0.1/` y `http://` por `curl` → 422; una URL pública real de un ATS **solo si el owner lo autoriza en el momento** (si no, queda 🔍 con el e2e como evidencia). Verificar: transcripción en `verification/10.2-tc51.txt`.
- [ ] 10.3 `check-a11y.mjs`: sumar `admin-desde-vacante` (vacía), `admin-desde-vacante-analisis` (con una vacante pegada ficticia, sin red) y `admin-desde-vacante-error` (formulario con errores, sin ningún `POST`). `npm run a11y:check` con `A11Y_CHECK_DISPOSABLE_DB=1`, las credenciales de la terminal y `A11Y_CHECK_PROFILE=ejemplo-backend`, en móvil y escritorio. Verificar: 0 violaciones `serious` y 0 `critical`; salida en `verification/10.3-a11y.txt`.

## 11. Docs

- [ ] 11.1 `docs/MANUAL.md` e `index.html`: **TC-51** (texto de `verification.md`) en la sección 3 y en la tabla de la suite (§ 6); pantalla **B17 — Crear desde una vacante** (o la siguiente libre) con fuentes admitidas, portales cerrados, la tabla de campos con la columna *Mensaje* de D18, cómo leer la cobertura, el borrador privado y la purga a 90 días; B8 menciona el botón **Desde una vacante**; el recorrido *Preparar un perfil para una vacante* suma la variante desde una vacante; glosario: *Vacante importada*, *Cobertura* y *Portal cerrado*. Verificar: `npm run manual:check` verde.
- [ ] 11.2 `capture-manual.mjs`: importa por la API, de forma idempotente, una vacante **pegada** ficticia (sin red) y toma `bo-desde-vacante.jpg` con el análisis; actualizar el comentario de cabecera con la escritura nueva. Generar con `manual:capture` sobre la base de ejemplo. Verificar: `manual:check` (inventario y tope de 150 KB) verde; correr la captura dos veces deja una sola vacante (conteo en `verification/11.2-captura.txt`).
- [ ] 11.3 `docs/ARCHITECTURE.md` (módulo `job-posting`, rutas, guarda SSRF en una línea y la regla de dependencia) y `docs/CHANGELOG.md` (módulo, fuentes, portales cerrados, guarda, cobertura, borrador, pantalla, purga, migración aditiva). Verificar: diff revisado.
- [ ] 11.4 Al archivar: la línea del roadmap en `CLAUDE.md` y, en `docs/PROPUESTA-FEATURES.md` § 6.2, la fila con ✅ y la nota de que el puerto vive en `job-posting` (D2). Verificar: diff revisado en el PR de archivado.

## 12. Cierre

- [ ] 12.1 Todo verde: `npm test`, `npm run test:e2e`, `npm run lint` y `npm run typecheck` en `backend/`; `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run perf:budget` y `npm run manual:check` en `frontend/`. Verificar: conteos en `verification/12.1-cierre.txt`.
- [ ] 12.2 Revisión de seguridad independiente (`code-review` o `security-review`) sobre el diff del cliente HTTP, las fuentes y el controller, con el modelo de amenazas de D10 como lista. Verificar: hallazgos y su resolución en `verification/12.2-revision-seguridad.md`.
- [ ] 12.3 `npx -y @fission-ai/openspec@1.14.1 validate add-job-posting-intake --strict` y `validate --all --strict` sin fallos nuevos y sin avisos «Archive would refuse» para este change. Verificar: salida en `verification/12.3-validacion.txt`.
- [ ] 12.4 Borrar `portfolio_intake_check` y confirmar que `portfolio` no tiene la migración (`prisma migrate status` contra ella la muestra pendiente). Verificar: `verification/12.4-base-del-owner.txt`.
