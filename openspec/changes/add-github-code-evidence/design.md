# Design — add-github-code-evidence

## Context

Ver `proposal.md`. Estado verificado el 16 de noviembre de 2026 sobre `main` (`d6c70b5`):

- **Base de integraciones** (`backend/src/modules/integrations/`, change `add-integrations-foundation`, fusionado y sin archivar): `ConnectorPort { id, secretEnv, sync(ctx, signal) }` con `SyncContext { jobId, provider, payload, secret, snapshots, log }`; `PROVIDER_CATALOG` con solo `fake`; `EnabledConnectorRegistry` falla el arranque con un id sin conector; `CredentialResolverService` (variable de entorno primero, base cifrada después); `SnapshotStore` (`get`, `recordNotModified` que solo mueve `fetchedAt`, `record` con `contentHash` y tope de 1 MiB); `classifyHttpFailure` (el `retry-after` solo se mira en un 429; un 403 con `x-ratelimit-remaining: 0` y `x-ratelimit-reset` es `ResetAt`; cualquier otro 403 es `Permanent`); `sanitizeFailure` (`RetryAfter` ≤ 24 h, `ResetAt` ≤ 7 días); un trabajo activo por proveedor (índice único parcial); timeout por trabajo 120 s; corrida ≤ 300 s; scheduler apagado por defecto; pantalla `/admin/integraciones` sin ítem en la barra; aviso del Dashboard con `stale` o `jobs.dead > 0`.
- **Test de arquitectura** (`backend/test/architecture.spec.ts`): `curated-profile`, `profile` y `analytics` no importan de `integrations`; el composer tampoco. Hay un escaneo de `ghp_`, `github_pat_` y `sk-ant-` (20+ caracteres) sobre `backend/test/fixtures` y `docs/fixtures`.
- **Repositorios destacados** (`backend/src/modules/featured-repository/`, change `add-featured-repositories`, fusionado y sin archivar): entidad sin `stars`; `parseGithubRepositoryUrl` y `githubRepositoryKey` (minúsculas, `owner/repo`) en el dominio; unicidad por clave; `FeaturedRepositoryOutput` lo reusan la vista curada, el preview y el JSON Resume (`toFeaturedRepositoryOutput` en `curated-profile.mapper.ts`; `toRepositoryProjects` en `json-resume.mapper.ts` usa `repository.language`). La columna `FeaturedRepository.stars` existe desde `init`, sin exponer.
- **Ninguna de esas dos capacidades está en `openspec/specs/`**: por eso este change no tiene `MODIFIED` sobre ellas (ver `proposal.md` § Capabilities).
- **GitHub REST** (docs consultadas el 2026-11-16): límite primario de 5 000 peticiones por hora con un PAT; cabeceras `x-ratelimit-limit`, `-remaining`, `-used`, `-reset` (epoch UTC) y `-resource`. Límite secundario: **403 o 429** con un mensaje; si viene `retry-after`, esperar esos segundos; si `x-ratelimit-remaining` es 0, esperar al reset; **si no, esperar al menos un minuto**. Buenas prácticas: peticiones **en serie**; seguir redirecciones (301: actualizar la URL guardada; 302/307: no); guardar el `etag` y mandar `if-none-match`; **un 304 de una petición autorizada no cuenta contra el límite primario**.

## Goals / Non-Goals

**Goals:** (1) que stars, lenguajes, topics, último push y archivado de cada repositorio destacado salgan de GitHub y digan cuándo se verificaron; (2) ninguna llamada a GitHub en la ruta pública ni en el render, y el sitio igual que hoy sin el proveedor; (3) cuota cuidada: en serie, siempre autorizado, condicional y con reserva; (4) un token vencido no borra nada y se ve en el panel; (5) todo probado sin red ni tokens reales.

**Non-Goals:** ver `proposal.md` § Non-goals.

## Decisions

### D1 — Proveedor `github` en el catálogo, con `GITHUB_SYNC_TOKEN` opcional

