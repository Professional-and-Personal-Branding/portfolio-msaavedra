## ADDED Requirements

### Requirement: Pantalla Integraciones
`/admin/integraciones` SHALL requerir sesión, figurar como **Integraciones** en la navegación y mostrar por proveedor su estado (por texto, no solo color), la última corrida, la última exitosa, la cola y el último error. **Sincronizar ahora** encola; **Pausar** y **Reanudar** cambian `enabled`; la credencial se escribe sin mostrarse nunca. Avisa si el scheduler está apagado.

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
