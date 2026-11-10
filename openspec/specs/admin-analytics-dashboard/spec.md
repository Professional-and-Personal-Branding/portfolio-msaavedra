# admin-analytics-dashboard Specification

## Purpose
Responder de un vistazo qué perfiles curados se están viendo, en qué idioma y cuándo, con los datos de `ProfileView` que ya registra la ruta pública.

## Requirements

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

### Requirement: Resumen de postulaciones en el dashboard
El dashboard SHALL mostrar, sobre los totales, una franja de una línea con las postulaciones activas (`GET /api/admin/applications/summary`): el total y cada estado activo con más de cero, más el enlace **Ver postulaciones**. No SHALL depender del rango de fechas ni sumar tarjetas. Con cero activas SHALL decir «Sin postulaciones activas»; si la consulta falla, la franja MUST NOT mostrarse y el resto sigue.

#### Scenario: Con activas
- **WHEN** el resumen trae `active: 3` con 2 `APPLIED` y 1 `OFFER`
- **THEN** la franja dice «Postulaciones activas: 3 · 2 postuladas · 1 con oferta» y enlaza a `/admin/postulaciones`

#### Scenario: El rango no la cambia
- **WHEN** se cambia el rango a 7 días
- **THEN** no se vuelve a pedir el resumen y la franja sigue igual

#### Scenario: Falla el resumen
- **WHEN** el resumen responde 500 y las visitas 200
- **THEN** el dashboard muestra las visitas y no muestra la franja
