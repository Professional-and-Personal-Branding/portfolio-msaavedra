# Propuesta de nuevas features y mejoras para el Portafolio Administrable (después de 1.1), revisada

> Autor: agente `arquitecto`. Fecha: 2026-10-28. Estado: **aprobada en lo bloqueante** (ver «Decisiones tomadas» abajo); las preguntas no bloqueantes de la § 9 siguen abiertas. No creé ningún change de OpenSpec. Los nombres de la § 6 son propuestas y se crean recién al abrir cada uno.
>
> **Decisiones tomadas por el owner (2026-10-28):**
> - **P18, estado del deploy:** todavía no desplegado. La Fase 1.0.x (deploy, backups con restauración probada, curaduría de datos, uso de Railway) va primero.
> - **P1, orden de arranque:** opción A, 1.0.x y después la Fase 1.2 sin IA.
> - **P2, atribución de visitas:** opción C, los dos: `ShareLink` (`?via=`) por destinatario y `?src=<portal>` para portales genéricos, ambos reenviados por el cliente a la API.
> - **P19, semántica de `views`:** opción A, `views` cuenta solo las visitas humanas de terceros; todas las filas se guardan con su `kind`.
> Esta versión incorpora las 33 objeciones de los críticos de viabilidad y de encaje. En el repo confirmé cuatro de ellas: `frontend/Caddyfile:112` (`Referrer-Policy no-referrer`), `backend/src/config/configuration.ts:60` (SameSite por defecto `'lax'`), `docs/ROADMAP-1.1.md:38` (el veto a `registro-de-envios`) y la corrida de a11y del 2026-10-28. No edité nada del repo.

---

## 1. Resumen ejecutivo

1. **No hay API para que un candidato integre LinkedIn o Indeed.** Leer tu perfil de LinkedIn, buscar vacantes o postularte exige ser partner de Talent Solutions. Indeed solo documenta APIs para empleadores y ATS. Hacer scraping viola los términos de los dos y pone en riesgo tu cuenta, así que queda descartado.
2. **Antes de sumar features hay que cerrar el 1.0.0.** En el repo, el Deploy 1.0.0 sigue abierto: faltan el proyecto en Railway, los backups con una restauración probada, la verificación posterior al deploy, el Post Inspector, Slack y el tag v1.0.0. También faltan datos: hay 0 repos destacados y los 2 proyectos tienen `url: null`. Para alguien que busca empleo ya, lo que más rinde es tener el sitio arriba con contenido creíble. Eso es la nueva **Fase 1.0.x**.
3. **Lo que sí da valor hoy, sin pedir permiso a nadie, es dar vuelta el problema.** El portafolio pasa a ser el centro de la búsqueda.
   - **Hallazgo:** hoy la analítica no sabe de qué portal llega una visita. El fetch del SPA no reenvía `document.referrer` y Caddy responde con `Referrer-Policy no-referrer`, así que `byReferrer` siempre da «directo».
   - **Remedio:** un **link por destinatario** (`ShareLink`, `?via=`) que el cliente reenvía a la API. Esa idea fue vetada en 1.1 (`registro-de-envios`). Esta propuesta la reabre con un motivo nuevo y un MVP recortado.
   - **Después vienen** la entrada de vacantes (APIs públicas de Greenhouse, Lever y Ashby, o el texto pegado) y un CRM de postulaciones.
4. **1.2 (unas 2 o 3 semanas):** separar las visitas propias (y después las de bots que ejecutan JS), los ShareLinks, la verificación de certificaciones, los overrides de skills y proyectos, el envoltorio `ProfilePage`, el contraste del panel (39 nodos reales), el cambio de contraseña y el uptime. No usa IA, OAuth ni servicios nuevos.
5. **1.3:** la base de integraciones (cola en Postgres y cron de Railway), la entrada de vacantes con una cobertura calculada sin LLM, el CRM y los repos destacados. Estos últimos van en dos changes y solo si antes curás tus repos.
6. **IA (2.0):** siempre detrás de un `LlmPort`, con un tope de gasto propio, salidas validadas en código y **un humano que aprueba todo**. El costo estimado es de menos de 10 USD por mes, con los precios **sin confirmar** hasta abrir `add-ai-foundation`.

---

## 2. Principios y restricciones

| Principio | Regla concreta |
|---|---|
| ToS de cada plataforma | Solo se usan APIs oficiales, feeds publicados o datos que el owner exporta o pega. **No se hace scraping de ningún sitio**: ni LinkedIn, ni Indeed, ni Glassdoor, ni Wellfound, ni el GraphQL interno de LeetCode. El respaldo JSON-LD **nunca** se aplica a esos portales. Cada fuente conserva la atribución que exige: enlace, crédito y `applyUrl`. Nada de un agregador se republica en el sitio público, en el sitemap ni como JSON-LD `JobPosting`. |
| Humano en el bucle | El LLM nunca escribe en la base: devuelve una propuesta y el owner la aplica con los casos de uso que ya existen. Nada se publica ni se envía solo. Las cifras (años, fechas) siempre las calcula el código. |
| Ruta pública aislada | La resolución pública y el preview **solo leen de Postgres**. Así se protegen `perf:budget` (155 KB), Lighthouse ≥ 85 y la CSP. |
| Costo | Plan Hobby. No se suman Redis ni workers 24/7: la cola es Postgres con `SKIP LOCKED` y el cron termina solo. La IA tiene un tope propio y, de segunda barrera, el spend limit de la Console. Se mide el uso real de Railway antes de sumar servicios. |
| Privacidad | Se mantiene el ipHash HMAC. No se guardan datos de reclutadores salvo los que el owner escriba a mano. Hay una lista negra, con test, de lo que nunca sale hacia el LLM: `accessToken`, `ipHash`, sal, hashes y datos de visitantes. El ZIP de LinkedIn se procesa en memoria. Los tokens de terceros se guardan con AES-256-GCM. |
| Arquitectura | Clean Architecture. Un caso de uso por `execute()`, `Result<T,E>`, tokens Symbol y Prisma solo en `infrastructure/persistence`. **Cada módulo escribe solo su propio agregado**: otros módulos le piden datos por puertos de lectura. |
| SDD | Un change por valor de negocio. Los `MODIFIED` nombran el requisito vigente exacto y lo copian completo, después de revisar «Archive would refuse». Cada requisito tiene menos de 500 caracteres, y cada change suma un TC-nn en `docs/MANUAL.md`. |
| No re-litigar | Si un change revive algo descartado en 1.1, la proposal cita el veto y explica qué cambió. |

---

## 3. Mapa de integraciones

En la columna Viabilidad:
- **Hoy:** una app individual la usa sin revisión.
- **Revisión:** exige una aprobación o ser partner.
- **Bloqueada:** no hay un camino legal por API.

