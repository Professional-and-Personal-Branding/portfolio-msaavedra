## ADDED Requirements

### Requirement: IA apagada por defecto
Con `AI_ENABLED` ausente o `false` el sistema MUST NOT construir el cliente de Anthropic ni hacer llamadas a ningún proveedor de IA, y el resto de la API SHALL comportarse igual que sin el módulo `ai`. La consulta de uso SHALL responder igual, con estado `DISABLED`.

#### Scenario: Sin variables de IA
- **WHEN** la API arranca sin ninguna variable `AI_*`
- **THEN** arranca, la factory del cliente de Anthropic no se invoca y `GET /api/admin/ai/usage` devuelve `state: "DISABLED"`

#### Scenario: Humo con la IA apagada
- **WHEN** se pide `POST /api/admin/ai/smoke` con `AI_ENABLED=false`
- **THEN** responde 422 con «La IA está apagada en este servidor» y no se crea ningún `AiRun`

### Requirement: Un único puerto hacia el modelo
Toda llamada a un modelo SHALL pasar por `LlmPort`. El paquete `@anthropic-ai/sdk` MUST importarse solo en `modules/ai/infrastructure/anthropic/`, y el puerto MUST NOT exponer tipos del SDK, `temperature`, `top_p`, `top_k`, prefill ni `tool_choice` forzado.

#### Scenario: SDK confinado
- **WHEN** corre el test de arquitectura
- **THEN** ningún archivo fuera de `modules/ai/infrastructure/anthropic/` importa `@anthropic-ai/sdk`

#### Scenario: Petición sin parámetros de muestreo
- **WHEN** el adaptador arma la petición de cualquier tarea registrada
- **THEN** el cuerpo no contiene `temperature`, `top_p`, `top_k` ni un `tool_choice` `any` o `tool`, y el último mensaje es del usuario

### Requirement: Modelo y parámetros declarados por tarea
Cada tarea SHALL declarar en código su modelo, effort, thinking, `max_tokens`, versión de prompt y schema de salida. Solo `claude-haiku-5-5` y `claude-sonnet-5-5` SHALL estar permitidos, y el modelo MUST NOT cambiarse por variable de entorno. Thinking apagado SHALL mandarse como `disabled` en Haiku y `between_tools` en Sonnet, con effort `high` o menor.

#### Scenario: Modelo fuera del registro
- **WHEN** una definición de tarea usa `claude-opus-5-5`
- **THEN** el test del registro de tareas falla

#### Scenario: Thinking apagado en Sonnet
- **WHEN** una tarea de Sonnet 5.5 declara thinking apagado
- **THEN** la petición lleva `thinking: {type: "between_tools"}` sin otros campos y un effort explícito de `high` o menor

### Requirement: Salida estructurada validada en código
La salida de toda tarea SHALL pedirse con `output_config.format` y validarse contra el schema de la tarea antes de devolverse. Una salida que no valida MUST terminar la corrida como `InvalidOutput`, sin devolver datos parciales.

#### Scenario: Salida inválida
- **WHEN** el proveedor responde un JSON que no cumple el schema de la tarea
- **THEN** la corrida queda `FAILED` con `failureKind: "InvalidOutput"`, su costo se imputa y el llamador no recibe `output`

### Requirement: Rechazo y truncado antes de leer el contenido
El adaptador SHALL revisar `stop_reason` antes de leer el contenido: `refusal` MUST dar `Refused` con su categoría y `max_tokens` MUST dar `Truncated`. En ambos casos el uso informado SHALL imputarse al presupuesto. El fallback del servidor ante un rechazo MUST NOT usarse.

#### Scenario: Rechazo
- **WHEN** el proveedor responde con `stop_reason: "refusal"`
- **THEN** el `AiRun` queda `REFUSED` con la categoría de `stop_details`, el costo de su `usage` y sin `output`

#### Scenario: Truncado
- **WHEN** el proveedor responde con `stop_reason: "max_tokens"`
- **THEN** el `AiRun` queda `FAILED` con `failureKind: "Truncated"` y el costo se imputa

### Requirement: Registro de cada corrida
Cada intento de tarea SHALL dejar un `AiRun` con tarea, versión de prompt, modelo, hash de la entrada, estado, reserva y costo real en micro-USD, tokens de entrada, salida, lectura y escritura de caché, `stop_reason`, duración e id de la petición. La entrada en crudo MUST NOT guardarse; solo la salida validada.

