# Design — classify-profile-views

## Context

Ver `proposal.md`. Estado verificado el 28 de octubre de 2026 sobre `main` (`f833bbf`):

- **Registro.** `CuratedProfileController.findBySlug` (`backend/src/modules/curated-profile/infrastructure/controllers/curated-profile.controller.ts`) arma un `ViewContext` con `locale`, `referrer`, `userAgent` (primer valor del header) e `ipHash` (`hashIp` con `ANALYTICS_SALT`) y se lo pasa a `ResolveCuratedProfileUseCase`. El caso de uso, después de componer, entrega `recordView` al puerto `BackgroundTasks` (`shared/application/background-tasks.ts`, decisión D4 de `polish-builder-and-edge`) y responde sin esperar. `recordView` llama a `ProfileViewRepository.record` dentro de un `try/catch` que deja un `warn`.
- **Persistencia.** `PrismaProfileViewRepository.record` hace una `$transaction` con `profileView.create` y `curatedProfile.update({ views: { increment: 1 } })`. `aggregate` cuenta con `count`, dos `groupBy` y el único `$queryRaw` del proyecto (agrupación por día); `countByReferrer` agrupa por `referrer` crudo. Ningún método filtra por otra cosa que `viewedAt`.
- **Modelo.** `ProfileView { id, curatedProfileId, locale?, referrer?, userAgent?, ipHash?, viewedAt }`, con índices por `curatedProfileId` y `viewedAt`. `CuratedProfile.views Int @default(0)`. La última migración es `20261010120000_localize_language_level`, que migró datos en SQL.
- **Sesión.** `JwtStrategy` (`modules/auth/infrastructure/security/jwt.strategy.ts`) toma el token de `Authorization: Bearer` y, si no viene, de la cookie `portfolio_session` (`extractJwtFromSessionCookie`); valida HS256, firma y expiración con `jwt.secret`, y confirma con `GetCurrentAdminUseCase` que el administrador existe. `main.ts` aplica `cookieParser()` a toda la app, así que `req.cookies` existe también en la ruta pública. El JWT dura `JWT_EXPIRES_IN`.
- **La cookie ya llega.** `frontend/public/profile-prefetch.js` hace `fetch(url, { credentials: 'include' })` y la app usa `fetch` del mismo origen (Caddy en producción, el proxy de Vite en desarrollo). En producción la cookie es `SameSite=strict`; un `fetch` del propio sitio es *same-site*, así que la manda aunque la página se haya abierto desde LinkedIn.
- **Qué no cuenta hoy.** El fragmento de head (`GET /api/public/profile-head`) no registra visitas (`public-seo`), y el preview del panel tampoco (`admin-curated-profile-preview`). LinkedInBot, Slackbot y UptimeRobot piden el HTML pero no ejecutan el JS que llama a la API.
- **Quién sí cuenta sin ser una persona.** Googlebot (renderiza la SPA), y los cuatro scripts que abren páginas reales con `puppeteer-core` (`print:check`, `a11y:check`, `manual:capture`) o Lighthouse (`perf:check`). Por eso los cuatro exigen una variable `*_DISPOSABLE_DB=1`.
- **Visitas sintéticas.** `seed:example` crea 105 filas con `userAgent: "example-seed"` (`backend/scripts/lib/seed-source.ts`, `buildSyntheticViews`) e incrementa `views` en la misma cantidad. El manual cita esas 105.
- **Tests.** `backend/test/admin.e2e-spec.ts` y `background-views.e2e-spec.ts` cuentan visitas; varios piden el perfil **sin** `User-Agent` (supertest no manda ninguno) y esperan `views + 1` o que el agregado crezca.
- **Specs vigentes.** *Registro de visita en cada resolución pública exitosa* exige `views + 1` en cada 200; *Agregado por origen de la visita* dice que MUST NOT capturarse «ni cookies»; *La respuesta pública no espera al registro de la visita* fija `views + 1` en la transacción y su escenario *La visita se registra igual* espera +1 sin `User-Agent`.

## Goals / Non-Goals