| Plataforma | Qué se puede hoy | Qué no | Integración propuesta | Viabilidad | Esf. | Fuentes |
|---|---|---|---|---|---|---|
| **LinkedIn** | **OIDC** (`openid profile email`): `/v2/userinfo` devuelve `sub`, `name`, `given_name`, `family_name`, `picture`, `locale` y `email`/`email_verified` (el email es opcional). **No trae el headline.**<br>**Share on LinkedIn** (`w_member_social`): self-serve desde la pestaña Products. Publica con `POST /v2/ugcPosts` y `X-Restli-Protocol-Version: 2.0.0`. Límites: 150 req/día por miembro y 100.000/día por app (UTC).<br>**Sin token:** el enlace `share-offsite` y el Post Inspector.<br>**Export:** el ZIP de «Obtener una copia de tus datos». | Leer la experiencia, las skills, la educación o el headline. Buscar vacantes, Apply with LinkedIn, RSC y Recruiter (son de partners de Talent).<br>Los access tokens duran **60 días** (`expires_in` 5184000, confirmado). Para apps self-service **no hay refresh token programático**: está reservado a un grupo limitado de partners. Se renueva repitiendo el OAuth, y si se piden scopes distintos se invalidan los tokens anteriores.<br>Scraping (§ 8.2 del User Agreement). | (a) Botón share-offsite por perfil PUBLIC, con un ShareLink. (b) Importador del ZIP con diff, que es lo único que trae el headline. (c) Opcional: publicar desde /admin con `w_member_social`, con un aviso a los 50 días. | Hoy (a y b). Hoy con app propia (c). | S / M / M | learn.microsoft.com/…/sign-in-with-linkedin-v2 · …/share-on-linkedin · …/authorization-code-flow · …/getting-access · linkedin.com/help/…/a1341387 · …/50191 |
| **GitHub** | REST y GraphQL con un PAT fine-grained de solo lectura (5.000 req/h). Un 304 condicional **no consume cuota solo si la request lleva `Authorization`**. Se puede leer repos, lenguajes, topics, pinned, el calendario de contribuciones y el README de perfil. | Los achievements en la API están **sin confirmar**. | `CodeHostingGateway` / `GithubRestGateway`, que siempre manda el PAT, también con `If-None-Match`. | Hoy | M | docs.github.com/…/rate-limits-for-the-rest-api · …/best-practices-for-using-the-rest-api · …/graphql/reference/users |
| **GitLab** | API v4 con un token personal opcional. | Las rutas exactas están **sin confirmar**. | Segundo adaptador del mismo puerto, solo si tenés repos ahí. | Hoy | S | docs.gitlab.com/user/gitlab_com/rate_limits/ |
| **Indeed** | Nada del lado del candidato. | Indeed solo documenta Job Sync y Send Candidates, que son para ATS y empleadores vía Partner Console. **No encontré un anuncio oficial del retiro de la Publisher API, así que no doy fecha.** | Un enlace profundo de búsqueda, el texto pegado y un ShareLink `indeed`. | Bloqueada | S | docs.indeed.com/job-sync-api · docs.indeed.com/send-candidates-api/ (JobsPipe es solo una fuente secundaria con conflicto de interés) |
| **Upwork** | API GraphQL con OAuth 2.0, **si aprueban la clave**. | Según el índice del help center oficial (no pude abrir la página directamente), la aprobación es manual y pide:<br>• 25.000 USD ganados<br>• JSS ≥ 90 %<br>• identidad verificada<br>• no tener suspensiones<br>• nombre, dirección y foto válidos<br>• un método de pago verificado y activo<br>• describir el uso previsto<br>Otra página de Upwork dice que la API **no es para uso comercial**. El límite es de 40.000 req/día y los scopes están **sin confirmar**. No conviene automatizar propuestas. | Con la clave: `UpworkJobFeedSource` para un radar personal. Sin la clave: un perfil curado «upwork» y una plantilla de propuesta con su ShareLink. | Revisión | M | support.upwork.com/hc/en-us/articles/115015857647-How-to-request-an-API-key-from-Upwork · upwork.com/developer/documentation/graphql/… |
| **Torre.ai** | Endpoints públicos que usa su web, según un CLI de la comunidad. | No hay documentación oficial ni ToS para acceso programático (**sin confirmar**). | Un enlace al genoma y un ShareLink `torre`. El adaptador, solo con permiso escrito. | Baja | S | pkg.go.dev/github.com/jjuanrivvera/torre-cli |
| **Get on Board** | API pública sin setup (LatAm). La API privada pide una clave y el plan Recruiter. | Las rutas hay que sacarlas de `api-doc.html`. Los ToS y la atribución para reusar los datos están **sin revisar** (getonbrd.com/about/tos). | Fuente del radar, **una vez revisados sus términos**. | Hoy (a confirmar sus ToS) | S | getonbrd.com/help/what-can-i-do-with-get-on-board-s-api · getonbrd.com/api-doc.html · getonbrd.com/about/tos |
| **Computrabajo, Bumeran/Laborum/ZonaJobs, Workana, Wellfound** | Nada. | No encontré una API pública (**sin confirmar**). Wellfound tiene anti-bot. | Texto pegado y un ShareLink por portal. | Bloqueada | — | — |
| **Glassdoor** | Nada. | La API pública fue retirada, según una fuente secundaria (**sin confirmar**). | Nada. | Bloqueada | — | jobspipe.dev/blog/does-glassdoor-have-an-api (secundaria) |
| **Greenhouse, Lever y Ashby** | APIs de job board públicas, oficiales y sin autenticación. Ashby trae el salario con `includeCompensation`. | Lever no tiene búsqueda de texto y su CORS obliga a llamar desde el backend. Ashby no pagina. | `JobPostingSource` por ATS. | Hoy | M | docs.greenhouse.io/job-board.html · github.com/lever/postings-api · developers.ashbyhq.com/docs/public-job-posting-api |
| **JSON-LD `JobPosting`** | Leer el bloque de la página única que pega el owner. | No vale para los portales bloqueados. | Respaldo de `JobPostingSource`, con guardia contra SSRF. | Hoy | S | developers.google.com/…/job-posting |
| **Himalayas** | Sin clave, o con una clave gratuita: 60/min y 10.000/día. | Crédito visible. No se permite JSON-LD ni redistribuir a otros boards, agregadores, Google Jobs o LinkedIn Jobs. **Todo «Apply» tiene que usar el `applicationLink`**, no la URL del ATS. Rige también para uso personal. Para ver si una vacante sigue abierta se usa el endpoint de job individual, no el HTML (tiene anti-bot). | Radar privado con `applyUrl = applicationLink`. | Hoy | (radar) | himalayas.app/docs/remote-jobs-api |
| **Remotive** | Feed público. | Se recomienda un máximo de unas 4 consultas por día, y pasar de 2/min bloquea el acceso. Las vacantes llegan con 24 h de demora. El enlace a la URL de Remotive y el crédito son obligatorios. No se pueden mandar a terceros (la lista abierta nombra a Jooble, Neuvoo, Google Jobs y LinkedIn Jobs) ni usarlas para captar registros o emails. | Radar privado. | Hoy | (radar) | github.com/remotive-com/remote-jobs-api |
| **RemoteOK** | API sin clave. | Hay que poner un **backlink follow (sin `nofollow`)** a la URL de la vacante en Remote OK y nombrarlo como fuente. El logo no se puede usar sin permiso. Sin atribución, suspenden el acceso. | Radar privado: un enlace follow y el texto «vía Remote OK». | Hoy | (radar) | remoteok.com/api |
| **Arbeitnow** | API sin clave. | — | Radar privado. | Hoy | (radar) | arbeitnow.com/blog/job-board-api/ |
| **Adzuna** | Clave gratuita. La búsqueda personal de empleo está permitida. | Exige una etiqueta «Adzuna» de al menos 116×23 px con hipervínculo. El uso comercial, los leads o la reventa necesitan permiso escrito. La cuota la fija tu cuenta y puede cambiar. **Si se cancela la clave, hay que borrar sus datos de inmediato.** | Radar privado con la etiqueta y una purga de los datos. | Hoy (uso personal) | (radar) | developer.adzuna.com/docs/terms_of_service |
| **Jooble** | Clave gratuita. | ToS **sin confirmar**. | Solo después de leerlos. | Sin confirmar | — | jooblehelpcenter.freshdesk.com/… |
| **Stack Overflow** | API v2.3 sin OAuth. | La cuota está **sin confirmar** en la fuente primaria (que no se pudo abrir). Las fuentes secundarias dicen 300/día sin clave y 10.000/día con clave, unas 30 req/s por IP, y que **hay que respetar el campo `backoff`**. | Solo si hay actividad real. `backoff` se trata como `RetryAfter`. | Hoy | S | api.stackexchange.com/docs/throttle · apis.io/rate-limits/stackexchange/… (secundaria) |
| **dev.to y Hashnode** | dev.to `GET /api/articles?username=`. Hashnode GraphQL (`gql.hashnode.com`). | — | Tabla `Article` curada, si hay contenido. | Hoy | M | developers.forem.com/api/v1 |
| **Medium** | Solo RSS o IFTTT. | **Confirmado:** no emite tokens nuevos ni acepta integraciones nuevas, y los tokens existentes siguen funcionando. La URL del feed está **sin confirmar**. | RSS en la tabla `Article`. | Hoy (solo RSS) | S | help.medium.com/hc/en-us/articles/213480228-API-Importing · github.com/Medium/medium-api-docs |
| **Credly y Accredible** | URL pública de verificación por credencial. | Listar los badges de un portador: la API es para emisores. | Campo `verificationUrl` en Certification. | Hoy | S | docs.credly.com/browse/docs/getting-started · accredible.com/security/ |
| **npm, NuGet y PyPI** | npm por maintainer (**sin confirmar**). NuGet con `owner:`. PyPI JSON por proyecto. | PyPI no lista los paquetes por usuario. | Solo si hay paquetes propios. | Media | S | learn.microsoft.com/…/search-query-service-resource |
| **LeetCode, HackerRank y WakaTime** | — | No hay API oficial útil. | Un SocialLink o una certificación manual. | Bloqueada | — | — |
| **JSON Resume y Europass** | Estándar abierto v1.0.0. | No es bilingüe: se genera un archivo por idioma. La versión de Europass está **sin confirmar**. | `/{slug}/resume.json?lang=` y un importador. | Hoy | S | jsonresume.org/schema · europass.europa.eu/cs/node/733 |
| **LinkedIn «Add to Profile»** | Es para emisores con una Page. | No aplica al owner. | Nada. | No aplica | — | linkedin.com/help/…/a528030 |

---

## 4. Catálogo de features y mejoras por épica

Notación: Valor A/M/B · Esfuerzo S/M/L · Riesgo A/M/B.

### E0. Cierre del 1.0.0 (nuevo)
| # | Feature | Valor | Esf. | Riesgo | Reutiliza |
|---|---|---|---|---|---|
| 0.1 | Cerrar el deploy siguiendo `docs/DEPLOY-RAILWAY.md`. Después: la verificación posterior, el Post Inspector, Slack (tarea 5.4 de `add-server-rendered-head`), la prueba de migración sobre un backup y el tag v1.0.0. Si el deploy ya se hizo fuera del repo, registrarlo en `CLAUDE.md` y en el checklist | A | S | M | `RELEASE-1.0.0-CHECKLIST.md` § Estado |
| 0.2 | Backups con una restauración probada. Primero hay que ver si el Postgres de Hobby muestra la pestaña Backups (ver 9.1) | A | S | M | checklist, línea 33 |
| 0.3 | Curaduría de datos: la `url` de los 2 proyectos, al menos 2 repos con descripción y tags, y los enlaces de las credenciales | A | S (trabajo del owner) | B | `DATA-POPULATION.md` § 10, checklist, línea 44 |
| 0.4 | Medir el uso real en `workspace/usage` de Railway y fijar un usage limit en Hobby | M | S | B | — |

