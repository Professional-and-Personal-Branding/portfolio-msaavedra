# profile-view-analytics Specification (delta)

## MODIFIED Requirements

### Requirement: Lectura agregada para el administrador
`GET /api/admin/analytics/views` SHALL devolver `{ from, to, total, byProfile: [{ slug, views }], byLocale: [{ locale, views }], byDay: [{ day, views }] }` para el rango `from`/`to` (fechas ISO), ordenando `byProfile` por vistas descendente y `byDay` ascendente. Requiere token de administrador.

El rango SHALL ser **cerrado y de días UTC completos**: incluye todas las visitas desde las 00:00:00.000 UTC del día de `from` hasta el final del día UTC de `to`, ambos días incluidos. Si `from` o `to` traen hora, cuenta el día UTC al que pertenecen. Por defecto, `to` es el día UTC en curso y `from` es 29 días antes (30 días completos). La respuesta SHALL devolver `from` y `to` normalizados: el inicio del día de `from` y el último milisegundo del día de `to`, en ISO 8601.

#### Scenario: Agregado tras visitas
- **WHEN** se registraron 3 visitas a `all` (2 en `es`, 1 en `en`) dentro del rango y el administrador consulta
- **THEN** `total ≥ 3`, `byProfile` contiene `{ slug: "all", views ≥ 3 }` y `byLocale` contiene `es` y `en`

#### Scenario: Las visitas de hoy cuentan
- **WHEN** se registra una visita ahora y el administrador consulta con `from` y `to` iguales a la fecha UTC de hoy
- **THEN** `total ≥ 1` y `byDay` contiene la fecha de hoy con `views ≥ 1`

#### Scenario: Normalización del rango
- **WHEN** el administrador consulta `from=2026-10-01&to=2026-10-05`
- **THEN** la respuesta trae `from: "2026-10-01T00:00:00.000Z"` y `to: "2026-10-05T23:59:59.999Z"`

#### Scenario: Rango por defecto
- **WHEN** el administrador consulta sin `from` ni `to` el 5 de octubre de 2026
- **THEN** la respuesta trae `from: "2026-09-06T00:00:00.000Z"` y `to: "2026-10-05T23:59:59.999Z"`

#### Scenario: Sin token
- **WHEN** un cliente sin token consulta `/api/admin/analytics/views`
- **THEN** recibe 401

#### Scenario: Rango inválido
- **WHEN** envía `from=ayer`, o un `from` posterior a `to`
- **THEN** recibe 400