#### Scenario: Corrida exitosa
- **WHEN** la tarea de humo termina bien con el proveedor `fake`
- **THEN** hay un `AiRun` `SUCCEEDED` con los tokens del `usage`, `costMicroUsd` calculado con la tabla de precios y `inputHash`, sin la entrada en crudo

### Requirement: Tope mensual con reserva previa
Antes de cada llamada facturable el sistema SHALL reservar el peor caso (entrada contada con margen más `max_tokens` a precio de salida) en el contador del mes UTC con una operación atómica. Si gasto más reservas más la nueva reserva superan `AI_MONTHLY_BUDGET_USD`, la llamada MUST NOT hacerse.

#### Scenario: Reserva que pasaría el tope
- **WHEN** el gasto del mes es 9,95 USD con tope 10 y la reserva calculada es 0,10 USD
- **THEN** la corrida queda `BLOCKED`, el adaptador no recibe la llamada y la respuesta dice «Se alcanzó el tope de IA del mes»

#### Scenario: Tope cero
- **WHEN** `AI_MONTHLY_BUDGET_USD=0` con la IA encendida y se pide el humo
- **THEN** responde 422 sin llamar al adaptador y el estado es `EXHAUSTED`

### Requirement: Conciliación con el uso real
Al terminar una llamada con `usage`, el sistema SHALL liberar la reserva y sumar el costo real calculado con los precios versionados. Un fallo sin respuesta SHALL liberar la reserva sin costo; un timeout o aborto después de enviar SHALL imputar la reserva entera.

#### Scenario: Costo menor que la reserva
- **WHEN** una corrida reservó 0,0002 USD y su `usage` vale 0,00005 USD
- **THEN** el reservado del mes baja 0,0002 y el gastado sube 0,00005

#### Scenario: Timeout
- **WHEN** la llamada supera `AI_REQUEST_TIMEOUT_MS`
- **THEN** el `AiRun` queda `FAILED` con `Transient` y su reserva entera pasa a gastado

### Requirement: Sin pasarse con llamadas concurrentes
La reserva SHALL ser una única sentencia condicional sobre la fila del mes, de modo que reservas simultáneas, incluso desde dos instancias, MUST NOT sumar más que el tope.

#### Scenario: Veinte reservas a la vez
- **WHEN** se lanzan 20 reservas concurrentes contra Postgres con un tope que admite 7
- **THEN** exactamente 7 se conceden y gastado más reservado nunca supera el tope

### Requirement: Reservas huérfanas
Toda reserva SHALL llevar un vencimiento igual al timeout más 60 segundos. Antes de reservar, las corridas `RESERVED` vencidas del mes SHALL pasar a `ABANDONED` imputando su reserva entera como gasto.

#### Scenario: Proceso caído
- **WHEN** hay un `AiRun` `RESERVED` con el vencimiento pasado y se pide una corrida nueva
- **THEN** el viejo queda `ABANDONED`, su reserva pasa a gastado y recién después se evalúa la nueva reserva

### Requirement: Caché por hash
Antes de reservar, el sistema SHALL buscar un `AiRun` exitoso con la misma clave (tarea, versión y hash del prompt, modelo, effort, thinking, `max_tokens`, schema y entrada canónica). Si existe, SHALL devolver su salida, registrar un `AiRun` `CACHED` con costo 0 y MUST NOT llamar al proveedor.

#### Scenario: Misma entrada dos veces
- **WHEN** la misma tarea corre dos veces con la misma entrada
- **THEN** el adaptador recibe una sola llamada y la segunda corrida queda `CACHED` con costo 0

#### Scenario: Regenerar
- **WHEN** se pide la misma corrida con `bypassCache`
- **THEN** se reserva y se llama al proveedor otra vez

### Requirement: Prompts versionados en el repositorio
Cada prompt SHALL vivir en `backend/src/modules/ai/prompts/<tarea>/v<n>.md` y su tarea SHALL registrar la versión y el SHA-256 del archivo. Editar un prompt sin registrar una versión nueva MUST hacer fallar los tests.

#### Scenario: Prompt editado sin versión
- **WHEN** cambia el texto de `prompts/ai.smoke/v1.md` y el registro sigue con su hash anterior
- **THEN** el test de prompts falla nombrando la tarea

### Requirement: Frontera de datos
Solo datos del CV y de vacantes SHALL poder salir hacia el proveedor, armados con lista blanca. Un guardián SHALL bloquear, antes de la caché y de la reserva, claves y valores prohibidos (email del perfil, credenciales, tokens, `ipHash`, sal, hashes, cookies, datos de visitas y los secretos de la configuración). Un bloqueo MUST NOT enviar nada.

