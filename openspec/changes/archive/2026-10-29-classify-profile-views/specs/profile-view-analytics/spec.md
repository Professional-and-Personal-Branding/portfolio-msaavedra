# profile-view-analytics Specification (delta)

## ADDED Requirements

### Requirement: Clasificación de la visita
Cada visita SHALL guardarse con `kind`: `OWNER` si la petición trae una sesión de administrador válida (cookie `portfolio_session` o `Authorization: Bearer`, con la validación del guard del panel); si no, `BOT` si el `User-Agent` falta o coincide con la lista de patrones; si no, `HUMAN`. Una sesión ausente, vencida o inválida MUST NOT producir 401 ni cambiar la respuesta. El token MUST NOT persistirse ni escribirse en el log.

#### Scenario: Visita propia con la cookie del panel
- **WHEN** un cliente con la cookie `portfolio_session` emitida por el login hace `GET /api/curated-profiles/all` y se espera `whenIdle()`
- **THEN** responde 200, el nuevo `ProfileView` tiene `kind: "OWNER"` y `views` del perfil no cambió

#### Scenario: Sesión vencida o forjada
- **WHEN** un cliente con un `User-Agent` de navegador manda una cookie `portfolio_session` vencida o firmada con otro secreto
- **THEN** responde 200 con el mismo cuerpo que sin cookie, el `ProfileView` tiene `kind: "HUMAN"` y `views` aumentó en 1

#### Scenario: Bot que ejecuta JS
- **WHEN** un cliente sin sesión pide el perfil con un `User-Agent` que contiene `Googlebot` o `HeadlessChrome`
- **THEN** el `ProfileView` tiene `kind: "BOT"` y `views` no cambió

#### Scenario: Sin User-Agent
- **WHEN** un cliente sin sesión pide el perfil sin header `User-Agent`
- **THEN** el `ProfileView` tiene `kind: "BOT"`

#### Scenario: La sesión gana al User-Agent
- **WHEN** un cliente con sesión válida pide el perfil con un `User-Agent` que contiene `HeadlessChrome`
- **THEN** el `ProfileView` tiene `kind: "OWNER"`

#### Scenario: El verificador falla
- **WHEN** la validación de la sesión lanza un error (por ejemplo, la base no responde al buscar el administrador)
- **THEN** la respuesta ya fue 200, la visita se clasifica sin sesión y el log no contiene el token

### Requirement: Clasificador de User-Agent puro y versionado
`classifyUserAgent` SHALL ser una función pura de dominio, sin dependencias externas, que compara sin distinguir mayúsculas contra una lista de patrones versionada en el repositorio: buscadores que ejecutan JS, navegadores automatizados y de medición, previsualizadores, monitores y clientes programáticos. Devuelve `BOT` o `HUMAN`. Todo cambio de la lista SHALL subir su versión y sumar un caso de prueba.

#### Scenario: Navegadores reales
- **WHEN** se clasifican los `User-Agent` de Chrome, Firefox y Safari de escritorio y de Chrome y Safari móviles
- **THEN** todos dan `HUMAN`

#### Scenario: Bots conocidos
- **WHEN** se clasifican los `User-Agent` de Googlebot móvil, HeadlessChrome, Lighthouse, bingbot y `curl`
- **THEN** todos dan `BOT`

#### Scenario: Sin falsos positivos por subcadena
- **WHEN** se clasifica el `User-Agent` de un teléfono Android de la marca Cubot, `TestUA` o `example-seed`
- **THEN** dan `HUMAN`

### Requirement: Reclasificación idempotente de las visitas existentes
`npm run views:reclassify` SHALL recalcular con `classifyUserAgent` el `kind` de las filas que no son `OWNER`, y `views` de cada perfil como la cantidad de sus `ProfileView` con `kind` `HUMAN`. Sin `--apply` SHALL informar los cambios sin escribir; con `--apply` SHALL escribirlos en una transacción. MUST NOT tocar filas `OWNER` y correrlo dos veces SHALL dejar la base igual.

#### Scenario: Filas previas a la migración
- **WHEN** se aplica la migración sobre una base con visitas
- **THEN** todas las filas existentes quedan con `kind: "HUMAN"` y la cantidad de filas y los `views` no cambian

#### Scenario: Reclasificar bots viejos
- **WHEN** un perfil tiene 5 visitas `HUMAN`, 2 de ellas con `User-Agent` `HeadlessChrome`, y se corre con `--apply`
- **THEN** esas 2 quedan `BOT` y `views` del perfil queda en 3

#### Scenario: Simulación
- **WHEN** se corre sin `--apply`
- **THEN** informa por perfil los `views` actuales y los nuevos y los cambios de `kind`, y la base no cambia

#### Scenario: Idempotencia
- **WHEN** se corre con `--apply` dos veces seguidas
- **THEN** la segunda corrida no informa cambios

#### Scenario: Las propias se respetan
- **WHEN** existe una fila `OWNER` con un `User-Agent` de navegador común
- **THEN** después de correr con `--apply` sigue siendo `OWNER`

## MODIFIED Requirements

### Requirement: Registro de visita en cada resolución pública exitosa
Cuando `GET /api/curated-profiles/:slug` responde 200, el sistema SHALL crear un `ProfileView` con `curatedProfileId`, `locale` servido, `referrer` y `userAgent` (si vienen), `ipHash` (HMAC-SHA256 de la IP con `ANALYTICS_SALT`, nunca la IP), `kind` y `viewedAt`, y SHALL incrementar `views` del perfil en 1 de forma atómica solo si `kind` es `HUMAN`. Respuestas 401/404 MUST NOT registrar nada. Un fallo al registrar MUST NOT alterar la respuesta pública (se registra en log).

