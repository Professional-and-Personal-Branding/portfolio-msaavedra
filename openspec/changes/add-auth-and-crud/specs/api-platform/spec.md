## MODIFIED Requirements

### Requirement: Configuración por variables de entorno validada al arranque
La API SHALL leer su configuración desde variables de entorno (`DATABASE_URL`, `PORT`, `NODE_ENV`, `FRONTEND_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `ANALYTICS_SALT`) y MUST fallar al arrancar, con un mensaje que identifique la variable, si falta una obligatoria o es inválida. `PORT` SHALL tener valor por defecto 3000. `JWT_SECRET` es obligatoria y MUST tener al menos 16 caracteres. `JWT_EXPIRES_IN` SHALL aceptar segundos o notación `1d`/`12h`/`30m` (default `1d`). `ANALYTICS_SALT` es opcional y SHALL usar `JWT_SECRET` como valor por defecto.

#### Scenario: Falta DATABASE_URL
- **WHEN** la API arranca sin `DATABASE_URL` definida
- **THEN** el proceso termina con código distinto de 0 y el error menciona `DATABASE_URL`

#### Scenario: Puerto configurable
- **WHEN** la API arranca con `PORT=3300`
- **THEN** acepta conexiones en el puerto 3300

#### Scenario: JWT_SECRET ausente o corta
- **WHEN** la API arranca sin `JWT_SECRET` o con una de 8 caracteres
- **THEN** el proceso termina con código distinto de 0 y el error menciona `JWT_SECRET`

### Requirement: Errores en formato JSON consistente
Toda respuesta de error SHALL ser JSON con los campos `statusCode` (número), `message` (texto o lista de textos en errores de validación) y `error` (texto corto). Las respuestas de error MUST NOT incluir stack traces ni detalles internos de la base de datos. Los errores de validación de entrada SHALL usar 400 (`Bad Request`), los conflictos de unicidad 409 (`Conflict`), la falta de credenciales 401 (`Unauthorized`) y los recursos inexistentes 404 (`Not Found`).

#### Scenario: Recurso inexistente
- **WHEN** un cliente pide `GET /api/experiences/no-existe`
- **THEN** recibe 404 con `{ "statusCode": 404, "message": <texto>, "error": "Not Found" }` y sin campo `stack`

#### Scenario: Validación de entrada
- **WHEN** el administrador envía un cuerpo inválido a `POST /api/admin/experiences`
- **THEN** recibe 400 con `error: "Bad Request"` y `message` con los mensajes de validación

#### Scenario: Conflicto de unicidad
- **WHEN** crea un perfil curado con un `slug` existente
- **THEN** recibe 409 con `error: "Conflict"`

### Requirement: CORS restringido al origen del frontend
La API SHALL permitir peticiones cross-origin únicamente desde el origen configurado en `FRONTEND_URL`, con los métodos `GET, HEAD, POST, PATCH, DELETE, OPTIONS` y los headers `Content-Type, Accept, Accept-Language, Authorization, X-Access-Token`.

#### Scenario: Origen permitido
- **WHEN** una petición llega con header `Origin` igual a `FRONTEND_URL`
- **THEN** la respuesta incluye `Access-Control-Allow-Origin` con ese origen

#### Scenario: Origen no permitido
- **WHEN** una petición llega con un `Origin` distinto a `FRONTEND_URL`
- **THEN** la respuesta no incluye `Access-Control-Allow-Origin` para ese origen

#### Scenario: Preflight de escritura
- **WHEN** llega un `OPTIONS /api/admin/experiences` con `Origin` = `FRONTEND_URL`, `Access-Control-Request-Method: POST` y `Access-Control-Request-Headers: authorization, content-type`
- **THEN** la respuesta permite el método `POST` y el header `Authorization`