**Goals:** que `views` y el dashboard muestren solo visitas de personas de terceros (P19 = A); que la fila se guarde siempre, con su tipo, para no perder información; que la ruta pública siga sin auth, sin latencia extra y sin riesgo de 401; que la regla de bots sea una función pura, versionada y probada; que las filas existentes se puedan reclasificar con la misma regla, tantas veces como cambie la lista.

**Non-Goals:** ver `proposal.md` § Non-goals.

## Decisions

### D1 — Un enum `ViewKind { HUMAN, OWNER, BOT }`, obligatorio, con precedencia OWNER > BOT > HUMAN

`ProfileView.kind` es un enum de Prisma (`ViewKind`) y un tipo homónimo en el dominio de `analytics` (`'HUMAN' | 'OWNER' | 'BOT'`), sin importar `@prisma/client` (el mapeo vive en el repositorio). Es `NOT NULL` con default `HUMAN`.

La precedencia es fija: una sesión de administrador válida gana siempre (el owner navegando con un UA raro, o `a11y:check` con login, siguen siendo suyos); si no hay sesión, decide el `User-Agent`.

Alternativas descartadas:
- **Dos booleanos (`isOwner`, `isBot`).** Cuatro combinaciones para tres estados, y una de ellas sin sentido. El agregado tendría que reconstruir el tipo.
- **Un `String` libre.** Sin integridad en la base; cualquier typo crea un tipo nuevo.
- **Un cuarto valor `UNKNOWN`** para las filas viejas. No aporta: las filas viejas se reclasifican por UA (D4) y las propias viejas no se pueden distinguir de ningún modo (ver Risks). La atribución de `add-share-links` es otra dimensión (`shareLinkId`), no otro tipo.

### D2 — La sesión se lee sin guard y se valida dentro de la tarea en segundo plano, con un puerto propio

1. **Controller (infraestructura).** `findBySlug` extrae el token con los mismos extractores que `JwtStrategy` (`Authorization: Bearer` y, si no, `extractJwtFromSessionCookie`), reunidos en un helper `extractAdminToken(req)` en `modules/auth/infrastructure/security/`. **No lo valida** y no usa `JwtAuthGuard`. Lo agrega al `ViewContext` como `sessionToken?: string`.
2. **Puerto (aplicación compartida).** `shared/application/admin-session-verifier.ts` declara `ADMIN_SESSION_VERIFIER` y `AdminSessionVerifier { isAdminSession(token: string): Promise<boolean> }`, igual que `BACKGROUND_TASKS`. No depende de Nest ni de Prisma.
3. **Implementación (auth).** `JwtAdminSessionVerifier` en `modules/auth/infrastructure/security/`: `JwtService.verifyAsync(token, { algorithms: ['HS256'] })` con el mismo secreto (expiración incluida) y `GetCurrentAdminUseCase` para confirmar que el administrador existe, como `JwtStrategy.validate`. Cualquier error devuelve `false`. `AuthModule` lo provee y lo exporta; `CuratedProfileModule` importa `AuthModule`.
4. **Caso de uso.** `recordView` hace `await verifier.isAdminSession(token)` **dentro** de la tarea de `BackgroundTasks`, envuelto en su propio `try/catch` (un rechazo cuenta como `false`), y recién después clasifica (D6). El token nunca sale de la closure: no se persiste, no va al log y los mensajes de error no lo incluyen.

Así la ruta pública no gana latencia (ni la verificación ni la consulta del administrador están en el camino de la respuesta), no puede devolver 401 por una cookie vieja y sigue cumpliendo *La respuesta pública no espera al registro de la visita*.

