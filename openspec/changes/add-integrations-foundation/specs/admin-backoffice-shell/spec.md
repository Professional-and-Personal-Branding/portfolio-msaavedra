## ADDED Requirements

### Requirement: Pantalla Integraciones
`/admin/integraciones` SHALL requerir sesión, MUST NOT sumar un ítem a la barra del panel y se SHALL alcanzar desde Cuenta y desde un aviso del Dashboard. Muestra por proveedor su estado (por texto), la última corrida, la cola y el último error; **Sincronizar ahora** encola, **Pausar** y **Reanudar** cambian `enabled`, y la credencial se escribe sin mostrarse nunca.

#### Scenario: Sincronizar ahora
- **WHEN** se pulsa **Sincronizar ahora** en `fake`
- **THEN** aparece «Encolado: corre en el próximo minuto.» y la cola muestra 1 pendiente

#### Scenario: Ya en cola
- **WHEN** se vuelve a pulsar con el trabajo pendiente
- **THEN** aparece «Ya había una sincronización en cola.»

#### Scenario: Atrasado
- **WHEN** la API devuelve `stale: true` para `fake`
- **THEN** la tarjeta muestra «Sin sincronizar hace más de 48 h»

#### Scenario: Credencial
- **WHEN** se guarda una credencial y se recarga la página
- **THEN** el campo está vacío, la tarjeta dice que la credencial está guardada en la base y el valor no figura en el DOM

#### Scenario: Credencial vacía
- **WHEN** se pulsa **Guardar** con el campo vacío
- **THEN** aparece «Ingresá la credencial.» y no se llama a la API

#### Scenario: Sin proveedores
- **WHEN** la API devuelve `providers` vacío
- **THEN** se muestra «No hay integraciones habilitadas. Se activan con la variable `INTEGRATIONS_ENABLED` del servidor.»

#### Scenario: Scheduler apagado
- **WHEN** la API devuelve `schedulerEnabled: false`
- **THEN** se muestra «El scheduler está apagado en este servidor: lo que encoles queda en espera.»

#### Scenario: Acceso desde Cuenta
- **WHEN** se abre la pantalla Cuenta
- **THEN** hay un bloque «Integraciones» con un enlace «Integraciones» que lleva a `/admin/integraciones`, y la barra de navegación del panel no tiene un ítem Integraciones

#### Scenario: Aviso en el Dashboard
- **WHEN** la API devuelve algún proveedor con `stale: true` o con trabajos `dead` mayores que 0
- **THEN** el Dashboard muestra «Hay integraciones que requieren atención» con un enlace a `/admin/integraciones`

#### Scenario: Dashboard sin avisos
- **WHEN** ningún proveedor está atrasado ni tiene trabajos muertos, o no hay proveedores
- **THEN** el Dashboard no muestra el aviso