- `PROVIDER_CATALOG.github = { id: 'github', secretEnv: 'GITHUB_SYNC_TOKEN', allowedInProduction: true }`.
- Por D11 enmendado de la base, la variable es **opcional**: si está definida manda (el `PUT` de la credencial da 422); si no, se usa la credencial cifrada guardada desde Integraciones. Sin ninguna, el trabajo termina `DEAD` «falta la credencial» (comportamiento de la base, sin cambios).
- **No se llama `GITHUB_TOKEN`**: es el nombre que GitHub Actions y muchas herramientas inyectan o leen por su cuenta; un token del CI con otros permisos podría colarse en un entorno de prueba.
- Token recomendado (documentado en `DEPLOY-RAILWAY.md`): **fine-grained**, «Public repositories (read-only)», sin permisos adicionales, con vencimiento. No se valida el prefijo: la API de credenciales es genérica y un token clásico sin scopes también sirve.

Alternativa descartada: **variable obligatoria al habilitar el proveedor.** Contradice la enmienda de D11 de la base.

### D2 — Dónde vive cada pieza

```
modules/integrations/
├── domain/github/                 project-github-repository.ts, classify-github-response.ts (puros)
├── application/github/            sync-github-evidence.service.ts
│                                  ports: github-api.port.ts, code-evidence-store.port.ts
├── infrastructure/providers/github/  github.connector.ts, fetch-github-transport.ts,
│                                     fixture-github-transport.ts
└── infrastructure/persistence/    prisma-code-evidence.store.ts
modules/featured-repository/
├── domain/value-objects/          repository-evidence.ts
├── domain/services/               present-repository-evidence.ts (puro)
└── infrastructure/persistence/    lectura con include de RepositoryEvidence
```

- `SyncGithubEvidenceService` (aplicación, sin Nest ni Prisma) orquesta un trabajo: lista los objetivos, pide en serie, clasifica, graba snapshots y evidencia. Recibe `GithubApi`, `CodeEvidenceStore`, `SnapshotStore`, `RunLogger` y un reloj. `GithubConnector` (infraestructura) solo adapta `ConnectorPort` a ese servicio.
- `CodeEvidenceStore`: `listTargets(): { featuredRepositoryId, url, order }[]` (todas las filas de `FeaturedRepository`, también ocultas) y `save(featuredRepositoryId, evidence)` (upsert en una transacción corta), `pruneSnapshots(keepKeys)`.
- `integrations` usa `parseGithubRepositoryUrl` y `githubRepositoryKey` del dominio de `featured-repository` (función pura; `add-featured-repositories` D2 la dejó para esto). **`featured-repository` no importa nada de `integrations`**: lee la tabla con Prisma.
- Test de arquitectura: se suma `featured-repository` a la lista de módulos que no importan `integrations`, y una regla nueva: solo `prisma-code-evidence.store.ts` escribe `repositoryEvidence` (`create`, `update`, `upsert`, `delete*`).

Alternativas descartadas:
- **Módulo propio `code-evidence`.** Un módulo más para un solo conector; la base (D1) ya prevé los proveedores bajo `integrations/infrastructure/providers/`.
- **Conector dentro de `featured-repository`.** Haría que un módulo de la ruta pública importara los puertos de `integrations`, lo que la base prohíbe en espíritu.
- **Leer `ExternalSnapshot` desde la ruta pública.** Prohibido por D15 de la base: los snapshots se proyectan a tablas propias.

### D3 — Qué se pide, en qué orden y con qué cabeceras

Por trabajo (diario `sync:github:daily:<fecha>` o manual), con payload `{}`:

1. `listTargets()`, ordenados por `order` y `id`; se descartan las URLs que no parsean (no debería haber) y las claves repetidas. Tope **50 repositorios** por trabajo (`MAX_REPOSITORIES_PER_SYNC`, constante); si hay más, se procesan los 50 primeros y se loguea un `warn`.
2. Por cada objetivo, **en serie**:
   - `GET /repos/{owner}/{repo}` con el ETag del snapshot `repo:<clave>`;
   - si el repo dio 200 o 304 y no es privado, `GET /repos/{owner}/{repo}/languages` con el ETag del snapshot `languages:<clave>`;
   - se graba la evidencia del repo (D8) antes de pasar al siguiente: un fallo a mitad de camino conserva lo ya hecho.
3. Si todos los objetivos terminaron, se borran los snapshots `github` cuya clave ya no está entre los objetivos (`pruneSnapshots`).
4. `itemsChanged` = repos cuya evidencia cambió de contenido (no cuenta un 304 ni un 200 con el mismo hash).

Cabeceras de **todas** las peticiones, incluidas las condicionales y las que siguen una redirección: `Authorization: Bearer <secreto>`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`, `User-Agent: portfolio-code-evidence` y, si hay ETag, `If-None-Match`. La URL base es la constante `https://api.github.com` (sin variable de entorno: nadie puede redirigir el token a otro host por configuración).

