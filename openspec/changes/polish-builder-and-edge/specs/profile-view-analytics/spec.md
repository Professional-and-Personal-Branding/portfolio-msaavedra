# profile-view-analytics Specification (delta)

## ADDED Requirements

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