### E1. Evidencia técnica verificable
| # | Feature | Valor | Esf. | Riesgo | Depende de | Reutiliza |
|---|---|---|---|---|---|---|
| 1.1 | `verificationUrl`, `credentialId` y `expiresAt` en Certification, con «Ver credencial» en la sección y en el PDF | A | S | B | — | `add-profile-content-admin`, hoja imprimible |
| 1.2a | **Módulo `featured-repository` desde cero** (hoy no hay código en `backend/src`). Incluye entidad, repositorio, CRUD, una sección `repositories` (10.º id del catálogo) y `selectByTags`. Toca layout-engine, el render, los rótulos, la hoja imprimible y el manual | A | L | M | 0.3 | `select-by-tags`, regla de ocultar con menos de 2 items |
| 1.2b | Sync con GitHub: stars, lenguajes, topics y el sello «verificado el…» | A | M | M | 1.2a, 7.1 | `ExternalSnapshot` |
| 1.3 | Métricas de GitHub hacia `SocialLink.stats`, con opt-in | M | S | B | 7.1 | `SocialLink.stats` (Json) |
| 1.4 | Cobertura con evidencia (`computeTagCoverage`): separa lo respaldado de lo solo declarado. Lo negativo se ve solo en el panel | A | M | M | 1.1, 1.2a, 2.1 | normalización de `select-by-tags` |
| 1.5 | Artículos, Stack Overflow, paquetes y GitLab | B | S–M c/u | B | 7.1 y que exista el contenido | puerto de evidencia |

### E2. De la vacante al perfil (con IA opcional)
| # | Feature | Valor | Esf. | Riesgo | Depende de | Reutiliza |
|---|---|---|---|---|---|---|
| 2.1 | **Entrada de vacante**: URL de un ATS, JSON-LD o texto pegado. Da un `JobPosting` normalizado y una **sugerencia** de criterios con su cobertura determinística. El borrador PRIVATE lo crea `curated-profile` | A | M | M (SSRF) | — | builder, preview, duplicar, `CreateCuratedProfileUseCase` |
| 2.2 | Vacante a perfil con IA: Haiku → Sonnet → validación en TS → humano | A | L | M | 2.1, 6.1 | `CuratedProfileComposer` |
| 2.3 | Carta y respuestas con evidencia por afirmación | A | M | A | 6.1, 6.3, 2.5 (años) | `compute-years-of-experience` en `profile/domain/services` |
| 2.4 | Traducción asistida de los faltantes ES/EN | M | S | B | 6.1 | aviso de faltantes |
| 2.5 | Linter del CV. **Capa 1 sin IA:** fechas, respaldo temporal de skills, tags huérfanos y **`Profile.yearsOfExperience` contra el cálculo sobre las fechas**. Capa 2 con LLM | M | M | B | capa 2: 6.1 | cierra `skills-con-respaldo-temporal` |

### E3. Postulaciones y seguimiento
| # | Feature | Valor | Esf. | Riesgo | Depende de | Reutiliza |
|---|---|---|---|---|---|---|
| 3.0 | **ShareLink**: código por destinatario y portal, con etiqueta y revocación (el MVP no tiene vencimiento). **El cliente reenvía `via` desde la URL del SPA a la llamada a la API**, también en `profile-prefetch.js`. Guarda `ProfileView.shareLinkId` y suma el desglose `byShareLink`. **Reabre el veto de `registro-de-envios` (ROADMAP-1.1 § 2) con un motivo nuevo**: en producción el referrer no funciona y la búsqueda de empleo es activa | A | M | M | 5.1 | `viewContext`, `AggregateProfileViewsUseCase` |
| 3.2 | **CRM de postulaciones**, un change aparte y posterior: empresa, puesto, URL, portal, estado con transiciones en dominio, notas, perfil y ShareLink, «abierto el…», tabla y CSV. El kanban queda fuera del MVP | A | L | M | 3.0 | backoffice |
| 3.3 | Email (Resend) en la primera apertura humana de un ShareLink | A | M | M | 3.0, 5.1, pregunta 12 | `BackgroundTasks` |
| 3.4 | Radar de vacantes con agregadores. El contrato `JobFeedSource` tiene un **`applyUrl` obligatorio** y la atribución propia de cada fuente | M | L | M | 7.1, 2.1 | servicio de cruce |
| 3.5 | Upwork (si aprueban la clave) y Torre (si dan permiso) | B–M | M / S | M | 3.4 | `JobFeedSource` |
| 3.6 | `expiresAt` en el perfil curado y en el ShareLink | M | S | B | — | regla de archivado |

### E4. Distribución y SEO
| # | Feature | Valor | Esf. | Riesgo | Depende de | Reutiliza |
|---|---|---|---|---|---|---|
| 4.1 | **Envolver el `Person` que ya existe** (`personJsonLd()`, que se emite solo si `!noindex`) en `ProfilePage` (`mainEntity`), con `dateModified` y `knowsAbout`. Se cambian juntos el servidor y el cliente, bajo `profile-head.consistency.spec.ts` | M | S | B | — | `profile-head.renderer.ts` |
| 4.2 | Botón «Compartir en LinkedIn» (share-offsite) con un ShareLink `linkedin` — **resuelto en `add-share-links`** (D12), no en `upgrade-profile-structured-data` | M | S | B | 3.0 | — |
| 4.3 | Imagen OG por perfil (`/og/:slug.png`) | M | M | M | — | Inter, Caddy |
| 4.4 | Export JSON Resume por perfil e idioma, y un importador | M | S | B | — | DTO de resolución |
| 4.5 | Importador del ZIP de LinkedIn con diff (es lo único que trae el headline) | M | M | M | — | merge del seed |
| 4.6 | Publicar en LinkedIn por API (`/v2/ugcPosts`, con 150/día por miembro), con un aviso a los 50 días para renovar el OAuth. El adaptador queda aislado por si LinkedIn migra a `/rest/posts` | B–M | M | M | 7.1 | — |

### E5. Analítica para la búsqueda
| # | Feature | Valor | Esf. | Riesgo | Depende de | Reutiliza |
|---|---|---|---|---|---|---|
| 5.1 | **Clasificar las visitas, empezando por las propias.** La cookie `portfolio_session` ya llega, porque el prefetch usa `credentials:'include'` y es el mismo origen. Después vienen los bots que ejecutan JS (Googlebot, HeadlessChrome/Lighthouse): `classifyUserAgent` puro, un backfill y un desglose `byKind`. LinkedInBot, Slackbot y UptimeRobot no ejecutan JS, y la ruta del fragmento no cuenta visitas, así que hoy no ensucian la señal | A (propias) / M (bots) | S | B | — | `userAgent` persistido |
| 5.2 | Embudo por postulación | A | S | B | 3.0, 3.2 | dashboard |

### E6. IA (base)
| # | Feature | Valor | Esf. | Riesgo | Depende de |
|---|---|---|---|---|---|
| 6.1 | `LlmPort`, `AnthropicLlmAdapter`/`FakeLlmAdapter`, `AiRun`, `BudgetGuard`, caché por hash, `AI_ENABLED` y la frontera de datos | A | M | M | 7.1 |
| 6.2 | Evals: validadores sobre cassettes en el CI y `npm run ai:eval` a demanda | A | M | B | 6.1 |
| 6.3 | Asistente del panel con tool use y confirmación por cada escritura | M | L | A | 6.1, 6.2 |

### E7. Plataforma de integraciones (transversal)
| # | Feature | Valor | Esf. | Riesgo |
|---|---|---|---|---|
| 7.1 | Módulo `integrations`: `SecretCipher` (keyring y rekey), `IntegrationCredential`, `IntegrationSetting` (kill switch), `IntegrationJob` (`SKIP LOCKED`), `SyncRun`, `ExternalSnapshot`, `nextRetryDelay`, circuit breaker, CLI `sync` y `railway.sync.json` | A | M | M |
| 7.2 | Observabilidad: `syncRunId`, redacción de secretos y un aviso si pasan más de 48 h sin una corrida exitosa | M | S | B |