Cada petición combina la señal del trabajo con un timeout propio de **15 s** (`AbortSignal.any`). Un cuerpo de más de **512 KiB** se corta al leerlo (sin `JSON.parse`) y es `Permanent` para ese trabajo. Entre petición y petición no hay espera: son `GET` en serie, que es lo que pide GitHub.

Presupuesto: 50 repos × 2 peticiones = 100 por día como máximo, en su mayoría 304 sin costo de cuota.

Alternativas descartadas:
- **GraphQL en una sola consulta.** Menos peticiones, pero sin ETag ni 304 (cada consulta cuesta puntos) y con otro modelo de límites; la propuesta pide REST con condicionales.
- **Peticiones en paralelo.** Lo desaconseja GitHub (límite secundario) y la propuesta («en serie»).
- **Solo los repos visibles.** Ahorra poco y deja sin evidencia a un repo que el owner hace visible; los ocultos se sincronizan igual (nunca se muestran).

### D4 — Snapshots reducidos con lista blanca

- `repo:<clave>`: el cuerpo guardado es `projectGithubRepository(body)` con solo `full_name`, `private`, `fork`, `archived`, `stargazers_count`, `language`, `topics` (hasta 20, minúsculas), `pushed_at`, `description` (recortada a 350) y `html_url`. Un campo con tipo inesperado se descarta (`null`) en lugar de fallar.
- `languages:<clave>`: el mapa `{ lenguaje: bytes }`, hasta 20 entradas con bytes enteros ≥ 0.
- El `contentHash` de la base se calcula sobre esa proyección: un cambio en `watchers`, `updated_at` u `open_issues` **no** cuenta como cambio. El `etag` guardado es el de la respuesta completa, que es lo que GitHub compara.
- No se guarda el cuerpo crudo: menos datos de terceros en la base y nada que no se use.

### D5 — Redirecciones a mano, solo dentro de `api.github.com`

- `fetch` con `redirect: 'manual'`. Ante 301, 302 o 307 con `location` que empieza con `https://api.github.com/`, se repite la petición (con las mismas cabeceras, `Authorization` incluida) hasta **2** saltos.
- Un `location` de otro origen **no se sigue**: el repo queda `INACCESSIBLE` («GitHub redirigió fuera de la API») y el token no sale de `api.github.com`.
- Un repo renombrado o transferido (301 a `/repositories/<id>`) sigue sincronizando; si el `full_name` de la respuesta difiere de la clave pedida, la evidencia guarda `movedTo = full_name` y el panel pide actualizar la URL (D12). No se cambia la URL curada sola: es del owner.

Alternativa descartada: **`redirect: 'follow'`.** Funciona hoy, pero delega en el runtime qué cabeceras viajan y a qué host; la regla explícita se prueba con un test.

### D6 — `classifyGithubResponse`: fallos del trabajo y estados de un repo

Función pura que separa lo que detiene el **trabajo** (un `ProviderFailure`, que pasa por `sanitizeFailure`) de lo que es el **estado de un repo** (el trabajo sigue):

| Respuesta | Resultado |
|---|---|
| 200 | datos |
| 304 | sin cambios |
| 401 | trabajo `Permanent`: «GitHub rechazó el token (401): renovalo en Integraciones o en GITHUB_SYNC_TOKEN» |
| 403 o 429 con `retry-after` | trabajo `RetryAfter` (segundos o fecha HTTP) |
| 403 o 429 con `x-ratelimit-remaining: 0` y `x-ratelimit-reset` | trabajo `ResetAt` |
| 403 o 429 con un mensaje que contiene «rate limit», sin esas cabeceras | trabajo `RetryAfter` de 60 s (la regla «al menos un minuto») |
| 429 sin nada de lo anterior | trabajo `RetryAfter` de 60 s |
| otro 403 | repo `INACCESSIBLE` |
| 404 o 410 | repo `NOT_FOUND` |
| 451 | repo `INACCESSIBLE` |
| 200 con `private: true` | repo `PRIVATE` (no se pide `/languages` ni se publica nada) |
| 408, 500, 502, 503, 504, error de red, timeout de 15 s | trabajo `Transient` (lo de antes queda grabado) |
| otro 4xx (400, 422) | trabajo `Permanent` con `HTTP <status>` |
| cuerpo > 512 KiB o JSON inválido en un 200 | trabajo `Permanent` |

