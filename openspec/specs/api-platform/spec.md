# api-platform Specification

## Purpose
Define el comportamiento base de la API HTTP del portafolio: cómo arranca, bajo qué prefijo expone sus rutas, cómo se configura, cómo responde ante errores y cómo publica su contrato OpenAPI para consumidores humanos y herramientas.

## Requirements

### Requirement: Rutas bajo el prefijo /api
Todas las rutas HTTP de la API SHALL exponerse bajo el prefijo `/api`. Una ruta sin prefijo MUST responder 404.

#### Scenario: Ruta con prefijo responde
- **WHEN** un cliente hace `GET /api/profile`
- **THEN** la API responde con código 200 y cuerpo JSON

#### Scenario: Ruta sin prefijo no existe
- **WHEN** un cliente hace `GET /profile`
- **THEN** la API responde 404 con cuerpo JSON

### Requirement: Configuración por variables de entorno validada al arranque
La API SHALL leer su configuración desde variables de entorno (`DATABASE_URL`, `PORT`, `NODE_ENV`, `FRONTEND_URL`) y MUST fallar al arrancar, con un mensaje que identifique la variable, si falta una obligatoria. `PORT` SHALL tener valor por defecto 3000.

#### Scenario: Falta DATABASE_URL
- **WHEN** la API arranca sin `DATABASE_URL` definida
- **THEN** el proceso termina con código distinto de 0 y el error menciona `DATABASE_URL`

#### Scenario: Puerto configurable
- **WHEN** la API arranca con `PORT=3300`
- **THEN** acepta conexiones en el puerto 3300

### Requirement: Conexión a la base verificada al arranque
La API SHALL establecer la conexión a PostgreSQL durante el arranque. Si la base no es alcanzable, el arranque MUST fallar con código distinto de 0 en lugar de quedar escuchando sin datos.

#### Scenario: Base disponible
- **WHEN** PostgreSQL (docker compose) está arriba y la API arranca
- **THEN** el log indica conexión establecida y la API queda escuchando

#### Scenario: Base no disponible
- **WHEN** PostgreSQL no está alcanzable y la API arranca
- **THEN** el proceso termina con código distinto de 0 y el error describe el fallo de conexión

### Requirement: Errores en formato JSON consistente
Toda respuesta de error SHALL ser JSON con los campos `statusCode` (número), `message` (texto) y `error` (texto corto). Las respuestas de error MUST NOT incluir stack traces ni detalles internos de la base de datos.

#### Scenario: Recurso inexistente
- **WHEN** un cliente pide `GET /api/experiences/no-existe`
- **THEN** recibe 404 con `{ "statusCode": 404, "message": <texto>, "error": "Not Found" }` y sin campo `stack`

### Requirement: CORS restringido al origen del frontend
La API SHALL permitir peticiones cross-origin únicamente desde el origen configurado en `FRONTEND_URL`.

#### Scenario: Origen permitido
- **WHEN** una petición llega con header `Origin` igual a `FRONTEND_URL`
- **THEN** la respuesta incluye `Access-Control-Allow-Origin` con ese origen

#### Scenario: Origen no permitido
- **WHEN** una petición llega con un `Origin` distinto a `FRONTEND_URL`
- **THEN** la respuesta no incluye `Access-Control-Allow-Origin` para ese origen

### Requirement: Documentación OpenAPI publicada
La API SHALL publicar su documentación interactiva en `GET /api/docs` y el documento OpenAPI en `GET /api/docs-json`. El documento MUST incluir todas las rutas públicas y documentar el parámetro de idioma.

#### Scenario: UI de documentación accesible
- **WHEN** un cliente hace `GET /api/docs`
- **THEN** recibe 200 con contenido HTML

#### Scenario: Contrato OpenAPI completo
- **WHEN** un cliente hace `GET /api/docs-json`
- **THEN** recibe JSON cuyo `paths` contiene `/api/profile`, `/api/experiences` y `/api/experiences/{id}`, y cada una declara el query param `locale` con valores `es` y `en`
