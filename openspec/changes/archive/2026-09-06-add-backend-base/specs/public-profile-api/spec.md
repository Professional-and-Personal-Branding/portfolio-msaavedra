## Purpose

Expone públicamente el perfil profesional base (identidad, contacto, resumen, disponibilidad e idiomas) en el idioma solicitado, como fuente del encabezado del portafolio y de toda vista curada.

## ADDED Requirements

### Requirement: Lectura del perfil base
`GET /api/profile` SHALL devolver 200 con el único perfil base. El cuerpo MUST contener: `id`, `fullName`, `headline`, `location`, `timezone`, `email`, `phone`, `summary`, `yearsOfExperience`, `availability { modality, contractType, startDate }` y `languages[] { name, level, detail }`. Los campos traducibles (`headline`, `summary`, `availability.*`, `languages[].name`, `languages[].detail`) SHALL venir resueltos al locale del request según `content-localization`.

#### Scenario: Perfil en español (default)
- **WHEN** un cliente hace `GET /api/profile` tras el seed
- **THEN** recibe 200, `fullName` es `"Manuel Joaquín Saavedra Severiche"`, `yearsOfExperience` es `10`, `languages` tiene 2 elementos y `languages[0].name` es `"Español"`

#### Scenario: Perfil en inglés
- **WHEN** un cliente hace `GET /api/profile?locale=en`
- **THEN** `availability.startDate` es `"Immediate"` y `languages[0].name` es `"Spanish"`

#### Scenario: Sin objetos localizados en la salida
- **WHEN** un cliente hace `GET /api/profile`
- **THEN** ningún valor del cuerpo es un objeto con claves `es`/`en`

### Requirement: Perfil inexistente
Si no hay perfil base cargado, `GET /api/profile` MUST responder 404 en el formato de error de `api-platform`, con `message` que indique que el perfil no existe.

#### Scenario: Base sin perfil
- **WHEN** la tabla de perfiles está vacía y un cliente hace `GET /api/profile`
- **THEN** recibe 404 con `error: "Not Found"`

### Requirement: Solo campos públicos
La respuesta MUST NOT incluir campos internos de persistencia (`createdAt`, `updatedAt`, `profileId`) ni campos ajenos al perfil.

#### Scenario: Sin metadatos de persistencia
- **WHEN** un cliente hace `GET /api/profile`
- **THEN** el cuerpo no contiene las claves `createdAt`, `updatedAt` ni `languages[].profileId`