- Reusa `classifyHttpFailure` para lo genérico y le agrega lo de GitHub: `retry-after` también en el 403, el mensaje del límite secundario y los estados por repo. `classifyHttpFailure` **no cambia** (la usan otros proveedores).
- El mensaje del trabajo nunca incluye cabeceras ni el cuerpo; pasa por `redactSecrets` de la base antes de guardarse.
- Un 401 en el **primer** repo detiene el trabajo sin tocar ninguna evidencia.

Alternativa descartada: **cualquier 404 o 403 de un repo tumba el trabajo.** Un repo borrado dejaría a los demás sin verificar para siempre (`DEAD` todos los días).

### D7 — Reserva de cuota

Después de cada respuesta se lee `x-ratelimit-remaining`. Si es **≤ 50** (`GITHUB_RATE_RESERVE`, constante) y viene `x-ratelimit-reset`, el trabajo se detiene con `ResetAt(reset)` antes de la siguiente petición: lo hecho queda grabado, el proveedor se pausa hasta el reset (D10 de la base) y el trabajo se reintenta después. Un 304 autorizado no descuenta cuota, así que en régimen normal la reserva no se toca. El valor se loguea en `debug` (sin el token).

Alternativa descartada: **no reservar.** El PAT del owner puede usarse para otras cosas; agotarlo a 0 bloquea también su uso personal.

### D8 — Tabla `RepositoryEvidence`

| Campo | Tipo | Regla |
|---|---|---|
| `featuredRepositoryId` | texto `@id`, FK a `FeaturedRepository` `ON DELETE CASCADE` | una fila por repo destacado |
| `repoKey` | texto | `owner/repo` en minúsculas pedido al sincronizar |
| `status` | enum `RepositoryEvidenceStatus` | `OK`, `NOT_FOUND`, `INACCESSIBLE`, `PRIVATE` |
| `stars` | entero ≥ 0, nulo | |
| `primaryLanguage` | texto ≤ 40, nulo | `language` de GitHub |
| `languages` | Json, nulo | `{ lenguaje: bytes }`, hasta 20 |
| `topics` | texto[] | hasta 20 |
| `pushedAt` | instante, nulo | |
| `archived`, `isFork` | booleanos | |
| `movedTo` | texto, nulo | `full_name` si difiere de `repoKey` (D5) |
| `githubDescription` | texto ≤ 350, nulo | solo panel |
| `verifiedAt` | instante | última vez que GitHub respondió por este repo (200, 304, 404…) |
| `changedAt` | instante | última vez que cambió el contenido |

- **304 de los dos recursos:** solo se actualiza `verifiedAt` (y `fetchedAt` en los snapshots, D15 de la base). Stars, lenguajes, topics, `changedAt`, el cuerpo y el `contentHash` de los snapshots quedan **idénticos**. Es la lectura de «un 304 autenticado no reescribe nada»: no se reescriben datos; solo avanza el sello de verificación, porque GitHub sí confirmó que siguen vigentes.
- **200 con la misma proyección:** igual que el 304.
- **`NOT_FOUND`, `INACCESSIBLE`, `PRIVATE`:** se actualizan `status` y `verifiedAt`; los datos anteriores se conservan para el panel, pero no se publican (D10).
- **Cambio de URL en el panel:** la fila sigue con el `repoKey` viejo hasta la próxima sincronización; la lectura la ignora mientras `repoKey` no coincida con la clave de la URL actual (D10). La sincronización la reemplaza.
- `FeaturedRepository.stars` (columna de `init`) **queda inerte** (P3).

Alternativas descartadas:
- **Columnas nuevas en `FeaturedRepository`.** Mezcla lo curado con lo sincronizado en la misma fila: un `PATCH` del panel y una sincronización compiten por la misma escritura, y cambiar la URL no invalida nada por sí solo.
- **Leer los snapshots en la ruta pública.** Ver D2.

### D9 — Precedencia entre lo curado y lo verificado

| Dato | Fuente |
|---|---|
| Nombre, URL, descripción `{es,en}`, tecnologías, tags, orden, visible | **solo a mano**; la sincronización nunca los escribe |
| Lenguaje mostrado | a mano si `language` no es nulo; si no, `primaryLanguage` de GitHub (**lenguaje efectivo**) |
| Stars, lenguajes con porcentaje, topics, último push, archivado, «verificado el…» | **solo GitHub** |
| Descripción de GitHub | solo el panel, como referencia para curar |