### E8. Deuda y seguridad
| # | Feature | Valor | Esf. | Riesgo |
|---|---|---|---|---|
| 8.1 | Cambio de contraseña y `sessionVersion` en el JWT | M | S | B |
| 8.2 | 2FA TOTP con códigos de recuperación y `admin:bootstrap --reset-2fa` | M | M | M |
| 8.3 | Overrides de skills y proyectos en el constructor. **El cambio es solo de frontend**: el composer ya pasa `includeIds` y `excludeIds` a `selectByTags` y `selectSkillCategories`. El arreglo es único para todos los tipos y los ids son cuid, así que no colisionan (se registra como Dn) | M | S | B |
| 8.4 | CSRF, sin abrir un ítem nuevo: se retoma el diferido del checklist (línea 45). (a) Verificar que producción tenga `SESSION_COOKIE_SAMESITE=strict`, porque el default del código es `'lax'`, o hacer que el default sea `strict` en producción. (b) Si el dominio es `mjsaavedra.is-a.dev`: según los críticos, `is-a.dev` está en la PSL desde la release 20240410 (PR #1949). Entonces es un sitio registrable propio y por ese motivo no hace falta el token de doble envío. Un check en el CI contra `public_suffix_list.dat` lo confirma | M | S | B |
| 8.5 | FeaturedRepository: activarlo (1.2a). Borrarlo sería **M** (seed-runner, seed-source, seed-guard, verify-seed, `cv-data.json`, el ejemplo y las specs `data-persistence-seed` y `example-seed-data`), así que no se recomienda | B | — | B |
| 8.6 | **Contraste del panel: es deuda real.** La verificación del 2026-10-28 (`add-learning-guide-and-example-data`) encontró 39 nodos `color-contrast` (serious) en `/admin/experiencias`, `/admin/formacion`, `/admin/proyectos` y en los presets claros en móvil, más un `scrollable-region-focusable` en `/admin`. El CI no los ve porque `cv-data.json` no tiene ítems ocultos ni acentos oscuros. (La regresión sembrada del 2026-10-16 es otro hallazgo.) Se arregla con un change S que además sume una carga con datos de ejemplo a `a11y:check` | M | S | B |

### E9. Operación
| # | Feature | Valor | Esf. | Riesgo |
|---|---|---|---|---|
| 9.1 | **Backups.** Primero hay que mirar en el servicio Postgres de Hobby si está la pestaña Backups. La documentación de Railway no restringe la función por plan: solo limita los backups manuales al 50 % del volumen. Que Hobby no tenga backups sale del foro (**sin confirmar**).<br>• **Si están:** backups nativos y una restauración probada (S, sin código).<br>• **Si no:** un workflow de GitHub Actions (`pg_dump -Fc`, `age`, subida directa a R2, sin artifacts). Usa un rol de solo lectura, el TCP proxy abierto solo durante la ventana del dump y timeouts cortos | A | S | M |
| 9.2 | Uptime con UptimeRobot: `/health`, `/` y un keyword monitor sobre el head SSR | M | S | B |
| 9.3 | Runbook de rotación de secretos y presupuesto de Railway por servicio | M | S | B |

---

## 5. Arquitectura propuesta

### 5.1 Módulos
- **`integrations/`** (nuevo, transversal):
  - **domain:** `IntegrationProvider`, `SyncRun`, `ExternalSnapshot`, `nextRetryDelay` y los errores.
  - **application:** los puertos `ConnectorPort`, `CodeEvidencePort`, `JobPostingSource`, `JobFeedSource` (con `applyUrl` obligatorio y `attribution`), `SecretCipher` y `NotificationSender`, y los casos de uso `RunDueSyncJobsUseCase` y `SyncCodeEvidenceUseCase`.
  - **infrastructure:** los adaptadores por proveedor, los adaptadores nulos, la cola Prisma y `IntegrationsModule.register(flags)`.
- **`job-posting/`** (nuevo): `JobPosting`, `ImportJobPostingUseCase`, `SuggestProfileCriteriaFromPostingUseCase` (devuelve **solo** los criterios y la cobertura) y el servicio puro `computeTagCoverage`. **No escribe en `CuratedProfile`.**
- **`curated-profile/`** (se extiende):
  - `CreateCuratedProfileFromPostingUseCase` (o `CreateCuratedProfileUseCase`) recibe un puerto de lectura de `JobPosting` por token Symbol y crea el borrador.
  - Suma el agregado `ShareLink`, `expiresAt`, `ProfilePage` y la imagen OG.
  - La visita sigue registrándose por el puerto que ya usa `ResolveCuratedProfileUseCase`, ahora con `shareLinkId` y `kind`.
- **`featured-repository/`** (nuevo, 1.2a).
- **`application-tracking/`** (nuevo): `Application` con su máquina de estados y `GetApplicationFunnelUseCase`.
- **`analytics/`** (se extiende): `classifyVisit` (sesión de admin y UA) y los desgloses `byShareLink` y `byKind`.
- **`profile/domain/services`**: `computeYearsOfExperience`, que es puro y lo usan el linter y la IA.
- **`ai/`** (2.0): `LlmPort`, `BudgetGuard`, `AiRun`, los prompts versionados y los cassettes. Los casos de uso de IA viven en el módulo dueño del dato.

### 5.2 Diagrama

```
                   ┌──────────────── Railway (Hobby) ─────────────────┐
 Reclutador ──▶ web (Caddy: SPA + proxy /api, /og, robots, sitemap)   │
   ?via=abc        │   SPA + profile-prefetch.js reenvían via → /api  │
                   │            ▼                                      │
 Owner /admin ─────┼──▶  api (NestJS)                                  │
                   │     ├ curated-profile ◀─ lee Postgres (público)   │
                   │     │   └ crea borrador ◀─ puerto lectura JobPosting
                   │     ├ analytics (propias/bots/ShareLink)          │
                   │     ├ application-tracking                         │
                   │     ├ job-posting ──▶ JobPostingSource (ATS/JSON-LD, SSRF guard)
                   │     ├ ai ──▶ LlmPort ──▶ Anthropic API (BudgetGuard)
                   │     └ integrations ("Sincronizar ahora" → encola) │
                   │                    ▼                              │
                   │     Postgres: datos · IntegrationJob · Snapshot · SyncRun · AiRun
                   │                    ▲                              │
                   │     sync (cron, misma imagen, termina solo)       │
                   │       └─▶ GitHub (PAT siempre, ETag) · agregadores │
                   └───────────────────────────────────────────────────┘
 Backups: nativos de Railway si Hobby los ofrece; si no, GitHub Actions → age → R2
 UptimeRobot → /health, /, /<slug>      Resend ← NotificationSender
```

Las flechas hacia terceros salen **solo** de `sync` o de acciones del owner en /admin.

### 5.3 Tokens, sincronización, cola y reintentos
- **Credenciales.** Se configuran con `INTEGRATIONS_KEYS` y `INTEGRATIONS_ACTIVE_KEY`, validadas en `env.validation.ts`. El secreto de cada proveedor se exige solo si está en `INTEGRATIONS_ENABLED`, y `npm run integrations:rekey` es idempotente. El OAuth de LinkedIn es opcional y usa `state` firmado. Como no hay refresh token, el panel avisa a los 50 días. Para GitHub alcanza un PAT en una variable de entorno.
- **Sincronización.** Un 4.º servicio `sync` con `cronSchedule` diario en UTC (p. ej. `0 10 * * *` = 06:00 en Bolivia). Railway exige 5 minutos mínimos entre corridas y saltea una corrida si la anterior sigue activa, así que hace falta `SYNC_MAX_RUNTIME_MS`.
- **Cola.** `IntegrationJob` con una `idempotencyKey` única, los estados `PENDING`, `RUNNING`, `DONE`, `FAILED` y `DEAD`, y liberación de los locks vencidos.
- **Reintentos.** Cada adaptador clasifica su error en una de estas clases:
  - `RetryAfter`: incluye el campo `backoff` de Stack Exchange.
  - `ResetAt`
  - `Transient`
  - `Permanent`
  - `BudgetExhausted`: en Anthropic, se mapean a esta clase **dos** respuestas:
    - el 429 `rate_limit_error` con `error.details.error_code = enforced_spend_limit_reached` (el tope del tier, que se libera el 1.º del mes a las 00:00 UTC);
    - el 400 `invalid_request_error` del spend limit que fija el usuario en la Console. Hay que distinguirlo de los 400 por una request mal formada.

  Ninguna de esas dos respuestas se reintenta, y un test cubre las dos formas. El backoff usa jitter completo, con base de 30 s y tope de 6 h. `Permanent` y `BudgetExhausted` pasan a DEAD y se muestran en el panel. A GitHub se le pega en serie y siempre con `Authorization`.
- **Caché.** `ExternalSnapshot` guarda el `etag` y el `contentHash`. Con un 304 solo se actualiza `fetchedAt`. `LlmCompletionCache` usa como clave el hash del modelo, la versión del prompt y la entrada.
- **Atribución en el radar.** La UI muestra el `applyUrl` y el crédito que exige cada fuente:
  - **Himalayas:** el `applicationLink`, y ningún otro enlace de postulación (con test).
  - **RemoteOK:** un enlace follow (con test de que no lleva `nofollow`) y el texto «vía Remote OK», sin logo.
  - **Remotive:** un enlace y el crédito.
  - **Adzuna:** la etiqueta de al menos 116×23 px.

### 5.4 Patrones agénticos por feature (en el producto)

| Feature | Patrón | Modelo | Por qué |
|---|---|---|---|
| 2.1 Entrada de vacante | **Ninguno** (determinístico). Opcional: una llamada con salida estructurada para el texto libre | Haiku 5.5 | Los ATS ya entregan campos estructurados. |
| 2.2 Vacante a perfil | **Encadenamiento** con un gate determinístico y **humano en el bucle** | Haiku y después Sonnet 5.5 | Los pasos son fijos. El gate garantiza que no haya IDs inventados. |
| 2.3 Carta y respuestas | **Evaluador-optimizador** (máximo 2 iteraciones) y humano | Opus 5.5 genera; Sonnet o Haiku evalúan | El criterio es verificable por afirmación. |
| 2.4 Traducción | **Enrutamiento**, salida estructurada y Batch | Haiku o Sonnet | Es una tarea homogénea y barata. |
| 2.5 Linter, capa 2 | **Una llamada estructurada** sobre la capa 1 | Sonnet 5.5 (effort low) | Lo temporal queda en el código. |
| 3.4 Radar | Sin LLM. Opcional: un batch de Haiku | Haiku | Mucho volumen y poco valor por ítem. |
| 6.3 Asistente | **Agente con tool use**. Las escrituras devuelven un plan que el owner confirma | Sonnet 5.5 | Es el único caso abierto y de varios pasos. |
| Kit de postulación | **Orquestador-trabajadores: no lo recomiendo ahora** | — | Los trabajadores ya serían workflows. |

Detalles del API, a confirmar al implementar contra la referencia del SDK:
- En Sonnet y Opus 5.5, un `tool_choice` forzado devuelve 400.
- Desde el 2026-10-21, `temperature`, `top_p` y `top_k` devuelven 400, así que las evals miden tasas.
- En Opus, el thinking se controla con `effort`.
- El historial es append-only.
- Hay que chequear siempre `stop_reason`.

### 5.5 Patrón multiagente para *desarrollar* esto
1. **`arquitecto`** escribe el change, nombra los `MODIFIED` con el texto exacto y valida con `--strict` (incluido «Archive would refuse»). Después viene el Human Gate.
2. **Un `implementador`** hace el núcleo en serie: puerto, dominio y cola.
3. **Después, `implementador` × N en paralelo**, uno por adaptador y cada uno en su worktree. Todos trabajan contra una suite de contrato por puerto (`describeJobPostingSourceContract(factory)`, que incluye los checks de `applyUrl` y de atribución) y con fixtures de `nock` sanitizados.
4. **La sesión principal** integra y corre la suite completa. Revisa `git status` en main después de cada agente (ver la memoria del proyecto).
5. **Un revisor independiente** corre `code-review` sobre los PR de seguridad: SSRF, cifrado, OAuth y las tools del asistente.
6. **Los changes de prompts** pasan por las evals (6.2) antes del archivado.

---

## 6. Priorización

### 6.1 Matriz impacto/esfuerzo

| | **Esfuerzo S** | **Esfuerzo M** | **Esfuerzo L** |
|---|---|---|---|
| **Impacto alto** | 0.1 deploy · 0.2 backups · 0.3 datos · 5.1 propias · 1.1 certificaciones · 5.2 embudo | 3.0 ShareLink · 2.1 vacante · 7.1 integraciones · 1.2b sync GitHub · 6.1 IA · 2.3 carta · 3.3 avisos · 1.4 cobertura | 1.2a repos · 2.2 vacante con IA · 3.2 CRM |
| **Impacto medio** | 8.6 a11y del panel · 8.3 overrides · 4.1 ProfilePage · 4.2 share-offsite · 9.2 uptime · 8.1 contraseña · 3.6 vencimiento · 4.4 JSON Resume · 2.4 traducción · 1.3 métricas · 8.4 CSRF · 0.4 uso Railway | 4.3 OG · 4.5 ZIP LinkedIn · 2.5 linter · 8.2 TOTP | 3.4 radar · 6.3 asistente |
| **Impacto bajo** | 1.5 extras | 4.6 publicar por API · 3.5 Upwork/Torre | — |

### 6.2 Roadmap

#### Fase 1.0.x: cerrar el release (antes que todo)

| Ítem | Objetivo | Criterio verificable |
|---|---|---|
| Deploy 1.0.0 | El sitio arriba, siguiendo `DEPLOY-RAILWAY.md` | `/health` da 200 en el dominio final. El checklist tiene tildada la verificación posterior al deploy. El Post Inspector y Slack muestran el head por perfil (tarea 5.4). Existe el tag `v1.0.0`. `CLAUDE.md` marca el deploy como hecho. |
| Backups y restauración | Cerrar la línea 33 del checklist | Se usan backups nativos si Hobby los ofrece, o el workflow de 9.1 si no. Hay una restauración probada con conteos iguales, registrada con fecha. |
| Curaduría de datos | Un contenido creíble | Los 2 proyectos tienen `url`. Hay al menos 2 repos curados (para 1.2a). Las credenciales tienen enlace. `seed:verify` pasa. |
| Uso de Railway | Una base de costo real | El uso mensual de api, Postgres y web está anotado en `DEPLOY-RAILWAY.md` y hay un usage limit configurado. |

No son changes de OpenSpec, salvo que el workflow de backups termine en código. En ese caso entra `add-offsite-backups` con ADDED `operations-resilience`.

#### Fase 1.2: quick wins (sin IA, sin OAuth, sin un servicio nuevo)

| Change | Objetivo | Capabilities | Criterio de aceptación verificable |
|---|---|---|---|
| `classify-profile-views` | Separar las visitas propias primero y las de bots que ejecutan JS después | MODIFIED `profile-view-analytics`: «Registro de visita en cada resolución pública exitosa» y «Agregado por origen de la visita» (permite la señal de sesión de admin), copiados completos · MODIFIED `admin-analytics-dashboard` | Un e2e **con la cookie de admin** y otro con UA `Googlebot`/`HeadlessChrome` cumplen la semántica de `views` que se decida (pregunta 19), y la fila guarda su `kind`. El agregado muestra `byKind`. El backfill reclasifica las filas existentes. |
| `add-share-links` | Un link por destinatario y portal, que **viaja hasta la API** | ADDED `share-links` · MODIFIED `profile-view-analytics`: «Agregado por origen de la visita» (permite `shareLinkId`) y «Normalización del origen» · MODIFIED `curated-profile-resolution`, `public-seo`, `admin-curated-profile-crud` y `admin-analytics-dashboard`, con los requisitos nombrados en el design | La proposal cita el veto de ROADMAP-1.1 § 2 y su motivo nuevo. `via` entra en la clave `[slug, locale, token, via]` **tanto en la app como en `profile-prefetch.js`**, y `early-profile.spec.ts` amplía su matriz con `?via=`. **Una carga con `?via=` registra exactamente 1 visita** (e2e por el SPA, no con curl). Un `via` revocado no se atribuye. `canonical` y `og:url` no llevan `via`. Se verifica que el script clásico mantiene `Cache-Control: no-cache`. MVP: etiqueta y revocación; el vencimiento va en 3.6. |
| `fix-admin-contrast` | Cerrar los 39 nodos `color-contrast` y el `scrollable-region-focusable` del panel | MODIFIED de la capability de accesibilidad vigente (el requisito exacto se identifica al abrir el change) | `a11y:check` con el panel, sobre los datos de ejemplo (ítems ocultos, presets claros en móvil), da 0 violaciones serious. El CI suma esa carga. |
| `add-certification-verification` ✅ | Certificaciones verificables | MODIFIED `public-portfolio-sections-api`: «Certificaciones visibles» · ADDED `admin-content-management`: «Credencial de una certificación en la API del panel» y «Campos de credencial en el formulario de certificación» (en vez de MODIFIED, para no reescribir «Administración de idiomas, enlaces sociales, formación y proyectos») · ADDED `public-portfolio-frontend`, `printable-curated-profile`, `data-persistence-seed` y `example-seed-data` | `verificationUrl` solo acepta https. Se ve «Ver credencial» en la sección y en el PDF. `print:check` sigue dando una hoja. **Hecho** el 2026-10-29 (TC-42). |
| `add-builder-skill-project-overrides` ✅ | Paridad de include y exclude | MODIFIED `curated-profile-builder`: «Edición de los criterios de selección» · ADDED `curated-profile-builder`: «Selección de skills y proyectos en el constructor» y «Ítems ocultos y referencias huérfanas en la selección» · MODIFIED `curated-profile-resolution`: «Selección de skills por categoría» y «Selección de proyectos por tags» (solo escenarios nuevos) y `admin-curated-profile-preview`: «Misma resolución que la ruta pública» (un escenario nuevo) | El constructor incluye y excluye skills (por skill, agrupadas por categoría y con buscador) y proyectos, y el preview lo refleja. El design registra que el change es solo de frontend y que el arreglo es compartido (cuid). Tests de Vitest y un TC-nn. **Hecho** el 2026-10-29 (TC-43). |
| `upgrade-profile-structured-data` | Envolver el `Person` en `ProfilePage` (el botón share-offsite lo resuelve `add-share-links`) | MODIFIED `public-seo`: «Datos estructurados del profesional» | Un perfil PUBLIC emite `ProfilePage` con `mainEntity` (el Person actual), `dateModified` y `knowsAbout`. `profile-head.consistency.spec.ts` pasa con el servidor y el cliente cambiados juntos. Que PROTECTED y PRIVATE no emitan nada se mantiene como test de regresión. Rich Results Test sin errores. |
| `add-admin-password-change` | Cambiar la contraseña e invalidar las otras sesiones | MODIFIED `admin-authentication` | `POST /api/auth/password` tiene throttle. Después del cambio, un JWT anterior recibe 401 (`sessionVersion`). |
| `add-uptime-monitoring` (solo docs) | Uptime | sin delta de spec, o ADDED `operations-resilience` si se crea en 1.0.x | Los monitores están activos y documentados en `DEPLOY-RAILWAY.md`. |

Hay además un ajuste de configuración que no es un change: verificar `SESSION_COOKIE_SAMESITE=strict` en Railway (8.4 a), anotarlo en el checklist (línea 45) y sumar el check de PSL si el dominio es is-a.dev.

#### Fase 1.3: integraciones base y seguimiento

| Change | Objetivo | Capabilities | Criterio de aceptación |
|---|---|---|---|
| `add-integrations-foundation` | Cola, cron, cifrado, flags y snapshots, sin un proveedor real | ADDED `integration-connectors` e `integration-sync` · MODIFIED `api-platform`, `api-observability` y `admin-backoffice-shell` | El e2e de la cola pasa: `SKIP LOCKED`, lock vencido e idempotencia. `sync` termina con código 0. Ningún token aparece en los logs. Un proveedor desactivado no exige su secreto. El clasificador mapea a `BudgetExhausted` las dos formas de error de Anthropic (test). |
| `add-job-posting-intake` | De la URL o el texto a una sugerencia, y el borrador lo crea `curated-profile`. **Dn: portales cerrados** | ADDED `job-posting-intake` · MODIFIED `curated-profile-builder` | Con fixtures de los tres ATS y de JSON-LD se obtiene un `JobPosting`. Los hosts bloqueados responden «pegá el texto». Una IP privada o un redirect a una IP privada se rechaza. **`job-posting` no importa ningún repositorio de `curated-profile` (test de arquitectura).** El borrador queda PRIVATE con `filterTags` ⊆ vocabulario. |
| `add-application-tracking` (en curso) | CRM (MVP: tabla, estados y ShareLink) | ADDED `application-tracking` · MODIFIED `admin-analytics-dashboard` | CRUD bajo `/api/admin/applications`. Una transición inválida da 422. Muestra «abierto el…». Exporta a CSV. No tiene rutas públicas. |
| `add-featured-repositories` (necesita 0.3) | El módulo y la sección desde cero (1.2a) | ADDED `featured-repositories` · MODIFIED `curated-profile-resolution` (el requisito del catálogo de nueve ids), `layout-engine`, `printable-curated-profile`, `frontend-localization`, `public-portfolio-sections-api`, `api-contract-types` y `admin-content-management` | CRUD en el panel. La sección se oculta con menos de 2 repos. `print:check` da una hoja. No hay deriva de `openapi.json` ni de `api.d.ts`. Hay un TC-nn. |
| `add-github-code-evidence` | Sync con GitHub (1.2b) | ADDED `code-evidence` | Con el fixture, se actualizan stars, lenguajes y topics. Un 304 autenticado no reescribe nada. Con el token vencido se sirve el último snapshot y el panel avisa. |
| `add-cv-consistency-rules` | Linter, capa 1 | ADDED `cv-consistency` | Fast-check: ningún «años con X» contradice las fechas. **`Profile.yearsOfExperience` se contrasta con `computeYearsOfExperience`** (o se aplica la Dn de la pregunta 20). El 100 % de los errores sembrados se detecta. |
| `add-open-notifications` | Email en la primera apertura humana | ADDED `owner-notifications` | Una visita humana con ShareLink envía el email (adaptador fake). Las visitas de bots o propias no envían nada. Se deduplica. |
| `add-json-resume-export` | `/resume.json?lang=` | MODIFIED `public-curated-profile-api` | Valida contra el schema v1.0.0. PRIVATE da 404 y PROTECTED sin token da 401. |

#### Fase 2.0: IA con humano en el bucle, radar y extras

| Change | Objetivo | Capabilities | Criterio de aceptación |
|---|---|---|---|
| `add-ai-foundation` | `LlmPort`, presupuesto y evals | ADDED `ai-assistance` · MODIFIED `api-platform` | Con `AI_ENABLED=true` y sin clave, la API no arranca. `BudgetGuard` corta al llegar al tope. El test de lista negra pasa. **Se reconfirman los precios en la página oficial.** |
| `add-ai-vacancy-to-profile` | Haiku → Sonnet → gate → humano | MODIFIED `job-posting-intake` y `curated-profile-builder` | 0 IDs inventados. Precisión y recall ≥ 0,85. No escribe sin que el owner guarde. |
| `add-ai-application-drafts` | Carta con evidencia | ADDED `application-drafts` | 0 afirmaciones sin soporte en un set de 20. Los años los calcula `computeYearsOfExperience`. |
| `add-ai-translation-assist` | Completar los faltantes ES/EN | MODIFIED `content-localization` y `curated-profile-builder` | El glosario queda intacto y se mantiene la misma cantidad de bullets. |
| `add-ai-cv-review` | Linter, capa 2 | MODIFIED `cv-consistency` | Cada issue cita un `entityId` existente. |
| `add-job-radar` | Bandeja de vacantes | ADDED `job-radar` | Cada fuente pasa la suite de contrato. Para Himalayas, **`applyUrl = applicationLink`** (test). RemoteOK lleva un enlace follow y no usa el logo (test). Adzuna lleva su etiqueta de al menos 116×23 px y hay una purga si se cancela la clave. Remotive respeta su límite de pedidos. Nada del radar llega a lo público ni al sitemap. Las vacantes vencen con TTL. |
| `add-linkedin-archive-import` | Importar el ZIP | MODIFIED `admin-content-management` | Diff contra un ZIP ficticio. No escribe sin confirmación. No guarda el archivo. |
| `add-og-image-per-profile` | Tarjeta OG | MODIFIED `public-seo` | Imagen de 1200×627 con ETag. PROTECTED y PRIVATE usan la genérica. El build con resvg pasa. |
| `add-admin-totp` | Segundo factor | MODIFIED `admin-authentication` | Login en dos pasos, códigos de un solo uso y reset por CLI. |
| `add-profile-expiration` | `expiresAt` en el perfil y en el ShareLink | MODIFIED `curated-profile-resolution`, `public-seo` y `share-links` | Si está vencido da 404 (con `now` inyectable) y sale del sitemap. |
| `add-admin-assistant` | Agente con confirmación | ADDED `admin-assistant` | Acierta en 30 pedidos. **0 escrituras sin confirmación.** No hay tool de borrado permanente. |
| Condicionales: `add-linkedin-share-api` (`/v2/ugcPosts`, aviso a los 50 días), `add-upwork-feed`, `add-torre-feed` y `add-writing-evidence` | Según las aprobaciones y el contenido real | — | Solo se abren si se cumple su condición (§ 9). |

---

## 7. Costos estimados

**Supuestos.** Por mes: 30 vacantes, 15 cartas, 1 pasada de traducción, 4 corridas del linter, 10 sesiones del asistente y 2 corridas de evals. El catálogo ocupa entre 15 y 20 mil tokens, sin medir con `count_tokens`.

Precios por MTok, **sin confirmar** porque no los reabrí en este paso; se reconfirman al abrir `add-ai-foundation`:
- Haiku 5.5: 0,10 / 0,50.
- Sonnet 5.5: 2 / 10.
- Opus 5.5: 4 / 20.

La escritura de caché cuesta 1,25x y el Batch tiene un 50 % de descuento.

| Rubro | Unitario | Mes |
|---|---|---|
| Vacante → perfil | ≈ 0,10–0,15 USD | 3–4,5 USD |
| Carta y respuestas | ≈ 0,15–0,25 USD | 2,3–3,8 USD |
| Traducción (batch) | ≈ 0,01 USD | < 0,05 USD |
| Linter, capa 2 | ≈ 0,07 USD | 0,3 USD |
| Asistente | 0,05–0,15 USD por sesión | 0,5–1,5 USD |
| Evals en vivo | < 5 USD por corrida | ≤ 10 USD (a demanda) |
| **Total de Claude API** | | **≈ 6–10 USD sin evals** (sin confirmar). Tope propio recomendado: 10 USD |
| Railway Hobby | 5 USD con 5 de uso incluido | 5 USD más el excedente. Si el uso total del mes pasa de 5 USD, se factura el uso total (railway.com/pricing). **El uso de api, Postgres y web no está medido** (tarea 0.4). |
| Servicio `sync` | — | **Se mide** en `workspace/usage` después de la primera semana. La página de cron jobs no explica cómo se factura. |
| Backups nativos de Railway | se facturan como volumen | Hay que verificar en el panel si Hobby los ofrece. |
| Cloudflare R2 (solo si se usa el plan B de backups) | gratis hasta 10 GB-mes, sin egress | 0 USD |
| GitHub Actions (repo privado, plan Free) | 12 USD por mes de cómputo incluido, ≈ 2.000 min de Linux 2-core a 0,006 USD/min. Artifacts: 500 MB compartidos con Packages | 0 USD si entra en la cuota. Ya la consume `web-quality` (Lighthouse). Sin un método de pago cargado, el uso se bloquea al agotarla. El dump va directo a R2, no como artifact. |
| Resend | gratis, 3.000 por mes y 100 por día | 0 USD |
| UptimeRobot | gratis, 50 monitores cada 5 min | 0 USD |
| APIs de GitHub, ATS y agregadores | gratis | 0 USD |
| **Total recurrente esperado** | | **≈ 5 USD más el excedente de Railway (a medir) hasta 2.0. Desde 2.0, entre 6 y 10 USD más de IA.** |

---

## 8. Riesgos y mitigaciones

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Se busca empleo sin el sitio arriba ni datos completos | A (hoy) | Alto | La Fase 1.0.x va primero. |
| La atribución por portal no funciona: el referrer no llega por `no-referrer` y el fetch del SPA | A (hoy) | Alto | ShareLink con `via` reenviado por el cliente, más un e2e a través del SPA. |
| Visita doble o atribución perdida por una clave distinta entre la app y `profile-prefetch.js` | M | Medio | La misma clave en los dos lugares, la matriz de `early-profile.spec.ts`, el criterio de «exactamente 1 visita» y `no-cache` en el script. |
| La IA inventa logros o años | M | Alto | Evidencia por afirmación, gate de IDs, cifras calculadas en el código (`computeYearsOfExperience`), evals con 0 como umbral y un humano que aprueba. |
| Dos fuentes de verdad para los años de experiencia | M | Medio | Una regla del linter, o una Dn de valor derivado (pregunta 20). |
| Inyección de prompt | M | Alto | El texto va delimitado como dato. Las cadenas no tienen tools de escritura. El asistente propone planes con confirmación. |
| SSRF | M | Alto | Lista de hosts permitidos, bloqueo de IPs privadas y link-local en cada redirect, timeout, tope de tamaño y solo GET. |
| La ruta pública depende de terceros | B | Alto | Test de arquitectura: los composers no importan adaptadores externos. |
| Violar los ToS de una fuente (Himalayas `applicationLink`, el follow de RemoteOK, la redistribución de Remotive, la etiqueta y la purga de Adzuna) | M | Alto (corte de acceso) | `applyUrl` y `attribution` obligatorios en el contrato, tests por fuente, radar solo privado y la Dn de portales cerrados. |
| Mezclar el corte del spend limit con un 400 genérico | M | Medio | Clasificación explícita de las dos formas, con test. |
| El contraste del panel no lo ve el CI | A (hoy) | Medio | `fix-admin-contrast` y la carga de ejemplo en `a11y:check`. |
| CSRF si producción queda con el default `lax` | B | Medio | Verificar `SESSION_COOKIE_SAMESITE=strict` o cambiar el default en producción. |
| Pérdida de datos | M | Alto | Backups con una restauración probada en 1.0.x. |
| Exponer Postgres por el TCP proxy para el dump (solo en el plan B) | M | Medio | Un rol de solo lectura, el proxy abierto solo durante la ventana y una credencial dedicada. |
| Se filtra un token | B | Alto | Keyring AES-256-GCM, redacción, un test que busca `ghp_`, `github_pat_` y `sk-ant-` en los fixtures, y DTO sin secretos. |
| Vence el token de LinkedIn (60 días, sin refresh) | A (si se usa 4.6) | Bajo | Aviso a los 50 días y re-OAuth. |
| Las APIs de terceros cambian (ugcPosts, RSS) | M | Bajo–Medio | Adaptadores aislados, suites de contrato, fixtures fechados y degradación al último snapshot. |
| Re-litigar el veto de `registro-de-envios` | M | Bajo | La proposal cita el veto y su motivo nuevo, y el MVP queda recortado. |
| Crece el alcance (CRM, repos) | M | Medio | Changes separados y MVPs mínimos. |
| Los registros DNS de Resend en is-a.dev (MX, TXT y DKIM) se piden por PR a su repo y pueden ser limitantes (**sin confirmar**) | M | Medio | Pregunta 12. Alternativa: un remitente en otro dominio propio. |

---

## 9. Decisiones para el owner

**Resueltas el 2026-10-28:**
- **1. Orden:** A. Primero la Fase 1.0.x (deploy, backups, datos) y después 1.2 sin IA.
- **2. Atribución:** C, los dos. `ShareLink` (`?via=`) para destinatarios y `?src=<portal>` para los enlaces genéricos por portal. `add-share-links` cubre ambos: `src` es un `ShareLink` implícito por portal, sin gestión, y entra en la misma clave de la app y del prefetch.
- **18. Estado del deploy:** todavía no está hecho; la Fase 1.0.x va antes que cualquier change.
- **19. Semántica de `views`:** A. `views` cuenta solo visitas humanas de terceros; todas las filas se guardan con su `kind`.

**Resueltas el 2026-11-07:**
- **3. Scheduler:** B, `@nestjs/schedule`, con la condición del owner de no generar cuellos de botella en los procesos de la app. El diseño de `add-integrations-foundation` tendrá que garantizarlo: trabajos fuera del event loop de las peticiones, una sola instancia ejecutora con lock en Postgres, timeouts y concurrencia acotada.
- **6. Repos:** A. Hay repos públicos en GitHub; `add-featured-repositories` entra en 1.3.
- **12. Dominio del remitente:** se decide más adelante; `add-open-notifications` queda después del deploy.
- **14. Cobertura en público:** A, solo en el panel.
- **15. Datos de reclutadores en el CRM:** A, empresa, puesto y notas, sin contacto.

Siguen abiertas las demás; las bloqueantes para 1.3 y 2.0 (3, 4, 6, 12) se responden al abrir esas fases.

1. **Orden de arranque.**
   - A) 1.0.x y después 1.2 sin IA.
   - B) 1.0.x y después IA.
   - C) 1.0.x, después 1.2 junto con `add-job-posting-intake`.

   **Recomiendo A.** **[bloqueante]**