Alternativas descartadas:
- **Un guard opcional** (`AuthGuard('jwt')` con `handleRequest` que no lanza). Corre antes del handler y en serie: suma la consulta del administrador a cada visita pública. Además mezcla Passport en una ruta que el resto del sistema trata como anónima, y un error del guard opcional es más difícil de aislar de la respuesta.
- **Validar en el controller, antes de responder.** Mismo costo de latencia y el controller pasaría a tomar una decisión de dominio.
- **Solo verificar la firma, sin buscar el administrador.** Un JWT de un administrador borrado seguiría marcando visitas como propias hasta vencer. La consulta extra no pesa porque está fuera del camino de la respuesta.
- **Una cookie no `httpOnly` del frontend («soy el owner»).** Cualquiera la puede fijar, y es un dato nuevo en el cliente cuando el que ya llega es suficiente.
- **Marcar por `ipHash`.** La IP del owner cambia (móvil, VPN) y puede ser compartida (oficina): falsos positivos y negativos, y obliga a guardar una IP «propia».
- **Puerto en el dominio de `analytics`.** `auth/infrastructure` importaría el dominio de otro módulo solo para implementar un puerto genérico; `shared/application` ya tiene el precedente de `BackgroundTasks`.

### D3 — `classifyUserAgent` puro, sobre una lista de tokens versionada en el repositorio

`modules/analytics/domain/services/classify-user-agent.ts` exporta:

- `BOT_USER_AGENT_PATTERNS_VERSION = 1` y `BOT_USER_AGENT_PATTERNS`, una lista de **tokens literales** agrupados por motivo, comparados como subcadena sin distinguir mayúsculas.
- `classifyUserAgent(userAgent: string | null | undefined): 'BOT' | 'HUMAN'`. UA ausente, vacío o solo espacios → `BOT` (ningún navegador omite el header).

Contenido de la versión 1:

| Grupo | Tokens |
| --- | --- |
| Buscadores que ejecutan JS | `Googlebot`, `Google-InspectionTool`, `GoogleOther`, `Storebot-Google`, `AdsBot-Google`, `Mediapartners-Google`, `bingbot`, `BingPreview`, `Applebot`, `DuckDuckBot`, `YandexBot`, `Baiduspider`, `PetalBot` |
| Navegadores automatizados y medición | `HeadlessChrome`, `Chrome-Lighthouse`, `Lighthouse`, `PTST`, `PortfolioCheck` (D10) |
| Crawlers de SEO e IA | `AhrefsBot`, `SemrushBot`, `MJ12bot`, `DotBot`, `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Bytespider`, `CCBot` |
| Previsualizadores (hoy no llegan a la API) | `LinkedInBot`, `Slackbot`, `Twitterbot`, `facebookexternalhit`, `WhatsApp`, `TelegramBot`, `Discordbot` |
| Monitoreo | `UptimeRobot`, `Pingdom`, `StatusCake` |
| Clientes programáticos | `curl/`, `Wget/`, `python-requests`, `python-httpx`, `aiohttp`, `node-fetch`, `axios/`, `undici`, `Go-http-client`, `okhttp`, `Java/`, `libwww-perl`, `PostmanRuntime`, `insomnia` |

El test (`classify-user-agent.spec.ts`) tiene una tabla de UA reales por grupo, los cinco navegadores de *Navegadores reales*, los casos que hoy usan los tests y el seed (`TestUA`, `example-seed`, `BackgroundViewsE2E`) y casos de falsos positivos (un Android de la marca Cubot, un UA que contiene `robot` dentro de una palabra). Un test extra falla si la lista cambia sin que cambie la versión (compara un hash de la lista con el que corresponde a la versión).

`classify-visit.ts` exporta `classifyVisit({ adminSession: boolean, userAgent }): ViewKind` con la precedencia de D1.

Alternativas descartadas:
- **La librería `isbot` u otra lista de terceros.** El dominio no depende de librerías externas, la lista ajena trae miles de patrones con falsos positivos que no controlamos y su actualización no pasaría por una spec. Es una dependencia nueva para resolver un problema chico.
- **Un regex genérico (`bot|crawler|spider`).** Marca como bot a teléfonos Cubot y no detecta `HeadlessChrome` ni Lighthouse, que son los que más visitas suman hoy.
- **Una lista editable desde el panel.** Más superficie (tabla, CRUD, validación) para algo que cambia pocas veces y que conviene revisar en un PR con tests.
- **UA vacío como `HUMAN`** (como hoy). Ningún navegador manda la petición sin `User-Agent`; contarlo como persona solo infla el número. Ver la pregunta P1.

### D4 — Migración solo de esquema; la reclasificación es un script idempotente con la misma función

