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
La API SHALL leer su configuración desde variables de entorno (`DATABASE_URL`, `PORT`, `NODE_ENV`, `FRONTEND_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `ANALYTICS_SALT`) y MUST fallar al arrancar, con un mensaje que identifique la variable, si falta una obligatoria o es inválida. `PORT` SHALL tener valor por defecto 3000.

#### Scenario: Falta DATABASE_URL
- **WHEN** la API arranca sin `DATABASE_URL` definida
- **THEN** el proceso termina con código distinto de 0 y el error menciona `DATABASE_URL`

#### Scenario: Puerto configurable
- **WHEN** la API arranca con `PORT=3300`
- **THEN** acepta conexiones en el puerto 3300

### Requirement: Reglas de las variables de sesión y analítica
`JWT_SECRET` es obligatoria y MUST tener al menos 16 caracteres. `JWT_EXPIRES_IN` SHALL aceptar segundos o notación `1d`/`12h`/`30m` (default `1d`). `ANALYTICS_SALT` es opcional y SHALL usar `JWT_SECRET` como valor por defecto.

#### Scenario: JWT_SECRET ausente o corta
- **WHEN** la API arranca sin `JWT_SECRET` o con una de 8 caracteres
- **THEN** el proceso termina con código distinto de 0 y el error menciona `JWT_SECRET`

### Requirement: Conexión a la base verificada al arranque
La API SHALL establecer la conexión a PostgreSQL durante el arranque. Si la base no es alcanzable, el arranque MUST fallar con código distinto de 0 en lugar de quedar escuchando sin datos.

#### Scenario: Base disponible
- **WHEN** PostgreSQL (docker compose) está arriba y la API arranca
- **THEN** el log indica conexión establecida y la API queda escuchando

#### Scenario: Base no disponible
- **WHEN** PostgreSQL no está alcanzable y la API arranca
- **THEN** el proceso termina con código distinto de 0 y el error describe el fallo de conexión

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

### Requirement: Documentación OpenAPI publicada
La API SHALL publicar su documentación interactiva en `GET /api/docs` y el documento OpenAPI en `GET /api/docs-json`. El documento MUST incluir todas las rutas públicas y documentar el parámetro de idioma.

#### Scenario: UI de documentación accesible
- **WHEN** un cliente hace `GET /api/docs`
- **THEN** recibe 200 con contenido HTML

#### Scenario: Contrato OpenAPI completo
- **WHEN** un cliente hace `GET /api/docs-json`
- **THEN** recibe JSON cuyo `paths` contiene `/api/profile`, `/api/experiences` y `/api/experiences/{id}`, y cada una declara el query param `locale` con valores `es` y `en`

### Requirement: Manejo global de errores
La API SHALL registrar un filtro de excepciones global que convierta **cualquier** error no controlado en una respuesta JSON con `statusCode`, `message`, `error`, `requestId` y `timestamp`. La respuesta MUST NOT contener stack traces, rutas de archivos del servidor, sentencias SQL, códigos de Prisma ni nombres de tablas o columnas. El detalle completo SHALL quedar en el log del servidor.

#### Scenario: Error inesperado
- **WHEN** un endpoint lanza un error no controlado (por ejemplo, la base se cae a mitad de una consulta)
- **THEN** la respuesta es 500 con `{ statusCode: 500, error: "Internal Server Error", message: "Error interno del servidor", requestId, timestamp }` y su cuerpo no contiene `stack`, `prisma`, `select` ni rutas de archivos

#### Scenario: Los errores de dominio conservan su significado
- **WHEN** se pide un perfil curado inexistente
- **THEN** la respuesta sigue siendo 404 con el mensaje de negocio, ahora acompañado de `requestId`

#### Scenario: Errores de validación
- **WHEN** un cuerpo inválido llega a un endpoint de administración
- **THEN** la respuesta es 400 y conserva los mensajes de `class-validator`, sin exponer la clase del DTO ni el stack

### Requirement: Arranque seguro en producción
Con `NODE_ENV=production`, la validación de entorno SHALL impedir el arranque cuando `JWT_SECRET` sea el valor de `.env.example`, tenga menos de 32 caracteres o coincida con `ANALYTICS_SALT`, y cuando `FRONTEND_URL` no use `https`. El mensaje SHALL nombrar la variable y no imprimir su valor.

#### Scenario: Secreto de ejemplo en producción
- **WHEN** se arranca con `NODE_ENV=production` y el `JWT_SECRET` que trae `.env.example`
- **THEN** el proceso termina con código distinto de 0 y el mensaje nombra `JWT_SECRET` sin mostrar su contenido

#### Scenario: Secreto corto en producción
- **WHEN** `NODE_ENV=production` y `JWT_SECRET` tiene 20 caracteres
- **THEN** el arranque falla indicando la longitud mínima

#### Scenario: Frontend sin HTTPS en producción
- **WHEN** `NODE_ENV=production` y `FRONTEND_URL` es `http://ejemplo.com`
- **THEN** el arranque falla nombrando `FRONTEND_URL`

#### Scenario: Desarrollo no se ve afectado
- **WHEN** se arranca con `NODE_ENV=development`, `FRONTEND_URL=http://localhost:5173` y un secreto de desarrollo
- **THEN** la API arranca normalmente

### Requirement: Documentación interactiva fuera de producción
Swagger SHALL publicarse en desarrollo y test, y MUST NOT publicarse cuando `NODE_ENV=production`, salvo que `ENABLE_API_DOCS=true` lo habilite explícitamente.

#### Scenario: Producción sin documentación pública
- **WHEN** la API corre con `NODE_ENV=production` y sin `ENABLE_API_DOCS`
- **THEN** `GET /api/docs` y `GET /api/docs-json` responden 404

#### Scenario: Habilitación explícita
- **WHEN** la API corre con `NODE_ENV=production` y `ENABLE_API_DOCS=true`
- **THEN** `GET /api/docs-json` responde 200
