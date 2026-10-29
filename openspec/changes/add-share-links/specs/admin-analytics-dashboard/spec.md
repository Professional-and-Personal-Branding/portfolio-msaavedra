# admin-analytics-dashboard Specification (delta)

## ADDED Requirements

### Requirement: Tabla por enlace en el dashboard
El dashboard SHALL mostrar una tabla **Por enlace** con `byShareLink` del mismo rango: etiqueta, perfil, portal, si está revocado y visitas, de mayor a menor, y una fila final «Sin enlace» con `total` menos la suma. Sin visitas atribuidas a enlaces SHALL mostrar un estado vacío que explique cómo crear un enlace desde la pestaña Publicación.

#### Scenario: Enlaces en el rango
- **WHEN** la API devuelve `total: 10` y `byShareLink` con «Acme» 4 y «Globex» 2 (revocado)
- **THEN** la tabla lista Acme 4, Globex 2 marcado como revocado y «Sin enlace» 4, en ese orden

#### Scenario: El rango se aplica
- **WHEN** se cambia el rango a 7 días
- **THEN** la tabla por enlace se recalcula junto con las demás

#### Scenario: Sin enlaces
- **WHEN** `byShareLink` es una lista vacía
- **THEN** la tabla muestra el estado vacío con la indicación de la pestaña Publicación

### Requirement: Tabla por portal en el dashboard
El dashboard SHALL mostrar una tabla **Por portal** con `bySource` del mismo rango, de mayor a menor, y una fila final «Sin portal» con `total` menos la suma, junto a una línea que aclare que **Por origen** depende del referrer, que en producción casi nunca llega. Sin portales SHALL mostrar el estado vacío.

#### Scenario: Portales en el rango
- **WHEN** la API devuelve `total: 10` y `bySource` con `linkedin` 5 e `indeed` 3
- **THEN** la tabla lista linkedin 5, indeed 3 y «Sin portal» 2

#### Scenario: Sin portales
- **WHEN** `bySource` es una lista vacía
- **THEN** la tabla por portal muestra el estado vacío y no una tabla con ceros