La migración (`<timestamp>_classify_profile_views`) crea el tipo `"ViewKind"` y agrega `"kind" "ViewKind" NOT NULL DEFAULT 'HUMAN'` a `"ProfileView"`. No tiene `UPDATE`: las filas existentes quedan `HUMAN`, que es exactamente lo que cuentan hoy, así que la migración por sí sola no cambia ningún número. No suma índices: el volumen es chico y los agregados ya filtran por `viewedAt`.

La reclasificación es `npm run views:reclassify` (`backend/scripts/reclassify-views.ts`, con la lógica en `backend/scripts/lib/reclassify-views.ts`):

- Lee las filas en lotes (`id`, `curatedProfileId`, `userAgent`, `kind`), calcula el `kind` esperado (las `OWNER` se saltean; el resto toma `classifyUserAgent(userAgent)`) y el `views` esperado por perfil (D5).
- **Sin `--apply`**: imprime la versión de la lista, el destino sin credenciales (como `describeDatabaseTarget` del seed), los conteos por tipo antes y después y, por perfil con diferencias, `views` actual → nuevo. No escribe. Código 0.
- **Con `--apply`**: escribe en una transacción (`updateMany` por `id` en lotes, de `HUMAN` a `BOT` y de `BOT` a `HUMAN`, y un `update` de `views` por perfil con diferencias) y deja el mismo informe.
- Es idempotente: con la base ya reclasificada no informa cambios. Rechaza argumentos desconocidos con código 1. No tiene negativa por producción: sin `--apply` no escribe, y con `--apply` hace lo que la spec promete.

Justificación del script frente a un `UPDATE` en la migración:
- **Una sola fuente para la regla.** Un `UPDATE … WHERE "userAgent" ~* '(Googlebot|HeadlessChrome|…)'` duplica la lista en SQL y la deja divergir de `classifyUserAgent`.
- **La lista va a cambiar.** Una migración aplicada no se edita; cada versión nueva de la lista necesitaría otra migración con otra copia. El script se vuelve a correr después de cada cambio de versión.
- **Producción todavía no tiene filas.** El deploy 1.0.0 no ocurrió (P18), así que el costo de que el script sea manual hoy es cero; queda en el runbook para cuando cambie la lista.

Alternativas descartadas:
- **`UPDATE` en la migración**, por lo anterior.
- **Reclasificar en el arranque de la API o en el `preDeployCommand`.** Una escritura masiva automática en cada deploy, contra la línea de `protect-default-seed` (nada escribe datos en un deploy salvo las migraciones).
- **Reclasificar al vuelo en cada consulta** (sin columna). Haría el agregado dependiente de la versión de la lista y obligaría a traer todos los UA para contar.

### D5 — `views` se recalcula con la reclasificación: pasa a ser la cantidad de visitas `HUMAN`

Con `--apply`, el script fija `views = count(ProfileView WHERE curatedProfileId = p AND kind = 'HUMAN')` para cada perfil con diferencias, en la misma transacción que los cambios de `kind`.

Por qué es seguro: `views` y las filas se mueven siempre juntas. El registro hace las dos escrituras en una transacción; las filas solo se borran con su perfil (cascada); el duplicado nace con 0 y sin filas; archivar no toca ninguna de las dos (`curated-profile-resolution`); `seed:example` crea N filas y suma N. Hoy `views` es la cantidad de filas, y después del change es la de filas `HUMAN`: recalcular con esa fórmula es exactamente la semántica P19 = A, aplicada hacia atrás.

Si alguna base tiene un `views` que no coincide con sus filas (ediciones manuales, restos de pruebas), la simulación lo muestra antes de escribir.

Alternativas descartadas:
- **Dejar `views` como está.** El listado de `/admin/perfiles` mostraría números que incluyen bots mientras el dashboard ya no: dos semánticas a la vez, sin forma de saber cuál es cuál.
- **Restar solo las filas que pasan a `BOT`.** Mismo resultado cuando todo es consistente, pero arrastra cualquier desfase previo y no es idempotente frente a una reclasificación inversa (`BOT` → `HUMAN` al achicar la lista).

