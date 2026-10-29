# admin-analytics-dashboard Specification (delta)

## ADDED Requirements

### Requirement: Tabla por tipo de visita en el dashboard
El dashboard SHALL mostrar una tabla **Por tipo** con `byKind` en el mismo rango, con las filas *Personas* (`HUMAN`), *Tus visitas* (`OWNER`) y *Bots* (`BOT`) en ese orden y con ceros incluidos, y una línea que explique que solo las de personas suman en el total y en las visitas de cada perfil. Si los tres tipos están en cero, SHALL mostrar el estado vacío de las demás tablas.

#### Scenario: Los tres tipos
- **WHEN** la API devuelve `byKind` con 12 `HUMAN`, 3 `OWNER` y 5 `BOT`
- **THEN** la tabla lista Personas 12, Tus visitas 3 y Bots 5, en ese orden, junto a la línea explicativa

#### Scenario: El rango se aplica
- **WHEN** se cambia el rango a 7 días
- **THEN** la tabla por tipo se recalcula junto con las demás

#### Scenario: Sin ninguna visita
- **WHEN** los tres tipos están en cero
- **THEN** la tabla por tipo muestra el estado vacío y no una tabla con ceros

## MODIFIED Requirements

### Requirement: Panel de visitas
`/admin` SHALL mostrar, desde `GET /api/admin/analytics/views`, el total de visitas de personas (`HUMAN`) del rango y tres desgloses: por perfil (`byProfile`), por idioma (`byLocale`) y por día (`byDay`). Los perfiles SHALL listarse de mayor a menor cantidad de visitas. Sin visitas de personas, el estado vacío SHALL convivir con la tabla **Por tipo** cuando hay visitas propias o de bots.

#### Scenario: Dashboard con datos
- **WHEN** la API devuelve `total: 12`, dos perfiles y dos idiomas
- **THEN** se muestra 12 como total, los dos perfiles ordenados de mayor a menor y los dos idiomas con su cantidad

#### Scenario: Sin visitas
- **WHEN** la API devuelve `total: 0`, listas vacías y `byKind` en cero
- **THEN** se muestra un estado vacío explicando que todavía no hay visitas, sin errores

#### Scenario: Solo visitas propias o de bots
- **WHEN** la API devuelve `total: 0` y `byKind` con 3 `OWNER` y 2 `BOT`
- **THEN** se muestra el estado vacío de las visitas de personas y, debajo, la tabla **Por tipo** con esos conteos