El lenguaje manual funciona como override explícito: el owner que quiere «TypeScript» aunque GitHub diga «JavaScript» lo escribe a mano. Vaciar el campo vuelve al de GitHub.

### D10 — Presentación pública

`presentRepositoryEvidence(repo, evidence)` (puro, dominio de `featured-repository`) devuelve `null` si no hay fila, si `status` no es `OK` o si `repoKey` no coincide con la clave de la URL actual. Si no, `FeaturedRepositoryOutput` suma:

```
evidence: {
  stars: number,
  languages: { name: string, percent: number }[],   // hasta 3, por bytes desc, % entero, sin 0 %
  topics: string[],                                 // hasta 5, sin repetir tecnologías (sin mayúsculas)
  pushedAt: string | null,                          // ISO
  archived: boolean,
  verifiedAt: string                                // ISO
} | null
```

y `language` pasa a ser el **lenguaje efectivo** (D9). La vista curada, el preview, el listado público y el JSON Resume lo reciben por el mismo `toFeaturedRepositoryOutput`.

La tarjeta (`Repositories.tsx`, ya en un chunk diferido):
- stars con un ícono y el número **solo si `stars ≥ 1`** (P2);
- lenguajes como «TypeScript 82 % · CSS 12 %»;
- topics como chips;
- «Archivado» como insignia de texto;
- «Último cambio: {mes año}» si hay `pushedAt`;
- «Verificado en GitHub el {fecha}» en texto atenuado (con el contraste AA de `--t-muted`).
- `evidence: null` → la tarjeta es **idéntica** a la de hoy.

El sello muestra la fecha aunque sea vieja (P1): si el token venció, la fecha lo dice.

Nada de esto llama a GitHub ni carga recursos de otro origen; el ícono es de Lucide (ya en el bundle).

### D11 — La ruta pública no depende del proveedor

- Ninguna petición pública, el head, el sitemap, el PDF ni la exportación llaman a GitHub: la evidencia sale de la base.
- Con `INTEGRATIONS_ENABLED` sin `github`, o con el scheduler apagado, no se escribe evidencia y todo se ve como hoy.
- Si el proveedor se deshabilita después, la evidencia guardada se sigue mostrando con su fecha.
- Sincronizar no toca `CuratedProfile.updatedAt` (ni el `<lastmod>` ni el `dateModified`): la evidencia vive en otra tabla y no hay trigger.

### D12 — Panel: estado por repo y aviso, sin ítem en la barra

- **Bloque Repositorios de `/admin/proyectos`:** la salida del panel (`AdminFeaturedRepositoryOutput`) suma `evidence` cruda (`status`, `repoKey`, `stars`, `primaryLanguage`, `topics`, `archived`, `movedTo`, `githubDescription`, `verifiedAt`, `changedAt`, `stale: boolean` si `repoKey` no coincide con la URL). Cada fila muestra una insignia de texto:
  - «Verificado el {fecha}» (OK);
  - «Sin verificar» (sin fila o con `repoKey` viejo): «Se verifica en la próxima sincronización o con Sincronizar ahora en Integraciones»;
  - «No encontrado en GitHub» (`NOT_FOUND`);
  - «GitHub no da acceso» (`INACCESSIBLE`);
  - «Privado: no se publica» (`PRIVATE`);
  - «GitHub lo movió a {movedTo}: actualizá la URL» (`movedTo` no nulo).
  En el diálogo de edición, debajo de Descripción, «Descripción en GitHub: …» (solo lectura) y, si `language` está vacío, el placeholder «De GitHub: {primaryLanguage}».
- **Aviso del bloque:** si `GET /api/admin/integrations` trae `github` con `lastRun.outcome` `DEAD` o `jobs.dead > 0` o `stale: true`, el bloque muestra «La última sincronización con GitHub falló: {lastDeadError}. Se siguen mostrando los datos verificados por última vez.» con el enlace **Ver integraciones**. Si la consulta falla o `github` no está habilitado, no muestra nada.
- **Integraciones:** la tarjeta `github` es la genérica de la base (estado, Sincronizar ahora, Pausar, credencial de solo escritura). El token vencido aparece ahí como «Fallida» con el mensaje de D6, y el Dashboard muestra su aviso por `jobs.dead > 0` (comportamiento de la base).
- **La barra del panel no cambia** (D25 de la base).

