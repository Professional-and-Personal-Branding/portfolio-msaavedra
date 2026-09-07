# profile-view-analytics Specification

## Purpose
Registra cada visita pública a un perfil curado, sin datos personales en claro, y ofrece al administrador una lectura agregada que alimentará el dashboard.

## Requirements

### Requirement: Registro de visita en cada resolución pública exitosa
Cuando `GET /api/curated-profiles/:slug` responde 200, el sistema SHALL crear un `ProfileView` con `curatedProfileId`, `locale` servido, `referrer` y `userAgent` (si vienen), `ipHash` (HMAC-SHA256 de la IP con `ANALYTICS_SALT`, nunca la IP) y `viewedAt`, y SHALL incrementar `views` del perfil en 1 de forma atómica. Respuestas 401/404 MUST NOT registrar nada. Un fallo al registrar MUST NOT alterar la respuesta pública (se registra en log).

#### Scenario: Visita registrada
- **WHEN** un cliente hace `GET /api/curated-profiles/all?locale=en` con `User-Agent: TestUA`
- **THEN** existe un nuevo `ProfileView` del perfil `all` con `locale: "en"`, `userAgent: "TestUA"`, `viewedAt` reciente, y `views` del perfil aumentó en 1

#### Scenario: IP nunca en claro
- **WHEN** se registra una visita desde la IP `203.0.113.7`
- **THEN** `ipHash` es un hex de 64 caracteres y ninguna columna contiene `203.0.113.7`

#### Scenario: Acceso denegado no registra
- **WHEN** un cliente pide un perfil `PROTECTED` sin token (401) o un slug inexistente (404)
- **THEN** el número de `ProfileView` no cambia

### Requirement: Lectura agregada para el administrador
`GET /api/admin/analytics/views` SHALL devolver `{ from, to, total, byProfile: [{ slug, views }], byLocale: [{ locale, views }], byDay: [{ day, views }] }` para el rango `from`/`to` (fechas ISO, default últimos 30 días), ordenando `byProfile` por vistas descendente y `byDay` ascendente. Requiere token de administrador.

#### Scenario: Agregado tras visitas
- **WHEN** se registraron 3 visitas a `all` (2 en `es`, 1 en `en`) dentro del rango y el administrador consulta
- **THEN** `total ≥ 3`, `byProfile` contiene `{ slug: "all", views ≥ 3 }` y `byLocale` contiene `es` y `en`

#### Scenario: Sin token
- **WHEN** un cliente sin token consulta `/api/admin/analytics/views`
- **THEN** recibe 401

#### Scenario: Rango inválido
- **WHEN** envía `from=ayer`
- **THEN** recibe 400