### D6 — El caso de uso clasifica; el repositorio solo persiste e incrementa según el tipo

- `NewProfileView` suma `kind: ViewKind` (obligatorio).
- `ResolveCuratedProfileUseCase.recordView` (en la tarea): `adminSession = token ? await verifier.isAdminSession(token) : false` (con `catch` → `false`), `kind = classifyVisit({ adminSession, userAgent })` y `profileViews.record({ …, kind })`. Es el paso 6 del núcleo, que sigue perteneciendo al caso de uso.
- `PrismaProfileViewRepository.record` crea la fila con `kind` y, **solo si es `HUMAN`**, agrega el `increment` a la misma `$transaction`. Una fila `OWNER` o `BOT` es una sola escritura.

Alternativas descartadas:
- **Clasificar en el repositorio.** Es una regla de negocio; en infraestructura no se podría probar sin base.
- **Clasificar en el controller.** Lo deja con la decisión y con la verificación de la sesión en el camino de la respuesta (D2).
- **No guardar las filas `OWNER` y `BOT`.** Contradice la decisión del owner («todas las filas se guardan con su `kind`») y pierde el desglose.

### D7 — Los desgloses del agregado cuentan solo `HUMAN`; `byKind` cuenta todo, con los tres tipos fijos

- `ProfileViewRepository.aggregate` y `countByReferrer` filtran `kind = HUMAN` (también el `$queryRaw` por día). `countByKind(range)` agrupa todas las filas del rango por `kind`.
- `AggregateProfileViewsUseCase` devuelve `byKind` completando con 0 los tipos ausentes, en el orden `HUMAN`, `OWNER`, `BOT`. Se cumple `total === byKind[HUMAN]` y la suma de `byReferrer` sigue siendo `total`.
- Un perfil archivado sigue en `byProfile` con sus visitas `HUMAN`, como exige `curated-profile-resolution` (*Un perfil archivado conserva sus visitas*), que no cambia.

Alternativas descartadas:
- **Desgloses sobre todas las filas y `byKind` aparte.** El total del dashboard dejaría de coincidir con la suma de `views` de los perfiles y contradiría P19 = A.
- **Un parámetro `?kind=`** para filtrar los desgloses. Más superficie de contrato sin un uso concreto hoy; queda como P2.
- **`byKind` como objeto `{ HUMAN, OWNER, BOT }`.** Sería más cómodo en el cliente, pero rompe la forma `[{ clave, views }]` de los demás desgloses.

### D8 — Dashboard: tabla **Por tipo** después de **Por origen**, sin renombrar el total

- La tabla **Por tipo** va después de **Por origen**, con las filas *Personas*, *Tus visitas* y *Bots* y la línea: «Solo las visitas de personas suman en el total y en las visitas de cada perfil. Las tuyas se reconocen por la sesión del panel; los bots, por su navegador.»
- La tarjeta **Visitas en el rango** conserva su etiqueta; cambia la descripción de la página: «Visitas de personas en las vistas públicas de los perfiles curados. Las tuyas y las de bots se cuentan aparte, en *Por tipo*.» Así el manual y las capturas cambian lo mínimo.
- Con `total: 0` y algún tipo distinto de cero, se muestra el estado vacío de siempre y, debajo, la tabla **Por tipo**. Con los tres en cero, el estado vacío de siempre y nada más.
- Sin gráfico nuevo: es una tabla con el mismo componente que **Por idioma**.

Alternativas descartadas:
- **Una tarjeta por tipo en la fila de totales.** Le da a los bots el mismo peso visual que a las personas, y la fila de tarjetas ya tiene tres.
- **Renombrar la tarjeta a «Visitas de personas».** Más explícito, pero obliga a cambiar el manual, la captura y el test por una etiqueta que la descripción ya aclara.

### D9 — Contrato: `byKind` y el enum `ViewKind` en el OpenAPI

`ProfileViewsResponse` suma `byKind: CountByKind[]`, con `kind` declarado como enum `ViewKind` (`enumName: 'ViewKind'`), y las descripciones de `total`, `byProfile` y `byReferrer` aclaran que cuentan solo `HUMAN`. Se regeneran `backend/openapi.json` (`npm run openapi:export`) y `frontend/src/shared/types/api.d.ts` (`npm run api:types`); el test de deriva del frontend lo comprueba. La respuesta pública de `GET /api/curated-profiles/:slug` no cambia.

