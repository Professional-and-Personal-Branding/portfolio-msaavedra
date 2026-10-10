# public-profile-api Specification

## Purpose
Expone públicamente el perfil profesional base (identidad, contacto, resumen, disponibilidad e idiomas) en el idioma solicitado, como fuente del encabezado del portafolio y de toda vista curada.

## Requirements

### Requirement: Lectura del perfil base
`GET /api/profile` SHALL devolver 200 con el único perfil base. El cuerpo MUST contener: `id`, `fullName`, `headline`, `location`, `timezone`, `email`, `phone`, `summary`, `yearsOfExperience`, `availability { modality, contractType, startDate }` y `languages[] { name, level, detail }`. Los campos traducibles (`headline`, `summary`, `availability.*`, `languages[].name`, `languages[].level`, `languages[].detail`) SHALL venir resueltos al locale del request según `content-localization`.

#### Scenario: Perfil en español (default)
- **WHEN** un cliente hace `GET /api/profile` tras el seed
- **THEN** recibe 200, `fullName` es `"Manuel Joaquín Saavedra Severiche"`, `yearsOfExperience` es `10`, `languages` tiene 2 elementos y `languages[0].name` es `"Español"`

#### Scenario: Perfil en inglés
- **WHEN** un cliente hace `GET /api/profile?locale=en`
- **THEN** `availability.startDate` es `"Immediate"` y `languages[0].name` es `"Spanish"`

#### Scenario: Sin objetos localizados en la salida
- **WHEN** un cliente hace `GET /api/profile`
- **THEN** ningún valor del cuerpo es un objeto con claves `es`/`en`

#### Scenario: Nivel del idioma en cada locale
- **WHEN** un cliente hace `GET /api/profile?lang=en` y luego `GET /api/profile?lang=es` tras el seed
- **THEN** `languages[0].level` es `"Native"` en la primera respuesta y `"Nativo"` en la segunda, y `languages[1].level` es `"B1-B2"` en las dos

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

### Requirement: Nivel del idioma resuelto en toda salida del perfil
Toda respuesta que incluya el perfil base (`GET /api/profile`, `GET /api/curated-profiles/{slug}` y los previews del panel) SHALL servir `languages[].level` como cadena en el idioma pedido, con el fallback de `content-localization`. Un nivel guardado como texto plano (dato legado) SHALL devolverse igual en todos los idiomas. La forma de `languages[]` MUST NOT cambiar.

#### Scenario: Perfil curado en inglés
- **WHEN** un cliente hace `GET /api/curated-profiles/all?lang=en` tras el seed
- **THEN** `profile.languages[0].name` es `"Spanish"` y `profile.languages[0].level` es `"Native"`

#### Scenario: Perfil curado en español
- **WHEN** un cliente hace `GET /api/curated-profiles/all?lang=es` tras el seed
- **THEN** `profile.languages[0].level` es `"Nativo"`

#### Scenario: Falta el inglés del nivel
- **WHEN** un idioma tiene `level: { es: "Intermedio" }` y se pide el perfil con `?locale=en`
- **THEN** su `level` es `"Intermedio"`

#### Scenario: Nivel legado
- **WHEN** un idioma tiene `level` guardado como el string `"C1"` y se pide el perfil en `en` y en `es`
- **THEN** su `level` es `"C1"` en las dos respuestas

#### Scenario: Forma sin cambios
- **WHEN** un cliente hace `GET /api/profile?locale=en`
- **THEN** cada elemento de `languages` tiene exactamente las claves `name`, `level` y `detail`, las tres cadenas