### D13 — JSON Resume

Sin código propio: `toRepositoryProjects` ya pone `repository.language` primero en `keywords`, y ese campo pasa a ser el efectivo (D9). Las stars, los topics y las fechas **no** se exportan: JSON Resume v1.0.0 no tiene campo para stars, y los topics de GitHub suelen ser ruido para un ATS. La exportación sigue sin llamar a GitHub y sin registrar visitas.

### D14 — PDF sin cambios

La hoja imprime solo «Repositorios: a · b · c» si entra (D9 de `add-featured-repositories`, decisión del owner P2 de ese change). Agregar stars o el sello alarga la línea y rompe el estimador calibrado; una fecha impresa envejece y el enlace de cierre lleva a la versión viva (P4).

### D15 — Transporte de fixtures y pruebas sin red

- `GithubApi` (puerto) tiene dos adaptadores: `FetchGithubTransport` (real) y `FixtureGithubTransport`, elegidos por `GITHUB_TRANSPORT` (`http` por defecto, `fixture`). **`fixture` hace fallar el arranque con `NODE_ENV=production`**, con la misma regla y mensaje que `fake` (nombra la variable, sin valores).
- `FixtureGithubTransport` responde desde `backend/test/fixtures/github/<owner>/<repo>/{repo,languages}.json` con un ETag fijo por archivo (`"fixture-<sha256 corto>"`), 304 si `If-None-Match` coincide, 404 si no hay carpeta, y reproduce casos por nombre de repo (`rate-limited`, `secondary-limit`, `moved`, `private-repo`, `forbidden`). Con el secreto `fixture-invalid-token` responde 401 a todo. Cuenta las peticiones y registra las cabeceras recibidas (solo para tests; sin el valor del token: guarda si había `Authorization` y su esquema).
- Los fixtures cubren la cuenta ficticia del ejemplo (`portafolio-ejemplo-ficticio/reservas-api`, `metricas-dashboard`, `experimento-oculto`). **Ningún fixture contiene un token**; el escaneo de la base sigue pasando y un test nuevo verifica que el transporte de fixtures nunca devuelve el secreto recibido.
- **Unitarios:** `projectGithubRepository`, `classifyGithubResponse` (cada fila de D6), `presentRepositoryEvidence`, `SyncGithubEvidenceService` con un `GithubApi` y un store en memoria, y `FetchGithubTransport` contra un `http.createServer` en `127.0.0.1` (puerto 0) construido con la URL base inyectada **solo en el test** (cabeceras, `Authorization` en la condicional y tras la redirección, redirección a otro origen no seguida, cuerpo de más de 512 KiB, aborto por señal y por los 15 s).
- **E2e** (`test/github-code-evidence.e2e-spec.ts`), con `INTEGRATIONS_ENABLED=github`, `GITHUB_TRANSPORT=fixture` y la corrida invocada directamente (como los e2e de la base): primera corrida actualiza stars, lenguajes y topics; segunda corrida da 304 en todo, cero cambios de datos y `verifiedAt` adelantado; token `fixture-invalid-token` → trabajo `DEAD`, la evidencia sigue igual y la ruta pública la sigue sirviendo; `GET /api/curated-profiles/all` no hace ninguna petición al transporte.

Alternativa descartada: **interceptar `fetch` global en los tests (nock/msw en Node).** Dependencia nueva y no sirve para `manual:capture` ni para el TC-52.

### D16 — Variables

| Variable | Default | Regla |
|---|---|---|
| `GITHUB_SYNC_TOKEN` | — | opcional; si está, manda sobre la credencial del panel (D14 de la base); se suma a `redactSecrets` como secreto conocido del trabajo |
| `GITHUB_TRANSPORT` | `http` | `http` o `fixture`; `fixture` prohibido en producción; otro valor falla el arranque |

Encender en Railway: `INTEGRATIONS_ENABLED=github`, las claves del keyring (si la credencial va por el panel) e `INTEGRATIONS_SCHEDULER_ENABLED=true`, como dice la base.

### D17 — Migración aditiva

