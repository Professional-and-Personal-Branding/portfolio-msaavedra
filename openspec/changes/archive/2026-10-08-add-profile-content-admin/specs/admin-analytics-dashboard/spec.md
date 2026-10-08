# admin-analytics-dashboard Specification (delta)

## ADDED Requirements

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