Alternativa descartada: **`kind` como `string` sin enum.** El frontend perdería el tipado de las tres claves y el mapeo a etiquetas no sería exhaustivo.

### D10 — Los scripts de calidad quedan `BOT` sin tocarlos, salvo que su UA no se distinga

Puppeteer (`print:check`, `a11y:check`, `manual:capture`) con `headless: true` y Lighthouse en emulación móvil (`perf:check`) deberían mandar `HeadlessChrome` y `Chrome-Lighthouse`, que están en la lista. Una tarea comprueba el UA real que guarda cada script en una base descartable. Si alguno no contiene un token de la lista, ese script agrega ` PortfolioCheck` a su UA (`page.setUserAgent(await browser.userAgent() + ' PortfolioCheck')` en Puppeteer; en Lighthouse, la misma cadena por `--emulatedUserAgent`), y el token ya está en la versión 1.

Consecuencias:
- Las visitas de esos scripts dejan de sumar en `views` y en el total del dashboard. En la base de ejemplo, el total de personas queda fijo en las 105 sintéticas aunque se corran los scripts: el manual puede citar 105 sin depender del orden de las corridas. La fila *Bots* sí varía y el manual no cita su número.
- `a11y:check` con login (`A11Y_CHECK_ADMIN_EMAIL`) puede producir visitas `OWNER` si recorre páginas públicas con la cookie: también correcto.
- Las variables `*_DISPOSABLE_DB=1` **se mantienen**: los scripts siguen creando filas, borrando datos (`manual:capture`) o dependiendo del contenido de ejemplo.

**Resultado de la verificación (tarea 8.1, 2026-10-28).** `print:check` (Puppeteer, `HeadlessChrome`) ya quedaba `BOT` (`manual:capture` usa el mismo Chrome headless). No así: Lighthouse (`perf:check`) manda el UA móvil de Moto G sin `Chrome-Lighthouse` ni otra marca, y los `fetch` de Node de `a11y:check` mandan `node`; los dos sumaban como `HUMAN`. Se aplicó la rama «si alguno no coincide»: `a11y:check` manda `User-Agent: PortfolioCheck` en sus GET y `perf:check` emula el UA móvil de Lighthouse con ` PortfolioCheck` al final (`--emulated-user-agent`). Evidencia en `verification/8.1-ua-scripts.txt`.

Alternativa descartada: **agregar `PortfolioCheck` siempre, por las dudas.** Toca cuatro scripts y la configuración de Lighthouse sin necesidad comprobada; se hace solo si la verificación lo pide.

### D11 — Verificación en la app real sobre una base descartable

Base `portfolio_views_check` en el contenedor `portfolio-postgres` (5434), con `prisma:deploy` y `seed:example` (`SEED_DISPOSABLE_DB=1`), API en el puerto 3310 y el frontend con `VITE_PROXY_TARGET`. Se comprueba:

1. Un navegador con sesión en `/admin` abre `/` → fila `OWNER`, `views` de `all` igual.
2. Una ventana privada abre `/` y `/ejemplo-backend` → filas `HUMAN`, `views` +1 en cada uno (una sola fila por carga, como exige `web-performance`).
3. `curl` con un UA de Googlebot y otro sin UA → filas `BOT`.
4. Una corrida de `print:check` contra esa API → filas `BOT` (y el UA real queda registrado para D10).
5. El dashboard muestra *Personas*, *Tus visitas* y *Bots* con esos conteos.
6. Se insertan filas `HUMAN` con UA de `HeadlessChrome` y vacío, se corre `views:reclassify` sin y con `--apply`, y otra vez con `--apply` (sin cambios).

La base del owner (`portfolio`) no se usa en ninguna tarea. Al terminar, `portfolio_views_check` se borra.

## Risks / Trade-offs

