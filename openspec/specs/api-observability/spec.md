# api-observability Specification

## Purpose
Permite reconstruir qué pasó en un incidente sin convertir el log en una filtración: cada petición se sigue por un identificador y los secretos nunca se escriben.

## Requirements

### Requirement: Logs estructurados con nivel
La API SHALL emitir logs en JSON (una línea por evento) con `level`, `time`, `msg` y el contexto de la petición cuando aplique. El nivel SHALL configurarse con `LOG_LEVEL` (por defecto `info` en producción y `debug` en desarrollo). En desarrollo la salida SHALL ser legible para una persona.

#### Scenario: Formato en producción
- **WHEN** la API atiende una petición con `NODE_ENV=production`
- **THEN** el log de esa petición es una línea JSON válida con `level`, `time` y `msg`

#### Scenario: Nivel configurable
- **WHEN** `LOG_LEVEL=warn`
- **THEN** los mensajes `info` y `debug` no se emiten

### Requirement: Identificador de petición
Cada petición SHALL recibir un `requestId` (el de la cabecera `X-Request-Id` si viene, o uno nuevo). SHALL aparecer en los logs de esa petición, en la cabecera `X-Request-Id` de la respuesta y en el cuerpo de las respuestas de error.

#### Scenario: Identificador propio
- **WHEN** llega una petición sin `X-Request-Id`
- **THEN** la respuesta trae un `X-Request-Id` y ese mismo valor aparece en el log de la petición

#### Scenario: Identificador del cliente
- **WHEN** llega una petición con `X-Request-Id: abc-123`
- **THEN** la respuesta devuelve `abc-123` y el log usa ese valor

#### Scenario: Trazabilidad de un error
- **WHEN** un endpoint falla con 500
- **THEN** el `requestId` del cuerpo de error coincide con el del log donde está el detalle completo

### Requirement: Redacción de datos sensibles
Los logs MUST NOT contener contraseñas, JWT, cookies de sesión ni tokens de acceso. SHALL redactarse las cabeceras `authorization`, `cookie`, `set-cookie` y `x-access-token`, el parámetro de consulta `token` y los campos `password`, `currentPassword`, `newPassword` y `accessToken` de los cuerpos.

#### Scenario: Login
- **WHEN** se procesa `POST /api/auth/login` con una contraseña
- **THEN** ninguna línea de log contiene esa contraseña, y la cabecera `authorization` aparece como `[Redacted]`

#### Scenario: Perfil protegido por URL
- **WHEN** se pide `/api/curated-profiles/x?token=secreto`
- **THEN** el log registra la ruta con el parámetro `token` redactado, nunca el valor

#### Scenario: Respuesta de sesión
- **WHEN** el login responde con `Set-Cookie`
- **THEN** el log no contiene el JWT emitido

#### Scenario: Cambio de contraseña
- **WHEN** se procesa `POST /api/auth/password`, con éxito, con la actual incorrecta y con una nueva demasiado corta
- **THEN** ninguna línea de log contiene la contraseña actual, la nueva ni el JWT reemitido
