## ADDED Requirements

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
