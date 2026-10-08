# admin-analytics-dashboard Specification

## Purpose
Responder de un vistazo qué perfiles curados se están viendo, en qué idioma y cuándo, con los datos de `ProfileView` que ya registra la ruta pública.

## Requirements

### Requirement: Panel de visitas
`/admin` SHALL mostrar, desde `GET /api/admin/analytics/views`, el total de visitas del rango y tres desgloses: por perfil (`byProfile`), por idioma (`byLocale`) y por día (`byDay`). Los perfiles SHALL listarse de mayor a menor cantidad de visitas.

#### Scenario: Dashboard con datos
- **WHEN** la API devuelve `total: 12`, dos perfiles y dos idiomas
- **THEN** se muestra 12 como total, los dos perfiles ordenados de mayor a menor y los dos idiomas con su cantidad

#### Scenario: Sin visitas
- **WHEN** la API devuelve `total: 0` y listas vacías
- **THEN** se muestra un estado vacío explicando que todavía no hay visitas, sin errores

### Requirement: Rango de fechas
El dashboard SHALL permitir elegir el rango (por defecto los últimos 30 días) y propagarlo como `from` y `to` a la API; cambiar el rango SHALL recargar los datos.

#### Scenario: Cambio de rango
- **WHEN** se elige "últimos 7 días"
- **THEN** se pide `GET /api/admin/analytics/views?from=<hace 7 días>&to=<hoy>` y las cifras se actualizan

### Requirement: Serie diaria legible
La serie `byDay` SHALL representarse como un gráfico de barras que muestra el valor de cada día de forma accesible (cada barra con su fecha y cantidad como texto alternativo o `title`), usando los colores del tema del panel.

#### Scenario: Serie
- **WHEN** `byDay` trae tres días con 1, 5 y 2 visitas
- **THEN** hay tres barras, la del día con 5 es la más alta y cada una expone su fecha y su cantidad como texto

### Requirement: Enlace al perfil
Cada perfil del desglose SHALL enlazar a su ficha de edición y a su vista pública.

#### Scenario: Navegación desde el dashboard
- **WHEN** se pulsa el nombre de un perfil del desglose
- **THEN** se abre su ficha en `/admin/perfiles/{id}`

### Requirement: Tabla de orígenes en el dashboard
El dashboard SHALL mostrar una tabla **Por origen** con el resultado de `byReferrer`, ordenada por visitas descendente, dentro del mismo rango de fechas que el resto del panel. Cuando el rango no tiene visitas, SHALL mostrar el mismo estado vacío que las demás tablas.

#### Scenario: Orígenes en el rango
- **WHEN** hay visitas desde LinkedIn y visitas directas en los últimos 30 días
- **THEN** la tabla lista `linkedin.com` y `directo` con sus conteos, de mayor a menor

#### Scenario: El rango se aplica
- **WHEN** se cambia el rango a 7 días
- **THEN** la tabla de orígenes se recalcula junto con las demás

#### Scenario: Sin visitas
- **WHEN** el rango elegido no tiene visitas
- **THEN** la tabla de orígenes muestra el estado vacío y no una tabla con ceros