- **Las visitas propias anteriores al change quedan `HUMAN`.** No se persistió nada que identifique la sesión. Mitigación: es un sesgo acotado al pasado local (producción no tiene filas) y el owner puede ver su magnitud comparando antes y después. No se intenta adivinar por `ipHash` (D2).
- **El owner sin sesión cuenta como persona.** Si navega su sitio desde otro dispositivo o después de que venza el JWT (`JWT_EXPIRES_IN`), suma `HUMAN`. Aceptado: es el mismo dato que vería de cualquier otra persona, y la alternativa (IP, dispositivos marcados) suma superficie. Queda documentado en el manual.
- **Bots que se hacen pasar por navegadores.** Un crawler con UA de Chrome cuenta como persona. Es el límite de clasificar por UA sin servicios externos (non-goal). La lista cubre los que hoy pueden llegar a la API.
- **Falsos positivos de la lista.** Un token demasiado general (`Lighthouse`, `WhatsApp`) podría coincidir con un navegador real. Mitigación: tokens literales, tests de navegadores reales y de subcadenas, y versión obligatoria por cambio.
- **Una consulta extra por visita con cookie.** La búsqueda del administrador corre en segundo plano y solo cuando hay token; no afecta la respuesta.
- **Tests existentes que piden sin `User-Agent`.** Pasan a registrar `BOT` y sus expectativas de `views + 1` o de crecimiento del agregado fallarían. Se ajustan para mandar un UA de navegador (tarea 4.3); los que solo cuentan filas no cambian.

## Migration Plan

1. Mergear con la migración nueva. En desarrollo, `npm run prisma:migrate` la aplica; en producción la aplica el `preDeployCommand` (`prisma:deploy`). Sin `UPDATE`, sin pérdida: los números no cambian hasta la reclasificación.
2. Desde ese momento, las visitas nuevas se guardan con su tipo y `views` suma solo personas.
3. **Base local del owner:** él corre `npm run views:reclassify` (simulación), revisa el informe y, si le cierra, `npm run views:reclassify -- --apply`. Ninguna tarea de este change lo hace por él.
4. **Producción:** al primer deploy no hay filas; la reclasificación solo hará falta cuando suba la versión de la lista (`railway run npm run views:reclassify`, primero sin `--apply`). Queda en `docs/DEPLOY.md` § 7 y `docs/DEPLOY-RAILWAY.md`.
5. **Vuelta atrás:** revertir el código deja la columna sin uso; si hace falta, una migración nueva la elimina. Los `views` recalculados no se restauran solos: antes de `--apply` en una base con datos que importen, el informe sugiere el mismo `pg_dump` sin contraseña que el seed.

## Open Questions

**P1 — ¿Las peticiones sin `User-Agent` y las de clientes programáticos (`curl`, `python-requests`, `axios`…) cuentan como `BOT`?** **[resuelta el 2026-10-28: A]**
- A) Sí, `BOT` (lo que especifica este change).
- B) No, `HUMAN`, como hoy; la lista se limita a los bots que ejecutan JS.

Recomiendo **A**: ninguna persona llega a la API sin un navegador, y la decisión P19 busca que `views` cuente solo personas. Si el owner elige B, se quitan el grupo *Clientes programáticos* y la regla del UA vacío (D3), y se ajustan dos escenarios.

**Resolución (2026-10-28): A.** Las peticiones sin `User-Agent` y las de clientes programáticos cuentan como `BOT`, como está especificado en D3.

**P2 — ¿El dashboard necesita filtrar los desgloses por tipo (`?kind=`), por ejemplo para ver qué perfiles visitan los bots?** **[resuelta el 2026-10-28: A]**
- A) No por ahora: los desgloses son de personas y **Por tipo** da el panorama (lo que especifica este change).
- B) Sí: un selector *Personas / Tus visitas / Bots / Todas* que manda `?kind=` y recalcula todas las tablas.

Recomiendo **A**: B suma contrato y estados al panel sin un uso concreto durante la búsqueda; se puede agregar después sin romper nada.

**Resolución (2026-10-28): A.** Sin filtro `?kind=` por ahora: los desgloses son de personas y **Por tipo** da el panorama (D7, D8). Puede agregarse después sin romper el contrato.