#### Scenario: Email del perfil en el payload
- **WHEN** una tarea arma un payload que incluye el email del perfil
- **THEN** la corrida queda `BLOCKED` con `ForbiddenData`, sin costo y sin llamada al adaptador

#### Scenario: Lista negra sobre los datos de ejemplo
- **WHEN** corre el test de lista negra con cada tarea registrada sobre `docs/examples/cv-data.example.json`
- **THEN** ningún payload contiene el email del perfil ni un valor con forma de token, IP o JWT

### Requirement: Redacción del texto libre
En los campos marcados como texto libre (como el texto pegado de una vacante), emails y teléfonos SHALL reemplazarse por `[email]` y `[teléfono]` antes de enviarse; credenciales y secretos MUST seguir bloqueando la corrida.

#### Scenario: Vacante con email de contacto
- **WHEN** el texto libre contiene `jobs@empresa.example`
- **THEN** el proveedor recibe `[email]` en su lugar y la corrida sigue

### Requirement: Corte por el spend limit del proveedor
Un `BudgetExhausted` del proveedor SHALL bloquear nuevas llamadas del mes: hasta su fecha de reinicio si la trae (día 1 a las 00:00 UTC para el tope del tier) o durante una hora si no. Mientras dure, las reservas MUST rechazarse sin llamar al proveedor.

#### Scenario: Tope del tier
- **WHEN** el proveedor responde 429 con `enforced_spend_limit_reached` el 15 de marzo
- **THEN** el mes queda bloqueado hasta el 1 de abril a las 00:00 UTC y el humo siguiente no llama al adaptador

#### Scenario: Spend limit de la Console
- **WHEN** el proveedor responde 400 con un mensaje que empieza por «You have reached your specified API usage limits»
- **THEN** el `AiRun` queda `FAILED` con `BudgetExhausted` y el mes queda bloqueado una hora

### Requirement: Sin reintentos automáticos de la llamada facturable
La llamada que genera la respuesta MUST hacerse una sola vez por corrida, sin los reintentos automáticos del SDK; un fallo transitorio SHALL volver al llamador. El conteo de tokens, que es gratis, SHALL poder reintentarse.

#### Scenario: 529 del proveedor
- **WHEN** el proveedor responde 529 a la llamada facturable
- **THEN** el adaptador hizo una sola petición y el `AiRun` queda `FAILED` con `Transient`

### Requirement: Timeouts y concurrencia acotada
Cada llamada SHALL tener el timeout `AI_REQUEST_TIMEOUT_MS` y abortarse si se cierra la petición del panel. Un semáforo por proceso SHALL limitar las llamadas simultáneas a `AI_MAX_CONCURRENCY`; sin lugar en 2 segundos, la petición MUST responder 503 sin encolarse.

#### Scenario: Ocupado
- **WHEN** hay 2 llamadas en curso con `AI_MAX_CONCURRENCY=2` y llega una tercera
- **THEN** responde 503 con `retry-after` antes de 3 segundos y no se reserva presupuesto

### Requirement: La ruta pública no depende de la IA
Ninguna ruta pública, el render del head ni la resolución de perfiles SHALL importar el módulo `ai` ni esperar una llamada de IA.

#### Scenario: Llamada lenta en curso
- **WHEN** una llamada de humo espera con el escenario `slow` y se pide `GET /api/curated-profiles/all`
- **THEN** el perfil responde en menos de 500 ms

#### Scenario: Arquitectura
- **WHEN** corre el test de arquitectura
- **THEN** `curated-profile`, `profile`, `experience`, `skill`, `analytics` y `featured-repository` no importan `modules/ai`

### Requirement: Humano en el bucle
Una salida de IA MUST NOT escribirse sola en ningún agregado: el runner SHALL devolverla como propuesta y solo una acción explícita del owner, por los casos de uso existentes, la aplica. Las cifras SHALL calcularlas el código. El módulo `ai` solo escribe `AiRun` y `AiBudgetMonth`.

#### Scenario: Escrituras del módulo
- **WHEN** corre el test de arquitectura
- **THEN** las únicas escrituras de Prisma dentro de `modules/ai` son sobre `aiRun` y `aiBudgetMonth`