2. **Atribución de enlaces.**
   - A) `?src=<portal>`.
   - B) `ShareLink` (`?via=`) reenviado por el cliente.
   - C) Los dos.

   **Recomiendo B**: es lo único que funciona con `no-referrer`, y reabre el veto de 1.1 con un MVP recortado. **[bloqueante para `add-share-links`]**
3. **Scheduler.**
   - A) Un cron de Railway (`sync`).
   - B) `@nestjs/schedule`.
   - C) GitHub Actions.

   **Recomiendo A**, una vez medido el uso (0.4). **[bloqueante para `add-integrations-foundation`]**
4. **Proveedor y tope de IA.**
   - A) Anthropic con 5 USD por mes.
   - B) Anthropic con 10 USD por mes.
   - C) Sin IA.

   **Recomiendo B**, más el spend limit de la Console, con la variable `AI_MONTHLY_BUDGET_USD`. **[bloqueante para 2.0]**
5. **Texto crudo de las vacantes.**
   - A) No guardarlo.
   - B) Guardarlo 90 días.
   - C) Guardarlo sin límite.

   **Recomiendo B.** **[no bloqueante]**
6. **Curaduría de repos.** ¿Tenés al menos 2 repos públicos para mostrar, con descripción y tags? ¿Hay repos en GitLab?
   - A) Sí: `add-featured-repositories` entra en 1.3.
   - B) Todavía no: queda diferido.

   **[bloqueante para 1.2a y 1.2b]**
