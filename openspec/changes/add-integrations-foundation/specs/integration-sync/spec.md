## ADDED Requirements

### Requirement: Scheduler opcional por proceso
El scheduler (`@nestjs/schedule`) SHALL registrarse solo si `INTEGRATIONS_SCHEDULER_ENABLED=true` (por defecto `false`). Apagado, el proceso MUST NOT crear timers ni ejecutar trabajos; la API del panel sigue respondiendo y encolando.

#### Scenario: Apagado por defecto
- **WHEN** la API arranca sin `INTEGRATIONS_SCHEDULER_ENABLED` y hay un trabajo `PENDING`
- **THEN** el `SchedulerRegistry` no tiene jobs ni intervalos y el trabajo sigue `PENDING`

#### Scenario: Encendido
- **WHEN** la API arranca con `INTEGRATIONS_SCHEDULER_ENABLED=true` e `INTEGRATIONS_ENABLED=fake`
- **THEN** quedan registrados el cron del planificador y el intervalo del ejecutor, y el log de arranque lo dice

### Requirement: Las peticiones solo encolan
Ninguna petición HTTP SHALL ejecutar un trabajo de integración. `POST /api/admin/integrations/:provider/sync` SHALL responder 202 con el trabajo encolado, o con el ya existente y `alreadyQueued: true` si el proveedor tiene uno `PENDING`, `RUNNING` o `FAILED`.

#### Scenario: Sincronizar ahora
- **WHEN** el administrador pide sincronizar `fake` sin trabajos en cola
- **THEN** recibe 202 con `alreadyQueued: false`, existe un trabajo `PENDING` y el conector no fue llamado

#### Scenario: Doble clic
- **WHEN** lo pide dos veces seguidas
- **THEN** la segunda responde 202 con el mismo `jobId` y `alreadyQueued: true`

#### Scenario: Proveedor pausado
- **WHEN** lo pide con el proveedor pausado desde el panel
- **THEN** recibe 422 y no se encola nada

### Requirement: Planificación diaria idempotente
El planificador SHALL correr con `INTEGRATIONS_SYNC_CRON` (por defecto `0 10 * * *`, UTC) y encolar un trabajo por proveedor habilitado con la clave `sync:<proveedor>:daily:<fecha UTC>`, única en la base. Dos ejecuciones del mismo día MUST dejar un solo trabajo.

#### Scenario: Dos procesos a la vez
- **WHEN** dos instancias disparan el planificador el mismo día
- **THEN** existe un solo trabajo con esa clave

### Requirement: Un solo ejecutor a la vez
Cada corrida SHALL tomar antes un arriendo en la base (una fila con titular y vencimiento, actualizada de forma condicional) y renovarlo antes de cada trabajo; sin arriendo, el tick no hace nada. Cada trabajo SHALL reclamarse con `FOR UPDATE SKIP LOCKED`. En un mismo proceso, un tick con una corrida en curso MUST descartarse.

#### Scenario: Deploy solapado
- **WHEN** dos instancias corren el ejecutor a la vez con trabajos pendientes
- **THEN** solo una toma el arriendo y ningún trabajo se ejecuta dos veces

#### Scenario: SKIP LOCKED
- **WHEN** una transacción tiene bloqueada la fila de un trabajo y el ejecutor reclama
- **THEN** el ejecutor toma el siguiente trabajo disponible sin esperar el bloqueo

#### Scenario: Arriendo abandonado
- **WHEN** la instancia que tenía el arriendo muere sin liberarlo
- **THEN** otra instancia lo toma en el primer tick después de su vencimiento

### Requirement: Locks vencidos
Al inicio de cada corrida, un trabajo `RUNNING` con el lock vencido SHALL pasar a `FAILED` con un reintento programado, o a `DEAD` si agotó sus intentos. El intento MUST contarse al reclamar.

#### Scenario: Proceso caído a mitad de un trabajo
- **WHEN** hay un trabajo `RUNNING` con `lockedUntil` en el pasado y 1 de 8 intentos
- **THEN** la corrida siguiente lo deja `FAILED` con `lastError` «lock vencido» y un `runAt` futuro

