# profile-view-analytics Specification

## Purpose
Registra cada visita pública a un perfil curado, sin datos personales en claro, y ofrece al administrador una lectura agregada que alimentará el dashboard.

## Requirements

### Requirement: Registro de visita en cada resolución pública exitosa
Cuando `GET /api/curated-profiles/:slug` responde 200, el sistema SHALL crear un `ProfileView` con `curatedProfileId`, `locale` servido, `referrer` y `userAgent` (si vienen), `ipHash` (HMAC-SHA256 de la IP con `ANALYTICS_SALT`, nunca la IP) y `viewedAt`, y SHALL incrementar `views` del perfil en 1 de forma atómica. Respuestas 401/404 MUST NOT registrar nada. Un fallo al registrar MUST NOT alterar la respuesta pública (se registra en log).

#### Scenario: Visita registrada
- **WHEN** un cliente hace `GET /api/curated-profiles/all?locale=en` con `User-Agent: TestUA`
- **THEN** existe un nuevo `ProfileView` del perfil `all` con `locale: "en"`, `userAgent: "TestUA"`, `viewedAt` reciente, y `views` del perfil aumentó en 1

#### Scenario: IP nunca en claro
- **WHEN** se registra una visita desde la IP `203.0.113.7`
- **THEN** `ipHash` es un hex de 64 caracteres y ninguna columna contiene `203.0.113.7`

#### Scenario: Acceso denegado no registra
- **WHEN** un cliente pide un perfil `PROTECTED` sin token (401) o un slug inexistente (404)
- **THEN** el número de `ProfileView` no cambia

### Requirement: Lectura agregada para el administrador
`GET /api/admin/analytics/views` SHALL devolver `{ from, to, total, byProfile: [{ slug, views }], byLocale: [{ locale, views }], byDay: [{ day, views }] }` para el rango `from`/`to` (fechas ISO, default últimos 30 días), ordenando `byProfile` por vistas descendente y `byDay` ascendente. Requiere token de administrador.

#### Scenario: Agregado tras visitas
- **WHEN** se registraron 3 visitas a `all` (2 en `es`, 1 en `en`) dentro del rango y el administrador consulta
- **THEN** `total ≥ 3`, `byProfile` contiene `{ slug: "all", views ≥ 3 }` y `byLocale` contiene `es` y `en`

#### Scenario: Sin token
- **WHEN** un cliente sin token consulta `/api/admin/analytics/views`
- **THEN** recibe 401

#### Scenario: Rango inválido
- **WHEN** envía `from=ayer`
- **THEN** recibe 400

### Requirement: El rango de fechas es cerrado
El rango `from`/`to` SHALL ser cerrado: una fecha sin hora se resuelve al borde de ese día en UTC, inicio para `from` y final para `to`. Un instante completo SHALL respetarse tal cual, para consultar ventanas más finas que un día.

#### Scenario: El día en curso entra en el rango
- **WHEN** se registra una visita hoy y el administrador consulta `?from=<hoy>&to=<hoy>`
- **THEN** esa visita está en `total` y `byDay` contiene el día de hoy

#### Scenario: Ventana de horas
- **WHEN** consulta `?from=2026-10-05T12:00:00Z&to=2026-10-05T13:00:00Z`
- **THEN** solo cuenta las visitas de esa hora

### Requirement: Agregado por origen de la visita
El agregado de visitas SHALL incluir `byReferrer: { referrer, views }[]`, construido **sobre el `referrer` que ya se persiste** desde la Fase 3. MUST NOT capturarse ningún dato nuevo, ni cookies, ni la URL completa del origen: solo su host.

#### Scenario: Solo el host
- **WHEN** el `referrer` trae path y query
- **THEN** el agregado guarda únicamente el host, sin path ni parámetros

#### Scenario: El total no cambia
- **WHEN** se compara la suma de `byReferrer` con `total` en el mismo rango
- **THEN** son iguales

### Requirement: Normalización del origen de la visita
La normalización del `referrer` SHALL ser una función pura de dominio con estas reglas:

- `referrer` nulo, vacío o no parseable → `"directo"`.
- Una URL válida → su host en minúsculas, sin el prefijo `www.`.
- Un host que coincide con el de `FRONTEND_URL` → `"interno"`, para no contar la navegación dentro del sitio como tráfico entrante.

#### Scenario: Origen externo
- **WHEN** una visita llega con `referrer: "https://www.linkedin.com/feed/"`
- **THEN** cuenta bajo `linkedin.com`

#### Scenario: Sin referrer
- **WHEN** una visita llega sin `referrer`
- **THEN** cuenta bajo `directo`

#### Scenario: Navegación interna
- **WHEN** el `referrer` es una URL del propio `FRONTEND_URL`
- **THEN** cuenta bajo `interno` y no como tráfico entrante

#### Scenario: Referrer basura
- **WHEN** el `referrer` no es una URL parseable
- **THEN** cuenta bajo `directo` y no rompe el agregado

### Requirement: La respuesta pública no espera al registro de la visita
La resolución pública SHALL devolver su resultado sin esperar a que termine el registro de la visita: el caso de uso lo entrega a un puerto de tareas en segundo plano y responde. El registro SHALL seguir siendo atómico (`ProfileView` y `views + 1` en una transacción) y un fallo SHALL quedar en el log sin propagarse. El puerto MUST NOT depender de Nest ni de Prisma.

#### Scenario: Responde antes de escribir
- **WHEN** el caso de uso resuelve con contexto de visita y el repositorio de visitas todavía no terminó de escribir
- **THEN** `execute()` ya devolvió el resultado exitoso, idéntico al que devuelve sin contexto

#### Scenario: La visita se registra igual
- **WHEN** un cliente hace `GET /api/curated-profiles/all` y se esperan las tareas en segundo plano
- **THEN** existe un `ProfileView` nuevo de `all` y su `views` aumentó exactamente en 1

#### Scenario: Un fallo en segundo plano no se propaga
- **WHEN** el repositorio rechaza el registro de una visita
- **THEN** la respuesta pública ya fue 200, el error queda en el log con el nombre de la tarea y no hay rechazos sin manejar

#### Scenario: Todo o nada
- **WHEN** una de las dos escrituras del registro falla (por ejemplo, el perfil se borró entre la resolución y el registro)
- **THEN** no queda ningún `ProfileView` nuevo ni cambio en `views`, y el error queda en el log

### Requirement: Espera determinista de las tareas en segundo plano
El puerto de tareas SHALL ofrecer `whenIdle()`, que resuelve cuando no queda ninguna tarea en vuelo, incluidas las lanzadas mientras se esperaba. Las pruebas que cuentan visitas, o que comprueban que no se registró ninguna, MUST esperarlo antes de leer y MUST NOT usar esperas por tiempo.

#### Scenario: Esperar varias visitas
- **WHEN** se hacen tres `GET` públicos seguidos y se espera `whenIdle()`
- **THEN** las tres visitas ya están en la base

#### Scenario: Un 404 no registra, comprobado después de esperar
- **WHEN** se pide un slug inexistente y se espera `whenIdle()`
- **THEN** el número de `ProfileView` no cambió

### Requirement: El apagado ordenado no pierde visitas en vuelo
Al cerrar la aplicación, las tareas en vuelo SHALL drenarse antes de desconectar la base, con un tope de 5 s. Si el tope vence, SHALL registrarse un aviso con la cantidad de tareas pendientes y el cierre SHALL continuar.

#### Scenario: Cerrar con una visita escribiéndose
- **WHEN** se hace un `GET` público cuyo registro tarda y se cierra la aplicación sin esperar
- **THEN** el cierre termina después de la escritura y la visita está en la base

#### Scenario: Tope vencido
- **WHEN** una tarea en vuelo no termina antes del tope
- **THEN** el cierre continúa y el log tiene un aviso con la cantidad de tareas pendientes