7. **FeaturedRepository mientras tanto.** **Recomiendo mantenerlo inerte.** Borrarlo es M porque toca el seed, el verify, el ejemplo y dos specs, y no se justifica si vas a activarlo. **[no bloqueante]**
8. **Contenido para evidencia extra.** ¿Publicás en dev.to, Hashnode o Medium? ¿Tenés actividad en Stack Overflow? ¿Mantenés paquetes? **[no bloqueante]**
9. **LinkedIn.**
   - A) Share-offsite más el ZIP.
   - B) Además, publicar por API (`/v2/ugcPosts`, token de 60 días sin refresh).

   **Recomiendo A.** **[no bloqueante]**
10. **Upwork.** ¿Cumplís todos los requisitos (25.000 USD, JSS ≥ 90 %, identidad verificada, sin suspensiones, datos y foto válidos, un pago verificado y un uso descrito)? Si cumplís y aceptás el uso no comercial, se abre `add-upwork-feed`. Si no, queda el perfil «upwork» con su plantilla. **[no bloqueante]**
11. **Torre.**
    - A) Pedir un permiso escrito.
    - B) Solo enlazar el genoma.

    **Recomiendo B.** **[no bloqueante]**
12. **Dominio definitivo.** ¿`mjsaavedra.is-a.dev` o `mjsaavedra.link`?
    - El CSRF queda resuelto en los dos casos, siempre que `SameSite=strict` esté activo. Según los críticos, is-a.dev está en la PSL.
    - Lo que sigue pendiente es el remitente de Resend: en is-a.dev, los registros DNS se piden por PR a su repo (**sin confirmar** sus reglas actuales).

    **[bloqueante para `add-open-notifications`]**