#### Scenario: Visita registrada
- **WHEN** un cliente hace `GET /api/curated-profiles/all?locale=en` con `User-Agent: TestUA`
- **THEN** existe un nuevo `ProfileView` del perfil `all` con `locale: "en"`, `userAgent: "TestUA"`, `kind: "HUMAN"`, `viewedAt` reciente, y `views` del perfil aumentó en 1

#### Scenario: Visita que no suma
- **WHEN** la visita se clasifica como `OWNER` o `BOT`
- **THEN** existe un nuevo `ProfileView` con ese `kind` y `views` del perfil no cambió

#### Scenario: IP nunca en claro
- **WHEN** se registra una visita desde la IP `203.0.113.7`
- **THEN** `ipHash` es un hex de 64 caracteres y ninguna columna contiene `203.0.113.7`

#### Scenario: Acceso denegado no registra
- **WHEN** un cliente pide un perfil `PROTECTED` sin token (401) o un slug inexistente (404)
- **THEN** el número de `ProfileView` no cambia

### Requirement: Lectura agregada para el administrador
`GET /api/admin/analytics/views` SHALL devolver `{ from, to, total, byProfile: [{ slug, views }], byLocale: [{ locale, views }], byDay: [{ day, views }], byKind: [{ kind, views }] }` para el rango `from`/`to` (fechas ISO, default últimos 30 días), ordenando `byProfile` por vistas descendente y `byDay` ascendente. `total` y los desgloses cuentan solo `HUMAN`; `byKind` cuenta todas las filas, con `HUMAN`, `OWNER` y `BOT` en ese orden. Requiere token de administrador.

#### Scenario: Agregado tras visitas
- **WHEN** se registraron 3 visitas `HUMAN` a `all` (2 en `es`, 1 en `en`) dentro del rango y el administrador consulta
- **THEN** `total ≥ 3`, `byProfile` contiene `{ slug: "all", views ≥ 3 }` y `byLocale` contiene `es` y `en`

#### Scenario: Desglose por tipo
- **WHEN** un rango sin otras visitas tiene 2 visitas `HUMAN`, 1 `OWNER` y 1 `BOT` y el administrador consulta
- **THEN** `total` es 2, la suma de `byProfile` es 2 y `byKind` es `[{ kind: "HUMAN", views: 2 }, { kind: "OWNER", views: 1 }, { kind: "BOT", views: 1 }]`

#### Scenario: Tipos sin visitas
- **WHEN** el rango no tiene visitas
- **THEN** `total` es 0 y `byKind` trae los tres tipos con `views: 0`

#### Scenario: Sin token
- **WHEN** un cliente sin token consulta `/api/admin/analytics/views`
- **THEN** recibe 401

#### Scenario: Rango inválido
- **WHEN** envía `from=ayer`
- **THEN** recibe 400

### Requirement: Agregado por origen de la visita
El agregado de visitas SHALL incluir `byReferrer: { referrer, views }[]`, construido **sobre el `referrer` que ya se persiste** desde la Fase 3, con las mismas visitas que `total`. MUST NOT persistirse ningún dato de origen nuevo ni la URL completa del origen: solo su host. La cookie de sesión solo SHALL leerse para clasificar la visita y MUST NOT guardarse.

#### Scenario: Solo el host
- **WHEN** el `referrer` trae path y query
- **THEN** el agregado guarda únicamente el host, sin path ni parámetros

#### Scenario: El total no cambia
- **WHEN** se compara la suma de `byReferrer` con `total` en el mismo rango
- **THEN** son iguales

#### Scenario: La cookie no se guarda
- **WHEN** se registra una visita `OWNER` con la cookie `portfolio_session`
- **THEN** ninguna columna del `ProfileView` contiene el token ni parte de él

### Requirement: La respuesta pública no espera al registro de la visita
La resolución pública SHALL devolver su resultado sin esperar a que termine el registro de la visita: el caso de uso lo entrega a un puerto de tareas en segundo plano y responde. La validación de la sesión que clasifica la visita SHALL ocurrir dentro de esa tarea. El registro SHALL seguir siendo atómico (`ProfileView` y, si es `HUMAN`, `views + 1` en una transacción) y un fallo SHALL quedar en el log sin propagarse. El puerto MUST NOT depender de Nest ni de Prisma.

#### Scenario: Responde antes de escribir
- **WHEN** el caso de uso resuelve con contexto de visita y el repositorio de visitas todavía no terminó de escribir
- **THEN** `execute()` ya devolvió el resultado exitoso, idéntico al que devuelve sin contexto

#### Scenario: Responde antes de validar la sesión
- **WHEN** el caso de uso resuelve con un token de sesión y el verificador todavía no respondió
- **THEN** `execute()` ya devolvió el resultado exitoso, idéntico al que devuelve sin token

#### Scenario: La visita se registra igual
- **WHEN** un cliente sin sesión hace `GET /api/curated-profiles/all` con un `User-Agent` de navegador y se esperan las tareas en segundo plano
- **THEN** existe un `ProfileView` nuevo de `all` con `kind: "HUMAN"` y su `views` aumentó exactamente en 1

#### Scenario: Un fallo en segundo plano no se propaga
- **WHEN** el repositorio rechaza el registro de una visita
- **THEN** la respuesta pública ya fue 200, el error queda en el log con el nombre de la tarea y no hay rechazos sin manejar

#### Scenario: Todo o nada
- **WHEN** una de las dos escrituras del registro de una visita `HUMAN` falla (por ejemplo, el perfil se borró entre la resolución y el registro)
- **THEN** no queda ningún `ProfileView` nuevo ni cambio en `views`, y el error queda en el log