### Requirement: API de uso de la IA
`GET /api/admin/ai/usage` SHALL requerir sesión y devolver habilitación, proveedor, mes, tope, gastado, reservado, restante, estado (`DISABLED`, `OK`, `NEAR_LIMIT` desde el 80 %, `EXHAUSTED`, `PROVIDER_BLOCKED`), bloqueo del proveedor, fecha de verificación de precios y las 20 corridas más recientes, sin entradas ni salidas.

#### Scenario: Sin sesión
- **WHEN** se pide sin cookie ni Bearer
- **THEN** responde 401

#### Scenario: Cerca del tope
- **WHEN** el gasto del mes es 8,10 USD con tope 10
- **THEN** devuelve `state: "NEAR_LIMIT"` y `remainingUsd: 1.9`

### Requirement: Tarea interna de humo
`POST /api/admin/ai/smoke` SHALL requerir sesión, mandar un texto fijo sin datos del usuario con Haiku 5.5, validar `{ "estado": "ok" }` y devolver el `AiRun`. SHALL ignorar la caché (prueba la conexión de verdad) y tener un límite de 5 peticiones por minuto.

#### Scenario: Humo con el proveedor fake
- **WHEN** se pide con `AI_PROVIDER=fake` y presupuesto disponible
- **THEN** responde 201 con un `AiRun` `SUCCEEDED` del modelo `claude-haiku-5-5`

#### Scenario: Humo repetido
- **WHEN** se pide dos veces seguidas
- **THEN** el adaptador recibe dos llamadas y ninguna corrida queda `CACHED`

### Requirement: Evals con cassettes en el CI
Cada tarea SHALL tener casos de eval con datos ficticios y cassettes versionados que corren dentro de `npm test` sin red, sin clave y sin base, con validadores sobre la salida estructurada y un umbral de tasa por tarea. Un cassette faltante o de otra versión de prompt MUST hacer fallar el test.

#### Scenario: CI sin clave
- **WHEN** corre `npm test` sin `ANTHROPIC_API_KEY` ni red
- **THEN** las evals de la tarea de humo pasan con sus tres cassettes (válido, `refusal` y `max_tokens`)

#### Scenario: Cassette viejo
- **WHEN** el `promptSha256` de un cassette no coincide con el del prompt registrado
- **THEN** el test falla pidiendo regrabarlo

### Requirement: Evals en vivo a demanda
`npm run ai:eval` SHALL correr los casos contra la API real con un presupuesto en memoria, sin tocar la base, usando la clave del workspace de evals (`AI_EVAL_API_KEY`, distinta de `ANTHROPIC_API_KEY`). MUST negarse con código 2, sin ninguna llamada facturable, si falta esa clave, si falta `AI_EVAL_ALLOW_SPEND=1` o si la suma de reservas supera el tope de la corrida (2 USD por defecto). Informa tasas y costo.

#### Scenario: Solo la clave de la app
- **WHEN** se corre con `ANTHROPIC_API_KEY` pero sin `AI_EVAL_API_KEY`
- **THEN** sale con código 2 y no hace ninguna petición

#### Scenario: Sin permiso de gasto
- **WHEN** se corre con `AI_EVAL_API_KEY` pero sin `AI_EVAL_ALLOW_SPEND=1`
- **THEN** sale con código 2 y no hace ninguna petición

#### Scenario: Tope insuficiente
- **WHEN** las reservas de los casos suman 3 USD y el tope es 2
- **THEN** sale con código 2 antes de llamar y lo informa

### Requirement: Cassettes sin secretos
La grabación de cassettes SHALL redactar con `redactSecrets` la clave y los patrones de token, no SHALL guardar cabeceras ni la clave, y MUST negarse a escribir si después de redactar queda un `sk-ant-`, la clave exacta o un email fuera del dominio ficticio del ejemplo.

#### Scenario: Escaneo de fixtures
- **WHEN** corre el escaneo de `backend/test/fixtures`
- **THEN** ningún cassette contiene `sk-ant-` seguido de 20 o más caracteres

### Requirement: Precios versionados
El costo SHALL calcularse con una tabla de precios en el código, con su fecha de verificación y su fuente, que el panel muestra. Para Haiku 5.5 SHALL elegirse la tarifa según la entrada total supere o no 100 000 tokens.

#### Scenario: Tabla vigente
- **WHEN** corre el test de precios
- **THEN** Haiku 5.5 vale 0,10 / 0,50 USD por millón (0,125 escritura y 0,01 lectura de caché), Sonnet 5.5 2 / 10 (2,50 y 0,10) y la fecha de verificación es 2026-11-17