13. **Canal de notificaciones.**
    - A) Email.
    - B) Telegram.
    - C) Los dos.

    **Recomiendo A**, con el puerto listo para B. **[no bloqueante]**
14. **Cobertura en público.**
    - A) Solo en el panel.
    - B) En público, solo lo positivo.

    **Recomiendo A en 1.3.** **[no bloqueante]**
15. **Datos de reclutadores en el CRM.**
    - A) Empresa, puesto y notas.
    - B) Además, un contacto.

    **Recomiendo A.** **[no bloqueante]**
16. **Fuentes del radar.** **Recomiendo** Himalayas, Remotive, RemoteOK, Arbeitnow y Adzuna (uso personal, con su etiqueta), cada una con sus reglas de atribución. Get on Board, después de revisar sus ToS. Jooble, solo si se confirman los suyos. **[no bloqueante]**
17. **Backups.** Primero hay que verificar si el Postgres de Hobby muestra la pestaña Backups.
    - A) Si la muestra: backups nativos.
    - B) Si no: GitHub Actions, `age` y R2, con un rol de solo lectura y el proxy abierto solo en la ventana del dump.
    - C) Pasar a Pro.

    **Recomiendo A, y B si no hay pestaña.** **[no bloqueante, pero urgente: es parte de 1.0.x]**
