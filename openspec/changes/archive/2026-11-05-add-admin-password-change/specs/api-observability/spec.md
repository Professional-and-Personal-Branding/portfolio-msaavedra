## MODIFIED Requirements

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