`<timestamp>_add_github_code_evidence`: `CREATE TYPE "RepositoryEvidenceStatus"` y `CREATE TABLE "RepositoryEvidence"` con la FK a `FeaturedRepository` (`ON DELETE CASCADE`). Sin `ALTER` ni `DROP` sobre tablas existentes. Generada con `--create-only` contra una base descartable y revisada a mano.

## Risks / Trade-offs

- **[El token del owner en un servidor]** → fine-grained, solo lectura de repos públicos, con vencimiento; cifrado con el keyring si va por el panel; redactado en logs y errores; nunca sale de `api.github.com` (D5) ni de la URL base constante (D3).
- **[Un repo privado por error]** → si la respuesta trae `private: true`, nada se publica (`PRIVATE`) y el panel lo dice. El token recomendado ni siquiera ve privados.
- **[Datos viejos con el token vencido]** → se sirven con su fecha («Verificado en GitHub el …»), el panel avisa en Integraciones, en el Dashboard y en el bloque Repositorios.
- **[Límite secundario por ráfagas]** → en serie, ≤ 100 peticiones por día, mayoría 304; si aparece, `RetryAfter` pausa el proveedor.
- **[Cambios de forma en la API]** → `X-GitHub-Api-Version` fijo; la proyección tolera tipos inesperados (`null`); un cuerpo no JSON es `Permanent` y se ve en el panel.
- **[Fixtures en el código de producción]** → `FixtureGithubTransport` existe en el bundle pero el arranque lo prohíbe en producción, igual que `fake`.
- **[Changes en paralelo]** → `schema.prisma` (modelos al final), `provider-catalog.ts`, `integrations.module.ts`, `featured-repository.output.ts`, `Repositories.tsx`, `messages.ts`, `openapi.json`/`api.d.ts` (regenerar, nunca a mano), `MANUAL.md` (TC-52 reservado para este change).
- **[Los specs de `featured-repositories` e `integration-*` no están archivados]** → todo es `ADDED`; si se archivan antes, sigue siendo válido. Si se archivara este primero, `code-evidence` no depende de requisitos ajenos por nombre.

## Migration Plan

1. Migración aditiva (D17) en el `preDeployCommand`. Sin backfill: la tabla nace vacía y la vista se ve como hoy.
2. Deploy con `INTEGRATIONS_ENABLED` sin `github`: nada cambia.
3. Encender: crear el PAT fine-grained (guía en `DEPLOY-RAILWAY.md`), cargarlo en `GITHUB_SYNC_TOKEN` o en Integraciones, `INTEGRATIONS_ENABLED=github`, scheduler encendido; «Sincronizar ahora» y revisar el bloque Repositorios.
4. Base local del owner (`portfolio`, 5434): la migra él con `npm run prisma:migrate`; ninguna tarea la toca.
5. Rollback: quitar `github` de `INTEGRATIONS_ENABLED` deja de sincronizar (la evidencia se sigue mostrando con su fecha); vaciar la tabla (`DELETE FROM "RepositoryEvidence"`) vuelve las tarjetas a hoy; revertir el código deja la tabla sin uso.

## Open Questions

Ninguna es bloqueante; por la regla de la sesión principal, cada una se resuelve con la recomendación salvo que el owner diga otra cosa.

- **P1 [no bloqueante] — Evidencia vieja en público.** A) mostrarla siempre con su fecha; B) ocultarla si `verifiedAt` tiene más de 90 días. **Recomendación: A.** La fecha es honesta y ocultarla haría desaparecer datos sin que nadie lo note; el panel ya avisa cuando la sincronización falla.
- **P2 [no bloqueante] — Stars en cero.** A) mostrarlas desde 1; B) siempre, también 0; C) nunca, solo lenguajes y topics. **Recomendación: A.** «★ 0» resta más de lo que suma; con 1 o más es evidencia.
- **P3 [no bloqueante] — Columna `FeaturedRepository.stars`.** A) dejarla inerte; B) borrarla en una migración de este change. **Recomendación: A.** Borrar una columna es destructivo y el seed la acepta por retrocompatibilidad; se retira en un change de limpieza.
- **P4 [no bloqueante] — Evidencia en el PDF.** A) sin cambios; B) stars junto a cada nombre si la línea entra. **Recomendación: A** (D14).
- **P5 [no bloqueante] — Topics en la tarjeta.** A) hasta 5, sin repetir tecnologías; B) no mostrarlos (solo informan en el panel). **Recomendación: A.** El criterio de la propuesta pide topics; el tope y la deduplicación evitan ruido.