#### Scenario: Intentos agotados
- **WHEN** el trabajo con el lock vencido ya tiene 8 de 8 intentos
- **THEN** queda `DEAD`

### Requirement: Reintentos con jitter completo
Un fallo `Transient` SHALL reprogramarse con una espera al azar entre 1 s y `min(6 h, 30 s × 2^(intento − 1))`. `RetryAfter` y `ResetAt` SHALL respetar la pista del proveedor sin tope. `Permanent`, `BudgetExhausted` y los intentos agotados MUST dejar el trabajo `DEAD`.

#### Scenario: Tope
- **WHEN** se calcula la espera del intento 12 con un azar de 0,999
- **THEN** la espera no supera 6 horas

#### Scenario: Fallo permanente
- **WHEN** el conector devuelve `Permanent`
- **THEN** el trabajo queda `DEAD`, no se reprograma y el panel muestra su error

### Requirement: Pausa por proveedor y circuit breaker
Un fallo `RetryAfter`, `ResetAt` o `BudgetExhausted` con fecha SHALL pausar el proveedor hasta esa fecha. Cinco fallos `Transient` seguidos SHALL pausarlo según la espera del quinto intento; un éxito MUST reiniciar la cuenta. Un proveedor pausado o deshabilitado MUST NOT reclamar trabajos. El estado vive en la base.

#### Scenario: Límite de un tercero
- **WHEN** un trabajo de `fake` falla con `RetryAfter` de 600 s y hay otro trabajo de `fake` vencido
- **THEN** el proveedor queda pausado 600 s y el segundo trabajo no se reclama en esa corrida

#### Scenario: Breaker
- **WHEN** fallan con `Transient` cinco trabajos seguidos de `fake`
- **THEN** el proveedor queda pausado, y cuando vence la pausa un éxito deja la cuenta en 0

### Requirement: Presupuesto de una corrida
El ejecutor SHALL procesar un trabajo a la vez, con timeout por trabajo (`INTEGRATIONS_JOB_TIMEOUT_MS`, por defecto 120 s) que aborta la señal del conector, un máximo de 20 trabajos y de `INTEGRATIONS_RUN_MAX_MS` por corrida (por defecto 300 s), y SHALL ceder el event loop entre trabajos. Nunca retiene una conexión mientras espera al tercero.

#### Scenario: Trabajo colgado
- **WHEN** el conector no responde dentro del timeout
- **THEN** la señal se aborta, el trabajo queda `FAILED` con `SyncRun.outcome` `TIMEOUT` y la corrida sigue con el siguiente

#### Scenario: Conector que ignora la señal
- **WHEN** el conector `fake` en el escenario `ignore-abort` supera el timeout
- **THEN** el ejecutor cierra el trabajo igual y no queda esperando su promesa

#### Scenario: Tope de la corrida
- **WHEN** vence `INTEGRATIONS_RUN_MAX_MS` con trabajos pendientes
- **THEN** no se reclaman más trabajos y el arriendo se libera

### Requirement: Las peticiones no se demoran durante un trabajo
Mientras corre un trabajo lento, las peticiones HTTP MUST seguir respondiendo sin demora apreciable: el tick no espera la corrida y el trabajo solo hace I/O asíncrono. Un e2e SHALL medirlo con la latencia de `GET /health/live` y el retraso del event loop.

#### Scenario: Trabajo lento simulado
- **WHEN** corre el escenario `slow` del conector `fake` (3 s con 5 ms de trabajo sincrónico cada 100 ms) y se hacen 40 `GET /health/live`
- **THEN** el p95 no supera la línea de base sin trabajo más 25 ms, el máximo no supera 150 ms y el p99 del retraso del event loop no supera 50 ms

#### Scenario: El tick no espera
- **WHEN** el intervalo del ejecutor dispara con una corrida que tarda 2 s
- **THEN** el callback vuelve en menos de 5 ms y un segundo tick no lanza otra corrida