18. **Estado del deploy.** ¿Ya desplegaste fuera del repo? Si es así, hay que registrarlo en `CLAUDE.md` y en el checklist antes de planificar 1.2. **[bloqueante para planificar]**
19. **Semántica de `views`.** El requisito vigente exige sumar 1 en cada 200.
    - A) `views` cuenta solo las humanas, y todas las filas se guardan con su `kind`.
    - B) `views` cuenta todas y el desglose se hace por `kind`.

    **Recomiendo A.** **[bloqueante para `classify-profile-views`]**
20. **`yearsOfExperience`.**
    - A) Sigue cargado a mano, y el linter avisa si contradice las fechas.
    - B) Pasa a ser un valor derivado de las fechas (una Dn y una migración del contrato).

    **Recomiendo A** por ahora. **[no bloqueante]**

---

## 10. Fuentes

**LinkedIn**: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2 · https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin · https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow · https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access · https://learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens · https://www.linkedin.com/legal/l/api-terms-of-use · https://www.linkedin.com/help/linkedin/answer/a1341387 · https://www.linkedin.com/help/linkedin/answer/50191 · https://www.linkedin.com/help/linkedin/answer/a528030 · https://www.linkedin.com/post-inspector/
**Indeed y Glassdoor**: https://docs.indeed.com/job-sync-api · https://docs.indeed.com/send-candidates-api/ · JobsPipe (https://jobspipe.dev/blog/indeed-publisher-api, https://jobspipe.dev/blog/does-glassdoor-have-an-api) se cita solo como fuente secundaria y con conflicto de interés.
**Upwork**: https://support.upwork.com/hc/en-us/articles/115015857647-How-to-request-an-API-key-from-Upwork (contenido tomado del índice de búsqueda porque la página dio 403) · https://www.upwork.com/developer/documentation/graphql/api/docs/index.html. Saqué a GigRadar como respaldo.
**Torre**: https://pkg.go.dev/github.com/jjuanrivvera/torre-cli
**Get on Board**: https://www.getonbrd.com/help/what-can-i-do-with-get-on-board-s-api · https://www.getonbrd.com/api-doc.html · https://www.getonbrd.com/about/tos (sin revisar)
**ATS y JSON-LD**: https://docs.greenhouse.io/job-board.html · https://github.com/lever/postings-api · https://developers.ashbyhq.com/docs/public-job-posting-api · https://developers.google.com/search/docs/appearance/structured-data/job-posting · https://developers.google.com/search/docs/appearance/structured-data/profile-page
**Agregadores**: https://himalayas.app/docs/remote-jobs-api · https://github.com/remotive-com/remote-jobs-api · https://remoteok.com/api · https://arbeitnow.com/blog/job-board-api/ · https://developer.adzuna.com/docs/terms_of_service · https://jooblehelpcenter.freshdesk.com/en/support/solutions/articles/60001448238-rest-api-documentation
**Código y evidencia**: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api · https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api · https://docs.github.com/en/graphql/reference/users · https://docs.gitlab.com/user/gitlab_com/rate_limits/ · https://api.stackexchange.com/docs/throttle (no accesible) · https://apis.io/rate-limits/stackexchange/stackexchange-rate-limits/ (secundaria) · https://developers.forem.com/api/v1 · https://help.medium.com/hc/en-us/articles/213480228-API-Importing · https://github.com/Medium/medium-api-docs · https://learn.microsoft.com/en-us/nuget/api/search-query-service-resource · https://docs.credly.com/browse/docs/getting-started · https://www.accredible.com/security/
**Formatos**: https://jsonresume.org/schema · https://github.com/jsonresume/resume-schema/releases/tag/v1.0.0 · https://europass.europa.eu/cs/node/733
**IA (Anthropic)**: https://platform.claude.com/docs/en/about-claude/pricing · https://platform.claude.com/docs/en/api/errors · https://platform.claude.com/docs/en/api/rate-limits · https://platform.claude.com/docs/en/build-with-claude/structured-outputs · https://platform.claude.com/docs/en/build-with-claude/prompt-caching · https://www.anthropic.com/engineering/building-effective-agents · https://www.anthropic.com/legal/commercial-terms
**Infraestructura**: https://docs.railway.com/reference/cron-jobs · https://docs.railway.com/reference/backups · https://railway.com/pricing · https://station.railway.com/community/backup-for-hobby-plan-8a49123d (foro, sin confirmar) · https://docs.github.com/en/billing/concepts/product-billing/github-actions · https://developers.cloudflare.com/r2/pricing/ · https://resend.com/pricing · https://uptimerobot.com/pricing/ · https://publicsuffix.org/list/ · https://github.com/publicsuffix/list/pull/1949 · https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE
**Repo (solo lectura)**: `frontend\Caddyfile` (línea 112) · `frontend\public\profile-prefetch.js` · `backend\src\config\configuration.ts` (línea 60) · `docs\ROADMAP-1.1.md` (líneas 38 y 112) · `docs\RELEASE-1.0.0-CHECKLIST.md` (líneas 33, 44, 45 y 49-61) · `openspec\changes\archive\2026-10-28-add-learning-guide-and-example-data\verification\7.1-corrida.md` (línea 55) · `openspec\specs\profile-view-analytics\spec.md` · `openspec\specs\public-seo\spec.md` · `openspec\specs\curated-profile-builder\spec.md` · `backend\src\modules\curated-profile\application\services\profile-head.renderer.ts` · `backend\src\modules\curated-profile\application\services\curated-profile.composer.ts`

**Notas sobre las objeciones**
- **Apliqué las 33 objeciones.** No encontré ninguna incorrecta.
- **Lo que confirmé en el repo:** `Referrer-Policy no-referrer` (Caddyfile:112), el default `'lax'` (configuration.ts:60), el veto a `registro-de-envios` (ROADMAP-1.1:38) y la corrida de a11y del 2026-10-28.
- **Lo que tomé de los críticos sin reabrirlo:** las afirmaciones web nuevas (PSL de is-a.dev, los errores de spend limit de Anthropic, los ToS de Himalayas, Remotive, RemoteOK y Adzuna, la cuota de GitHub Actions, OIDC y ugcPosts de LinkedIn). Las atribuyo a sus URLs. En particular, la presencia de is-a.dev en la PSL queda para que la confirme el check del CI propuesto en 8.4.
- **Precios de la IA:** pasan a **sin confirmar** hasta abrir `add-ai-foundation`, porque no se reabrieron en este paso.

---

### Cierre del arquitecto
- **Artefactos:** no creé ni modifiqué nada en el repo. Los changes de la § 6 se crean después del Human Gate.
- **Validación:** no corresponde todavía, porque no hay changes nuevos. Cada change pasará `npx --no-install openspec validate <change> --strict` y la revisión de «Archive would refuse». Los `MODIFIED` ya nombran los requisitos vigentes exactos que identificaron los críticos. Las fallas conocidas de `--strict` (requisitos de más de 500 caracteres en specs archivadas) siguen como estado previo y no las toco.
- **Decisiones que propongo registrar como Dn:**
  - portales cerrados, sin API ni scraping (`add-job-posting-intake`);
  - la ruta pública nunca llama a terceros (`add-integrations-foundation`);
  - cola en Postgres y cron de Railway, sin Redis ni workers;
  - el LLM solo propone y las cifras las calcula el código;
  - cada módulo escribe solo su propio agregado (`job-posting` sugiere y `curated-profile` crea);
  - ShareLink reenviado por el cliente, con la misma clave en la app y en el prefetch (`add-share-links`, reabre el veto de 1.1);
  - el arreglo `includeIds`/`excludeIds` es compartido entre tipos (`add-builder-skill-project-overrides`);
  - `BudgetExhausted` cubre el 429 y el 400 del spend limit.
- **Preguntas bloqueantes:** 1, 2, 3, 4 (para 2.0), 6 (repos), 12 (remitente de Resend), 18 (estado del deploy) y 19 (semántica de `views`).
