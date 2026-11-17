## ADDED Requirements

### Requirement: Bloque Inteligencia artificial en Integraciones
`/admin/integraciones` SHALL mostrar al final un bloque «Inteligencia artificial» de solo lectura, sin sumar un ítem a la barra: estado por texto, gasto del mes contra el tope, reservado, bloqueo del proveedor, fecha de verificación de precios y las 20 corridas recientes. **Probar conexión** SHALL pedir confirmación indicando si la llamada es real o de prueba.

#### Scenario: IA apagada
- **WHEN** la API devuelve `state: "DISABLED"`
- **THEN** el bloque dice «La IA está apagada. Se enciende con la variable `AI_ENABLED` del servidor.» y no muestra **Probar conexión**

#### Scenario: Gasto del mes
- **WHEN** la API devuelve gastado 1,23 USD con tope 10 en noviembre de 2026
- **THEN** el bloque dice «Gastado 1,23 de 10,00 USD en noviembre de 2026 (12 %)»

#### Scenario: Probar conexión con el proveedor de prueba
- **WHEN** con `provider: "fake"` se pulsa **Probar conexión** y se confirma
- **THEN** la confirmación decía «Proveedor de prueba: no llama a Anthropic.» y la tabla suma una corrida `ai.smoke` exitosa

#### Scenario: Tope alcanzado
- **WHEN** la API devuelve `state: "EXHAUSTED"`
- **THEN** el bloque dice «Se alcanzó el tope de IA del mes» y **Probar conexión** está deshabilitado

#### Scenario: Barra sin cambios
- **WHEN** se abre cualquier pantalla del panel
- **THEN** la barra de navegación no tiene un ítem de IA

### Requirement: Aviso de IA en el Dashboard
El Dashboard SHALL mostrar «La IA alcanzó el tope del mes» con un enlace a `/admin/integraciones` cuando el estado de la IA es `EXHAUSTED` o `PROVIDER_BLOCKED`, y MUST NOT mostrarlo en otro caso ni si la consulta falla.

#### Scenario: Bloqueo del proveedor
- **WHEN** la API devuelve `state: "PROVIDER_BLOCKED"`
- **THEN** el Dashboard muestra el aviso con el enlace

#### Scenario: Sin aviso
- **WHEN** la API devuelve `state: "OK"` o `DISABLED`, o la consulta falla
- **THEN** el Dashboard no muestra el aviso