### Requirement: Apagado dentro del drenaje
Al apagar, el proceso SHALL detener el scheduler, dejar de reclamar, abortar el trabajo en curso y, si no termina en 3 s, devolverlo a `PENDING` sin consumir el intento, con `SyncRun.outcome` `INTERRUPTED`, y liberar el arriendo antes de desconectar la base.

#### Scenario: Deploy durante un trabajo
- **WHEN** se cierra la aplicación con un trabajo `slow` en curso
- **THEN** el cierre termina en menos de 5 s, el trabajo queda `PENDING` con los intentos que tenía antes de reclamarlo, el arriendo queda libre y no hay errores de conexión cerrada en el log

### Requirement: Registro de cada intento
Cada intento SHALL dejar una fila `SyncRun` con proveedor, trabajo, inicio, fin, duración, resultado (`SUCCESS`, `FAILED`, `DEAD`, `INTERRUPTED` o `TIMEOUT`), clase y mensaje de error redactado, y la cantidad de ítems cambiados.

#### Scenario: Corrida exitosa
- **WHEN** el conector `fake` termina con éxito
- **THEN** existe una `SyncRun` `SUCCESS` con `durationMs`, el trabajo queda `DONE` y `IntegrationSetting.lastSuccessAt` se actualiza

### Requirement: Aviso de sincronización atrasada
Un proveedor habilitado SHALL marcarse como atrasado si su última corrida exitosa tiene más de 48 h, o si nunca tuvo una y está habilitado desde hace más de 48 h. La API lo informa como `stale: true` y el planificador emite un aviso en el log. Un proveedor pausado a mano no se marca.

#### Scenario: Más de 48 h
- **WHEN** la última corrida exitosa de `fake` fue hace 49 h
- **THEN** `GET /api/admin/integrations` devuelve `stale: true` para `fake`

#### Scenario: Pausado a mano
- **WHEN** `fake` está pausado desde el panel y no corre hace 72 h
- **THEN** devuelve `stale: false`

### Requirement: API de estado de las integraciones
`/api/admin/integrations` SHALL exigir sesión de administrador y responder `no-store`. `GET` devuelve si el scheduler está encendido y, por proveedor habilitado, estado, pausa, atraso, última corrida, última exitosa, conteos por estado, último error `DEAD` y origen de la credencial. `PATCH /:provider` cambia `enabled`. Un proveedor no habilitado da 404.

#### Scenario: Sin sesión
- **WHEN** se pide `GET /api/admin/integrations` sin sesión
- **THEN** responde 401

#### Scenario: Pausar
- **WHEN** el administrador hace `PATCH /api/admin/integrations/fake` con `{ "enabled": false }`
- **THEN** responde 200 con `enabled: false` y el planificador deja de encolar `fake`

#### Scenario: Proveedor no habilitado
- **WHEN** pide `POST /api/admin/integrations/github/sync` sin `github` en `INTEGRATIONS_ENABLED`
- **THEN** responde 404

### Requirement: Corrida manual por línea de comandos
`npm run integrations:sync` SHALL ejecutar una corrida con el mismo arriendo, sin abrir el puerto HTTP, y terminar. Con `--provider <id>` encola antes un trabajo manual. Sale con 0 si la corrida terminó, 1 si algún trabajo quedó `DEAD` en ella y 2 si la configuración es inválida o el arriendo lo tiene otra instancia.

#### Scenario: Corrida limpia
- **WHEN** se corre `integrations:sync -- --provider fake` con el escenario por defecto
- **THEN** el trabajo queda `DONE` y el comando sale con 0

#### Scenario: Arriendo ocupado
- **WHEN** otra instancia tiene el arriendo vigente
- **THEN** el comando no ejecuta trabajos y sale con 2

### Requirement: Retención de la cola
El planificador SHALL borrar los trabajos `DONE` terminados hace más de 30 días, con sus corridas, y las `SyncRun` de más de 90 días. Los trabajos `DEAD` se conservan 90 días.

#### Scenario: Limpieza
- **WHEN** corre el planificador con un trabajo `DONE` de hace 31 días y uno `DEAD` de hace 31 días
- **THEN** se borra el primero con sus corridas y se conserva el segundo
